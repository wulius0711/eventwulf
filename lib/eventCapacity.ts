import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

type Tx = Prisma.TransactionClient;

// Inquiry statuses that keep an Event's capacity hold in place.
export const HELD_STATUSES = ["neu", "in_pruefung", "angebot_versendet", "bestaetigt"];

export function isHeld(status: string): boolean {
  return HELD_STATUSES.includes(status);
}

export const HOLD_DURATION_MS = 48 * 60 * 60 * 1000; // 48h

export class CapacityExceededError extends Error {}

// Atomic conditional update — the WHERE clause plus the row lock taken by
// UPDATE itself guarantee correctness under concurrent requests, no
// separate transaction/version field needed. Accepts an optional transaction
// client so callers that also write an Inquiry in the same operation (submit,
// admin status update) can make both writes atomic — see callers for why
// that matters (a crash between the two would otherwise leak capacity).
export async function reserveEventCapacity(eventId: string, count: number, client: Tx | typeof prisma = prisma): Promise<boolean> {
  const affected = await client.$executeRaw`
    UPDATE "Event" SET "bookedCount" = "bookedCount" + ${count}
    WHERE id = ${eventId}
      AND "isActive" = true
      AND ("maxParticipants" IS NULL OR "bookedCount" + ${count} <= "maxParticipants")
  `;
  return affected === 1;
}

// Returns whether the Event row was actually found and updated — e.g. false
// if it was deleted since the caller last looked at it. Callers that need to
// treat a failed release as an error (not just a silent no-op) check this.
export async function releaseEventCapacity(eventId: string, count: number, client: Tx | typeof prisma = prisma): Promise<boolean> {
  const affected = await client.$executeRaw`
    UPDATE "Event" SET "bookedCount" = GREATEST("bookedCount" - ${count}, 0)
    WHERE id = ${eventId}
  `;
  return affected > 0;
}
