import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { hashSync } from "bcryptjs";
import { Resend } from "resend";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isValidEmail, sanitizeEmailHeader } from "@/lib/validate";
import { isPlan, teamLimitFor, PLAN_LABELS } from "@/lib/plan";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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

  const plan = isPlan(org.plan) ? org.plan : "basis";
  return NextResponse.json({ members: org.users.map((u) => serialize(u, session.userId)), limit: teamLimitFor(plan), plan });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { email } = await req.json();
  if (!isValidEmail(email)) return NextResponse.json({ error: "E-Mail ungültig" }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "Diese E-Mail ist bereits registriert" }, { status: 400 });

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { plan: true, name: true, _count: { select: { users: true } } },
  });
  if (!org) return NextResponse.json({ error: "Organisation nicht gefunden" }, { status: 404 });

  const plan = isPlan(org.plan) ? org.plan : "basis";
  const limit = teamLimitFor(plan);
  if (limit !== null && org._count.users >= limit) {
    return NextResponse.json({ error: `Maximal ${limit} Team-Mitglied(er) im ${PLAN_LABELS[plan]}-Paket. Für mehr Mitglieder upgraden.` }, { status: 400 });
  }

  const inviteToken = randomBytes(32).toString("hex");
  const user = await prisma.user.create({
    data: {
      email,
      password: hashSync(randomBytes(32).toString("hex"), 12),
      organizationId: session.organizationId,
      inviteToken,
      inviteTokenExpiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
  });

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

  return NextResponse.json(serialize(user, session.userId));
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
