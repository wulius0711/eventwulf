import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

function serialize(b: { id: string; startDate: Date; endDate: Date; label: string; type: string; color: string; [key: string]: unknown }) {
  return {
    id: b.id,
    startDate: b.startDate.toISOString(),
    endDate: b.endDate.toISOString(),
    label: b.label,
    type: b.type,
    color: b.color,
  };
}

async function getClientId(slug: string) {
  const client = await prisma.client.findUnique({ where: { slug }, select: { id: true } });
  return client?.id ?? null;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const clientId = await getClientId(session.clientSlug);
  if (!clientId) return NextResponse.json({ error: "Client nicht gefunden" }, { status: 404 });

  const entries = await prisma.blockedDate.findMany({
    where: { clientId },
    orderBy: { startDate: "asc" },
  });

  return NextResponse.json(entries.map(serialize));
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const clientId = await getClientId(session.clientSlug);
  if (!clientId) return NextResponse.json({ error: "Client nicht gefunden" }, { status: 404 });

  const { startDate, endDate, label, type, color } = await req.json();
  const entry = await prisma.blockedDate.create({
    data: {
      clientId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      label: label ?? (type === "event" ? "Event" : "nicht verfügbar"),
      type: type ?? "blocked",
      color: color ?? "",
    },
  });

  return NextResponse.json(serialize(entry));
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const clientId = await getClientId(session.clientSlug);
  if (!clientId) return NextResponse.json({ error: "Client nicht gefunden" }, { status: 404 });

  const { id, startDate, endDate, label, type, color } = await req.json();
  const entry = await prisma.blockedDate.findFirst({ where: { id, clientId } });
  if (!entry) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const updated = await prisma.blockedDate.update({
    where: { id },
    data: {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      label: label ?? entry.label,
      type: type ?? entry.type,
      color: color ?? entry.color,
    },
  });

  return NextResponse.json(serialize(updated));
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const clientId = await getClientId(session.clientSlug);
  if (!clientId) return NextResponse.json({ error: "Client nicht gefunden" }, { status: 404 });

  const { id } = await req.json();
  await prisma.blockedDate.deleteMany({ where: { id, clientId } });

  return NextResponse.json({ ok: true });
}
