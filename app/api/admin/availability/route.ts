import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function getClientId(slug: string) {
  const client = await prisma.client.findUnique({ where: { slug }, select: { id: true } });
  return client?.id ?? null;
}

function serializeBlocked(b: { id: string; startDate: Date; endDate: Date; label: string }) {
  return {
    id: b.id,
    startDate: b.startDate.toISOString(),
    endDate: b.endDate.toISOString(),
    label: b.label,
    type: "blocked" as const,
    color: "",
    maxCapacity: null,
    bookedCount: 0,
  };
}

function serializeEvent(e: { id: string; startDate: Date; endDate: Date; name: string; color: string; maxParticipants: number | null; bookedCount: number }) {
  return {
    id: e.id,
    startDate: e.startDate.toISOString(),
    endDate: e.endDate.toISOString(),
    label: e.name,
    type: "event" as const,
    color: e.color,
    maxCapacity: e.maxParticipants,
    bookedCount: e.bookedCount,
  };
}

// Read-only compatibility for the "Eingetragene Events" list in the current
// AvailabilityEditor UI. Creating/editing events here is intentionally
// disabled below — that moves to the dedicated Event admin UI.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const clientId = await getClientId(session.clientSlug);
  if (!clientId) return NextResponse.json({ error: "Client nicht gefunden" }, { status: 404 });

  const [blocked, events] = await Promise.all([
    prisma.blockedDate.findMany({ where: { clientId }, orderBy: { startDate: "asc" } }),
    prisma.event.findMany({ where: { clientId }, orderBy: { startDate: "asc" } }),
  ]);

  return NextResponse.json([...blocked.map(serializeBlocked), ...events.map(serializeEvent)]);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const clientId = await getClientId(session.clientSlug);
  if (!clientId) return NextResponse.json({ error: "Client nicht gefunden" }, { status: 404 });

  const { startDate, endDate, label, type } = await req.json();

  if (type === "event") {
    return NextResponse.json(
      { error: "Events werden jetzt über die Event-Verwaltung angelegt (folgt in Kürze)." },
      { status: 400 }
    );
  }

  const entry = await prisma.blockedDate.create({
    data: {
      clientId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      label: label ?? "nicht verfügbar",
    },
  });

  return NextResponse.json(serializeBlocked(entry));
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const clientId = await getClientId(session.clientSlug);
  if (!clientId) return NextResponse.json({ error: "Client nicht gefunden" }, { status: 404 });

  const { id, startDate, endDate, label, type } = await req.json();

  if (type === "event") {
    return NextResponse.json(
      { error: "Events werden jetzt über die Event-Verwaltung bearbeitet (folgt in Kürze)." },
      { status: 400 }
    );
  }

  const entry = await prisma.blockedDate.findFirst({ where: { id, clientId } });
  if (!entry) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const updated = await prisma.blockedDate.update({
    where: { id },
    data: {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      label: label ?? entry.label,
    },
  });

  return NextResponse.json(serializeBlocked(updated));
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const clientId = await getClientId(session.clientSlug);
  if (!clientId) return NextResponse.json({ error: "Client nicht gefunden" }, { status: 404 });

  const { id } = await req.json();
  // May target either a BlockedDate or an Event row (existing "Eingetragene Events"
  // list still lets you delete them). deleteMany on the wrong table is a silent no-op,
  // so try both — harmless since ids are globally unique cuids.
  await prisma.blockedDate.deleteMany({ where: { id, clientId } });
  await prisma.event.deleteMany({ where: { id, clientId } });

  return NextResponse.json({ ok: true });
}
