import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loadConfig } from "@/lib/loadConfig";
import { locationLimitFor, effectivePlan, PLAN_LABELS, PlanLimitExceededError } from "@/lib/plan";

const SUPERADMIN = process.env.SUPERADMIN_SLUG ?? "admin";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.clientSlug !== SUPERADMIN) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const { id } = await params;
  const { slug } = await req.json();

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: "Ungültiger Slug (nur a-z, 0-9, -)" }, { status: 400 });
  }

  const existing = await prisma.client.findUnique({ where: { slug } });
  if (existing) return NextResponse.json({ error: "Slug bereits vergeben" }, { status: 400 });

  const org = await prisma.organization.findUnique({ where: { id }, select: { plan: true, subscriptionStatus: true } });
  const plan = effectivePlan(org);
  const limit = locationLimitFor(plan);
  const defaultConfig = loadConfig("default");

  try {
    const client = await prisma.$transaction(async (tx) => {
      // Same pg_advisory_xact_lock pattern as rooms/events (see
      // app/api/admin/rooms/route.ts) — only the superadmin creates
      // locations today (no self-service UI), but the count+create here has
      // the identical TOCTOU shape, so it gets the identical fix.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id})::bigint)`;
      if (limit !== null) {
        const count = await tx.client.count({ where: { organizationId: id } });
        if (count >= limit) throw new PlanLimitExceededError();
      }
      return tx.client.create({
        data: { slug, config: JSON.stringify(defaultConfig), organizationId: id },
      });
    });
    return NextResponse.json({ slug: client.slug });
  } catch (e) {
    if (e instanceof PlanLimitExceededError) {
      return NextResponse.json({ error: `Maximal ${limit} Standort(e) im ${PLAN_LABELS[plan]}-Paket. Für weitere Standorte upgraden.` }, { status: 400 });
    }
    return NextResponse.json({ error: "Speichern fehlgeschlagen" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.clientSlug !== SUPERADMIN) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const { id } = await params;
  const { slug } = await req.json();

  const client = await prisma.client.findFirst({ where: { slug, organizationId: id } });
  if (!client) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  if (slug === SUPERADMIN) {
    return NextResponse.json({ error: "Superadmin-Slug kann nicht gelöscht werden" }, { status: 400 });
  }

  // Prevent deleting the last slug of an org
  const count = await prisma.client.count({ where: { organizationId: id } });
  if (count <= 1) return NextResponse.json({ error: "Letzter Slug kann nicht gelöscht werden" }, { status: 400 });

  await prisma.inquiry.deleteMany({ where: { clientId: client.id } });
  await prisma.blockedDate.deleteMany({ where: { clientId: client.id } });
  await prisma.client.delete({ where: { id: client.id } });

  return NextResponse.json({ ok: true });
}
