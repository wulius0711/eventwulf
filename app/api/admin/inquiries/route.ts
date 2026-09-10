import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isHeld, reserveEventCapacity, releaseEventCapacity, CapacityExceededError } from "@/lib/eventCapacity";
import { ConflictError, NotFoundError } from "@/lib/concurrency";

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

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // Locking read (FOR UPDATE), not a plain findFirst before the transaction:
      // a plain pre-transaction read leaves a gap between "read this inquiry's
      // status" and "decide whether to release/reserve capacity based on it" —
      // wide enough for the hold-expiry cron to commit its own change in between
      // (its raw UPDATE doesn't touch updatedAt, so the guard below wouldn't
      // catch a change that slipped in there). The lock closes that gap: no
      // other transaction can change this row until this one commits.
      const rows = await tx.$queryRaw<{ id: string; status: string; eventId: string | null; participantCount: number }[]>`
        SELECT id, status, "eventId", "participantCount" FROM "Inquiry"
        WHERE id = ${id} AND "clientId" = ${client.id}
        FOR UPDATE
      `;
      const inquiry = rows[0];
      if (!inquiry) throw new NotFoundError();

      // Conditioned on the updatedAt the client loaded — if someone else (another
      // admin, or the hold-expiry cron) changed this inquiry in the meantime, this
      // matches zero rows and the request fails as a conflict, instead of
      // silently overwriting their change.
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
      // confirm/reject) stays correct. Based on the locked read above, not a
      // pre-transaction snapshot, so this can't act on a status that's already
      // stale by the time it's used.
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
    if (e instanceof NotFoundError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
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
