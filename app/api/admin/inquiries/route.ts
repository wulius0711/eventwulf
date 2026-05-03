import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = await prisma.client.findUnique({ where: { slug: session.clientSlug } });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const inquiries = await prisma.inquiry.findMany({
    where: { clientId: client.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(inquiries);
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, status } = await req.json() as { id: string; status: string };
  const allowed = ["neu", "in_pruefung", "angebot_versendet", "bestaetigt", "abgelehnt", "storniert"];
  if (!allowed.includes(status)) {
    return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });
  }

  const client = await prisma.client.findUnique({ where: { slug: session.clientSlug } });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const inquiry = await prisma.inquiry.findFirst({ where: { id, clientId: client.id } });
  if (!inquiry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.inquiry.update({ where: { id }, data: { status } });

  // Update bookedCount on overlapping events when confirming or un-confirming
  const wasConfirmed = inquiry.status === "bestaetigt";
  const nowConfirmed = status === "bestaetigt";
  if (wasConfirmed !== nowConfirmed && inquiry.participantCount > 0) {
    try {
      const data = JSON.parse(inquiry.data) as { datumVon?: string; datumBis?: string };
      if (data.datumVon && data.datumBis) {
        const from = new Date(data.datumVon + "T00:00:00");
        const to = new Date(data.datumBis + "T23:59:59");
        const events = await prisma.blockedDate.findMany({
          where: {
            clientId: client.id,
            type: "event",
            startDate: { lte: to },
            endDate: { gte: from },
            maxCapacity: { not: null },
          },
        });
        const delta = nowConfirmed ? inquiry.participantCount : -inquiry.participantCount;
        await Promise.all(events.map((ev) =>
          prisma.blockedDate.update({
            where: { id: ev.id },
            data: { bookedCount: { increment: delta } },
          })
        ));
      }
    } catch { /* non-critical */ }
  }

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json() as { id: string };
  const client = await prisma.client.findUnique({ where: { slug: session.clientSlug } });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const inquiry = await prisma.inquiry.findFirst({ where: { id, clientId: client.id } });
  if (!inquiry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.inquiry.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
