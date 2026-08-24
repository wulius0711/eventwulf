import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

function serialize(e: {
  id: string; name: string; description: string; image: string;
  startDate: Date; endDate: Date; color: string; intern: boolean;
  pricePerPerson: number; minParticipants: number; maxParticipants: number | null;
  bookedCount: number; isActive: boolean; sortOrder: number;
}) {
  return {
    id: e.id,
    name: e.name,
    description: e.description,
    image: e.image,
    startDate: e.startDate.toISOString(),
    endDate: e.endDate.toISOString(),
    color: e.color,
    intern: e.intern,
    pricePerPerson: e.pricePerPerson,
    minParticipants: e.minParticipants,
    maxParticipants: e.maxParticipants,
    bookedCount: e.bookedCount,
    isActive: e.isActive,
    sortOrder: e.sortOrder,
  };
}

async function getClientId(slug: string) {
  const client = await prisma.client.findUnique({ where: { slug }, select: { id: true } });
  return client?.id ?? null;
}

function parseMaxParticipants(val: unknown, fallback: number | null): number | null {
  if (val === undefined) return fallback;
  if (val === null || val === "") return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const clientId = await getClientId(session.clientSlug);
  if (!clientId) return NextResponse.json({ error: "Client nicht gefunden" }, { status: 404 });

  const events = await prisma.event.findMany({
    where: { clientId },
    orderBy: [{ startDate: "asc" }, { sortOrder: "asc" }],
  });

  return NextResponse.json(events.map(serialize));
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const clientId = await getClientId(session.clientSlug);
  if (!clientId) return NextResponse.json({ error: "Client nicht gefunden" }, { status: 404 });

  const body = await req.json();
  const {
    name, description, image, startDate, endDate, color, intern,
    pricePerPerson, minParticipants, maxParticipants, isActive, sortOrder,
  } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Name fehlt" }, { status: 400 });
  }
  if (!startDate || !endDate) {
    return NextResponse.json({ error: "Zeitraum fehlt" }, { status: 400 });
  }
  if (new Date(endDate) < new Date(startDate)) {
    return NextResponse.json({ error: "Enddatum muss nach Startdatum liegen" }, { status: 400 });
  }

  const min = Number(minParticipants) || 1;
  const max = parseMaxParticipants(maxParticipants, null);
  if (max !== null && min > max) {
    return NextResponse.json({ error: "Min. Teilnehmer darf nicht über Max. Teilnehmer liegen" }, { status: 400 });
  }

  try {
    const ev = await prisma.event.create({
      data: {
        clientId,
        name: name.trim(),
        description: description ?? "",
        image: image ?? "",
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        color: color ?? "",
        intern: intern === true,
        pricePerPerson: Number(pricePerPerson) || 0,
        minParticipants: min,
        maxParticipants: max,
        isActive: isActive !== false,
        sortOrder: Number(sortOrder) || 0,
      },
    });
    return NextResponse.json(serialize(ev));
  } catch {
    return NextResponse.json({ error: "Speichern fehlgeschlagen" }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const clientId = await getClientId(session.clientSlug);
  if (!clientId) return NextResponse.json({ error: "Client nicht gefunden" }, { status: 404 });

  const body = await req.json();
  const {
    id, name, description, image, startDate, endDate, color, intern,
    pricePerPerson, minParticipants, maxParticipants, isActive, sortOrder,
  } = body;

  const existing = await prisma.event.findFirst({ where: { id, clientId } });
  if (!existing) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const min = minParticipants !== undefined ? Number(minParticipants) : existing.minParticipants;
  const max = parseMaxParticipants(maxParticipants, existing.maxParticipants);
  if (max !== null && min > max) {
    return NextResponse.json({ error: "Min. Teilnehmer darf nicht über Max. Teilnehmer liegen" }, { status: 400 });
  }
  if (max !== null && existing.bookedCount > max) {
    return NextResponse.json({ error: `Es sind bereits ${existing.bookedCount} Plätze belegt — Max. Teilnehmer kann nicht darunter gesetzt werden` }, { status: 400 });
  }

  try {
    const updated = await prisma.event.update({
      where: { id },
      data: {
        name: name?.trim() ?? existing.name,
        description: description ?? existing.description,
        image: image ?? existing.image,
        startDate: startDate ? new Date(startDate) : existing.startDate,
        endDate: endDate ? new Date(endDate) : existing.endDate,
        color: color ?? existing.color,
        intern: intern !== undefined ? Boolean(intern) : existing.intern,
        pricePerPerson: pricePerPerson !== undefined ? Number(pricePerPerson) : existing.pricePerPerson,
        minParticipants: min,
        maxParticipants: max,
        isActive: isActive !== undefined ? Boolean(isActive) : existing.isActive,
        sortOrder: sortOrder !== undefined ? Number(sortOrder) : existing.sortOrder,
      },
    });
    return NextResponse.json(serialize(updated));
  } catch {
    return NextResponse.json({ error: "Speichern fehlgeschlagen" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const clientId = await getClientId(session.clientSlug);
  if (!clientId) return NextResponse.json({ error: "Client nicht gefunden" }, { status: 404 });

  const { id } = await req.json();
  await prisma.event.deleteMany({ where: { id, clientId } });

  return NextResponse.json({ ok: true });
}
