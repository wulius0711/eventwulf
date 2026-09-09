import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

type Tx = Prisma.TransactionClient;

const INACTIVE_STATUSES = ["storniert", "abgelehnt", "abgelaufen"];

export class RoomConflictError extends Error {}

function inquiryRangeOverlaps(dataJson: string, rangeStart: number, rangeEnd: number): boolean {
  try {
    const d = JSON.parse(dataJson) as { datumVon?: string; datumBis?: string };
    if (!d.datumVon || !d.datumBis) return false;
    const s = new Date(d.datumVon).getTime();
    const e = new Date(d.datumBis).getTime();
    return s <= rangeEnd && e >= rangeStart;
  } catch {
    return false;
  }
}

// Race-safe overlap check: two concurrent submissions for the SAME room must not both
// pass this check before either has actually inserted its Inquiry. pg_advisory_xact_lock
// serializes them on the room id — the second call blocks until the first transaction
// commits (or rolls back), so by the time it re-runs the query below, the first
// submission's row (if any) is already visible.
export async function assertRoomAvailable(
  tx: Tx,
  roomId: string,
  datumVon: string,
  datumBis: string
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${roomId})::bigint)`;

  const newStart = new Date(datumVon).getTime();
  const newEnd = new Date(datumBis).getTime();

  const existing = await tx.inquiry.findMany({
    where: { roomId, status: { notIn: INACTIVE_STATUSES } },
    select: { data: true },
  });

  const overlapsInquiry = existing.some((inq) => inquiryRangeOverlaps(inq.data, newStart, newEnd));
  if (overlapsInquiry) throw new RoomConflictError();

  // A room assigned to an Event is occupied for that Event's whole date range too,
  // independent of the Event's own `intern` flag (see /api/availability).
  const conflictingEvent = await tx.event.findFirst({
    where: { roomId, startDate: { lte: new Date(newEnd) }, endDate: { gte: new Date(newStart) } },
    select: { id: true },
  });
  if (conflictingEvent) throw new RoomConflictError();
}

// Read-only bulk check (no lock — used to annotate the room picker, not to reserve
// anything) for which of the given rooms are already occupied for a date range.
export async function findUnavailableRoomIds(
  roomIds: string[],
  datumVon: string,
  datumBis: string
): Promise<Set<string>> {
  if (roomIds.length === 0) return new Set();

  const newStart = new Date(datumVon).getTime();
  const newEnd = new Date(datumBis).getTime();

  const [inquiries, events] = await Promise.all([
    prisma.inquiry.findMany({
      where: { roomId: { in: roomIds }, status: { notIn: INACTIVE_STATUSES } },
      select: { roomId: true, data: true },
    }),
    prisma.event.findMany({
      where: { roomId: { in: roomIds }, startDate: { lte: new Date(newEnd) }, endDate: { gte: new Date(newStart) } },
      select: { roomId: true },
    }),
  ]);

  const unavailable = new Set<string>();
  for (const e of events) if (e.roomId) unavailable.add(e.roomId);
  for (const inq of inquiries) {
    if (inq.roomId && inquiryRangeOverlaps(inq.data, newStart, newEnd)) unavailable.add(inq.roomId);
  }
  return unavailable;
}
