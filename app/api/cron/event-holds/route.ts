import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { releaseEventCapacity } from "@/lib/eventCapacity";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";

type ExpiredRow = { id: string; eventId: string | null; participantCount: number };

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Single atomic UPDATE ... RETURNING instead of read-then-write: the status
  // re-check happens in the same statement that performs the transition, so a
  // booking an admin confirmed moments earlier (no longer matching the WHERE)
  // can never be raced past. Bundled into one transaction with the capacity
  // release for the same reason B1 needed one — a crash between "mark expired"
  // and "release capacity" would otherwise leave bookedCount stuck reserved
  // for a booking that's already flagged as expired.
  const { released, errors } = await prisma.$transaction(async (tx) => {
    const expired = await tx.$queryRaw<ExpiredRow[]>`
      UPDATE "Inquiry"
      SET status = 'abgelaufen', "holdExpiresAt" = NULL
      WHERE "holdExpiresAt" < now()
        AND status IN ('neu', 'in_pruefung', 'angebot_versendet')
        AND "eventId" IS NOT NULL
      RETURNING id, "eventId", "participantCount"
    `;

    let released = 0;
    const errors: string[] = [];
    for (const inq of expired) {
      try {
        if (inq.eventId && inq.participantCount > 0) {
          await releaseEventCapacity(inq.eventId, inq.participantCount, tx);
        }
        released++;
      } catch (e) {
        errors.push(`${inq.id}: ${e}`);
      }
    }
    return { released, errors };
  });

  return NextResponse.json({ released, errors });
}
