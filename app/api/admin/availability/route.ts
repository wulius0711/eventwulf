import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const blocked = await prisma.blockedDate.findMany({
    where: { clientId: session.clientId },
    orderBy: { startDate: "asc" },
  });

  return NextResponse.json(
    blocked.map((b) => ({
      id: b.id,
      startDate: b.startDate.toISOString(),
      endDate: b.endDate.toISOString(),
      label: b.label,
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { startDate, endDate, label } = await req.json();
  const entry = await prisma.blockedDate.create({
    data: {
      clientId: session.clientId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      label: label ?? "nicht verfügbar",
    },
  });

  return NextResponse.json({
    id: entry.id,
    startDate: entry.startDate.toISOString(),
    endDate: entry.endDate.toISOString(),
    label: entry.label,
  });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { id } = await req.json();
  await prisma.blockedDate.deleteMany({
    where: { id, clientId: session.clientId },
  });

  return NextResponse.json({ ok: true });
}
