import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { hashSync } from "bcryptjs";
import { Resend } from "resend";
import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isValidEmail, sanitizeEmailHeader } from "@/lib/validate";
import { effectivePlan, teamLimitFor, PLAN_LABELS, PlanLimitExceededError } from "@/lib/plan";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Always answers the same way whether or not the email already belongs to
// a User row anywhere on the platform (not just this org) — same technique
// as GENERIC_OK in app/api/admin/forgot/route.ts, closing the cross-tenant
// email-enumeration side channel at invite creation instead (Durchgang 3,
// Fund 4: the previous "Diese E-Mail ist bereits registriert" 400 let any
// org admin probe whether an address was registered to a DIFFERENT org).
const GENERIC_INVITE_OK = { ok: true };
// Approximates the org lookup + locked transaction + Resend call the real
// invite path below does — not a measurement of that actual cost, just
// enough padding to defeat casual timing analysis, same reasoning as
// NO_SEND_DELAY_MS in app/api/admin/forgot/route.ts.
const NO_INVITE_DELAY_MS = 300;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function serialize(u: { id: string; email: string; createdAt: Date; inviteToken: string | null }, currentUserId: string) {
  return {
    id: u.id,
    email: u.email,
    createdAt: u.createdAt.toISOString(),
    pending: u.inviteToken !== null,
    self: u.id === currentUserId,
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    include: { users: { orderBy: { createdAt: "asc" } } },
  });
  if (!org) return NextResponse.json({ error: "Organisation nicht gefunden" }, { status: 404 });

  const plan = effectivePlan(org);
  return NextResponse.json({ members: org.users.map((u) => serialize(u, session.userId)), limit: teamLimitFor(plan), plan });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { email } = await req.json();
  if (!isValidEmail(email)) return NextResponse.json({ error: "E-Mail ungültig" }, { status: 400 });

  // Fast pre-check for the common (non-racing) case — doesn't need the lock
  // below, since it's not what makes the count+create atomic; that's the
  // transaction's job. A concurrent invite for the same email that slips
  // past this check still can't create a second User row (email is
  // @unique), it just surfaces as the P2002 catch below instead of a 500.
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await delay(NO_INVITE_DELAY_MS);
    return NextResponse.json(GENERIC_INVITE_OK);
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { plan: true, subscriptionStatus: true, name: true },
  });
  if (!org) return NextResponse.json({ error: "Organisation nicht gefunden" }, { status: 404 });

  const plan = effectivePlan(org);
  const limit = teamLimitFor(plan);
  const inviteToken = randomBytes(32).toString("hex");

  let user;
  try {
    user = await prisma.$transaction(async (tx) => {
      // Serializes concurrent invites for this org so the count+create below
      // can't race with another one — same pg_advisory_xact_lock pattern as
      // rooms/events/locations (see app/api/admin/rooms/route.ts).
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${session.organizationId})::bigint)`;
      if (limit !== null) {
        const count = await tx.user.count({ where: { organizationId: session.organizationId } });
        if (count >= limit) throw new PlanLimitExceededError();
      }
      return tx.user.create({
        data: {
          email,
          password: hashSync(randomBytes(32).toString("hex"), 12),
          organizationId: session.organizationId,
          inviteToken,
          inviteTokenExpiresAt: new Date(Date.now() + INVITE_TTL_MS),
        },
      });
    });
  } catch (e) {
    if (e instanceof PlanLimitExceededError) {
      return NextResponse.json({ error: `Maximal ${limit} Team-Mitglied(er) im ${PLAN_LABELS[plan]}-Paket. Für mehr Mitglieder upgraden.` }, { status: 400 });
    }
    // Lost the race against a concurrent invite for the same email — same
    // generic response as the pre-check above, for the same reason (was a
    // clean 400 before Phase 4; a distinct status here would itself leak
    // the "this email already exists" signal the generic response exists
    // to hide — see Durchgang 3, Info finding for why a 500 was wrong here
    // in the first place).
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      await delay(NO_INVITE_DELAY_MS);
      return NextResponse.json(GENERIC_INVITE_OK);
    }
    throw e;
  }

  const inviteUrl = `${req.nextUrl.origin}/admin/invite/${inviteToken}`;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: `${sanitizeEmailHeader(org.name)} <anfrage@eventwulf.at>`,
      to: email,
      subject: `Einladung zu eventwulf`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:2rem">
          <h2 style="margin:0 0 0.5rem;font-size:1.2rem;color:#1a1612">Du wurdest zu eventwulf eingeladen</h2>
          <p style="margin:0 0 1.5rem;color:#6b7280;font-size:0.9rem">
            ${sanitizeEmailHeader(session.email)} hat dich zum Team von "${sanitizeEmailHeader(org.name)}" auf eventwulf eingeladen.
          </p>
          <p style="margin:0 0 1.5rem"><a href="${inviteUrl}" style="display:inline-block;padding:10px 20px;background:#996C1E;color:#ffffff;border-radius:8px;text-decoration:none;font-size:0.9rem;font-weight:600">Einladung annehmen</a></p>
          <p style="margin:0;color:#6b7280;font-size:0.8rem">Der Link ist 7 Tage gültig.</p>
        </div>
      `,
    });
  } catch (e) {
    console.error(`Failed to send invite email to ${user.id}:`, e);
  }

  // Generic response even on the real success path — TeamEditor.tsx never
  // reads the body on success, it just reloads the member list, so this
  // costs nothing beyond the client no longer being able to distinguish
  // "invited" from "already existed elsewhere" by response *shape* either,
  // not just status code.
  return NextResponse.json(GENERIC_INVITE_OK);
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { userId } = await req.json();
  if (userId === session.userId) {
    return NextResponse.json({ error: "Du kannst dich nicht selbst entfernen" }, { status: 400 });
  }

  const user = await prisma.user.findFirst({ where: { id: userId, organizationId: session.organizationId } });
  if (!user) return NextResponse.json({ ok: true }); // already gone

  await prisma.user.delete({ where: { id: user.id } });
  return NextResponse.json({ ok: true });
}
