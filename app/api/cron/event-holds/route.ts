import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { releaseEventCapacity } from "@/lib/eventCapacity";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Read-only scan to find candidates — not itself the source of truth for
  // what gets changed. Each row is re-validated and transitioned in its own
  // small transaction below, so a stale candidate here (already changed by
  // an admin, or a duplicate cron invocation) just gets skipped, not acted on.
  const candidates = await prisma.inquiry.findMany({
    where: {
      status: { in: ["neu", "in_pruefung", "angebot_versendet"] },
      holdExpiresAt: { lt: new Date() },
      eventId: { not: null },
    },
    select: { id: true, eventId: true, participantCount: true },
  });

  let released = 0;
  const errors: string[] = [];

  for (const row of candidates) {
    try {
      // Status transition and capacity release for THIS row, atomically
      // together — but scoped to one row, not the whole batch. A failure here
      // (e.g. releaseEventCapacity returning false because the Event was
      // deleted since the scan above) rolls back only this row's status
      // change, leaving it pending for the next cron run to retry. Other
      // rows in this same run are unaffected — the try/catch is outside the
      // transaction boundary on purpose, so it only ever reacts to an
      // already-rolled-back failure, never leaves a half-applied state.
      const acted = await prisma.$transaction(async (tx) => {
        const updated = await tx.$executeRaw`
          UPDATE "Inquiry"
          SET status = 'abgelaufen', "holdExpiresAt" = NULL
          WHERE id = ${row.id}
            AND status IN ('neu', 'in_pruefung', 'angebot_versendet')
            AND "holdExpiresAt" < now()
        `;
        if (updated === 0) return false; // changed by someone else since the scan — not an error, just skip

        if (row.eventId && row.participantCount > 0) {
          const ok = await releaseEventCapacity(row.eventId, row.participantCount, tx);
          if (!ok) throw new Error(`releaseEventCapacity found no matching Event ${row.eventId}`);
        }
        return true;
      });
      if (acted) released++;
    } catch (e) {
      console.error("event-holds cron: failed to expire inquiry", { inquiryId: row.id, error: String(e) });
      errors.push(`${row.id}: ${e}`);
    }
  }

  return NextResponse.json({ released, errors });
}
