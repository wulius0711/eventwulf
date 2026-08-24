import { prisma } from "@/lib/db";

// Inquiry statuses that keep an Event's capacity hold in place.
export const HELD_STATUSES = ["neu", "in_pruefung", "angebot_versendet", "bestaetigt"];

export function isHeld(status: string): boolean {
  return HELD_STATUSES.includes(status);
}

export const HOLD_DURATION_MS = 48 * 60 * 60 * 1000; // 48h

// Atomic conditional update — the WHERE clause plus the row lock taken by
// UPDATE itself guarantee correctness under concurrent requests, no
// separate transaction/version field needed.
export async function reserveEventCapacity(eventId: string, count: number): Promise<boolean> {
  const affected = await prisma.$executeRaw`
    UPDATE "Event" SET "bookedCount" = "bookedCount" + ${count}
    WHERE id = ${eventId}
      AND "isActive" = true
      AND ("maxParticipants" IS NULL OR "bookedCount" + ${count} <= "maxParticipants")
  `;
  return affected === 1;
}

export async function releaseEventCapacity(eventId: string, count: number): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "Event" SET "bookedCount" = GREATEST("bookedCount" - ${count}, 0)
    WHERE id = ${eventId}
  `;
}
