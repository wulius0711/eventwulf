import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isHeld, reserveEventCapacity, releaseEventCapacity } from "@/lib/eventCapacity";

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
  const allowed = ["neu", "in_pruefung", "angebot_versendet", "bestaetigt", "abgelehnt", "storniert", "abgelaufen"];
  if (!allowed.includes(status)) {
    return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });
  }

  const client = await prisma.client.findUnique({ where: { slug: session.clientSlug } });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const inquiry = await prisma.inquiry.findFirst({ where: { id, clientId: client.id } });
  if (!inquiry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // A status change into/out of a "held" status releases/re-reserves the Event capacity
  // this Inquiry occupies. Symmetric so any transition (not just confirm/reject) stays correct.
  if (inquiry.eventId && inquiry.participantCount > 0) {
    const wasHeld = isHeld(inquiry.status);
    const nowHeld = isHeld(status);
    if (wasHeld && !nowHeld) {
      await releaseEventCapacity(inquiry.eventId, inquiry.participantCount);
    } else if (!wasHeld && nowHeld) {
      const reserved = await reserveEventCapacity(inquiry.eventId, inquiry.participantCount);
      if (!reserved) {
        return NextResponse.json({ error: "Für diesen Status reicht die freie Kapazität des Events nicht mehr aus" }, { status: 400 });
      }
    }
  }

  const updated = await prisma.inquiry.update({
    where: { id },
    data: {
      status,
      // A confirmed or resolved booking is no longer subject to the capacity-hold expiry.
      ...(status !== "neu" && status !== "in_pruefung" && status !== "angebot_versendet" ? { holdExpiresAt: null } : {}),
    },
  });

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
