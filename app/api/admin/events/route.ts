import { NextRequest, NextResponse } from "next/server";
import sanitizeHtml from "sanitize-html";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { releaseEventImage } from "@/lib/bunny";

function sanitizeDescription(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["p", "strong", "em", "ul", "ol", "li", "br", "a"],
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto", "tel"],
  });
}

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

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
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
  if (new Date(startDate) < startOfToday()) {
    return NextResponse.json({ error: "Startdatum darf nicht in der Vergangenheit liegen" }, { status: 400 });
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
        description: description ? sanitizeDescription(description) : "",
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

  const newStartDate = startDate ? new Date(startDate) : existing.startDate;
  const newEndDate = endDate ? new Date(endDate) : existing.endDate;
  if (newEndDate < newStartDate) {
    return NextResponse.json({ error: "Enddatum muss nach Startdatum liegen" }, { status: 400 });
  }
  // Only block moving a date INTO the past — editing other fields of an already-past event
  // (e.g. fixing its name) must keep working without being forced to change its date.
  if (newStartDate < startOfToday() && newStartDate.getTime() !== existing.startDate.getTime()) {
    return NextResponse.json({ error: "Startdatum darf nicht in die Vergangenheit verschoben werden" }, { status: 400 });
  }

  const min = minParticipants !== undefined ? Number(minParticipants) : existing.minParticipants;
  const max = parseMaxParticipants(maxParticipants, existing.maxParticipants);
  if (max !== null && min > max) {
    return NextResponse.json({ error: "Min. Teilnehmer darf nicht über Max. Teilnehmer liegen" }, { status: 400 });
  }
  if (max !== null && existing.bookedCount > max) {
    return NextResponse.json({ error: `Es sind bereits ${existing.bookedCount} Plätze belegt — Max. Teilnehmer kann nicht darunter gesetzt werden` }, { status: 400 });
  }

  const newImage = image ?? existing.image;

  try {
    const updated = await prisma.event.update({
      where: { id },
      data: {
        name: name?.trim() ?? existing.name,
        description: description !== undefined ? sanitizeDescription(description) : existing.description,
        image: newImage,
        startDate: newStartDate,
        endDate: newEndDate,
        color: color ?? existing.color,
        intern: intern !== undefined ? Boolean(intern) : existing.intern,
        pricePerPerson: pricePerPerson !== undefined ? Number(pricePerPerson) : existing.pricePerPerson,
        minParticipants: min,
        maxParticipants: max,
        isActive: isActive !== undefined ? Boolean(isActive) : existing.isActive,
        sortOrder: sortOrder !== undefined ? Number(sortOrder) : existing.sortOrder,
      },
    });
    if (existing.image && existing.image !== newImage) {
      await releaseEventImage(existing.image, clientId, id);
    }
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
  const existing = await prisma.event.findFirst({ where: { id, clientId } });
  if (!existing) return NextResponse.json({ ok: true }); // already gone

  await prisma.event.delete({ where: { id } });
  if (existing.image) {
    await releaseEventImage(existing.image, clientId, id);
  }

  return NextResponse.json({ ok: true });
}
