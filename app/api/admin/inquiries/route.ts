import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isHeld, reserveEventCapacity, releaseEventCapacity, CapacityExceededError } from "@/lib/eventCapacity";
import { ConflictError } from "@/lib/concurrency";

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

  const { id, status, updatedAt } = await req.json() as { id: string; status: string; updatedAt?: string };
  const allowed = ["neu", "in_pruefung", "angebot_versendet", "bestaetigt", "abgelehnt", "storniert", "abgelaufen"];
  if (!allowed.includes(status)) {
    return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });
  }
  if (!updatedAt) {
    return NextResponse.json({ error: "updatedAt fehlt" }, { status: 400 });
  }

  const client = await prisma.client.findUnique({ where: { slug: session.clientSlug } });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const inquiry = await prisma.inquiry.findFirst({ where: { id, clientId: client.id } });
  if (!inquiry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // Conditioned on the updatedAt the client loaded — if someone else (another
      // admin, or the hold-expiry cron) changed this inquiry in the meantime, this
      // matches zero rows and the request fails as a conflict *before* touching
      // capacity below, instead of silently overwriting their change.
      const result = await tx.inquiry.updateMany({
        where: { id, clientId: client.id, updatedAt: new Date(updatedAt) },
        data: {
          status,
          // A confirmed or resolved booking is no longer subject to the capacity-hold expiry.
          ...(status !== "neu" && status !== "in_pruefung" && status !== "angebot_versendet" ? { holdExpiresAt: null } : {}),
        },
      });
      if (result.count === 0) throw new ConflictError();

      // A status change into/out of a "held" status releases/re-reserves the Event
      // capacity this Inquiry occupies. Symmetric so any transition (not just
      // confirm/reject) stays correct. Safe to base on the status read above (not
      // re-read here) because the updatedAt guard just proved nothing changed it
      // since then — a losing concurrent request never reaches this point at all.
      if (inquiry.eventId && inquiry.participantCount > 0) {
        const wasHeld = isHeld(inquiry.status);
        const nowHeld = isHeld(status);
        if (wasHeld && !nowHeld) {
          await releaseEventCapacity(inquiry.eventId, inquiry.participantCount, tx);
        } else if (!wasHeld && nowHeld) {
          const reserved = await reserveEventCapacity(inquiry.eventId, inquiry.participantCount, tx);
          if (!reserved) throw new CapacityExceededError();
        }
      }

      return tx.inquiry.findUniqueOrThrow({ where: { id } });
    });

    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof ConflictError) {
      return NextResponse.json(
        { error: "Diese Anfrage wurde inzwischen von jemand anderem geändert — bitte neu laden." },
        { status: 409 }
      );
    }
    if (e instanceof CapacityExceededError) {
      return NextResponse.json({ error: "Für diesen Status reicht die freie Kapazität des Events nicht mehr aus" }, { status: 400 });
    }
    throw e;
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json() as { id: string };
  const client = await prisma.client.findUnique({ where: { slug: session.clientSlug } });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const inquiry = await prisma.inquiry.findFirst({ where: { id, clientId: client.id } });
  if (!inquiry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (inquiry.eventId && inquiry.participantCount > 0 && isHeld(inquiry.status)) {
    await releaseEventCapacity(inquiry.eventId, inquiry.participantCount);
  }

  await prisma.inquiry.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
