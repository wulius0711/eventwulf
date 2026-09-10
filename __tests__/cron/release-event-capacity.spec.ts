import { test, expect } from "@playwright/test";
import { releaseEventCapacity } from "../../lib/eventCapacity";
import { prisma } from "../helpers/testDb";

// Direct test of the new success signal releaseEventCapacity gained for
// Medium finding 2 (Durchgang 1, part 2) — event-holds' per-row transaction
// depends on this returning false when the Event no longer exists, so it can
// throw and roll back just that row instead of committing a status change
// with no matching capacity release. Called directly (not through the HTTP
// cron endpoint) because the realistic trigger — an Event deleted between the
// cron's scan and this row's own transaction — can't be constructed through
// black-box HTTP timing: Inquiry.eventId has ON DELETE SET NULL, so deleting
// the Event before the cron runs just makes the row invisible to its scan
// (eventId already null), never reaching the failure path at all. Testing
// the function directly is the more precise proof of the actual new
// behavior anyway — no detour through cron/HTTP infrastructure needed to
// verify pure function logic. lib/db.ts's own prisma export is never queried
// here (this file passes its own test-DB-scoped client explicitly), even
// though importing lib/eventCapacity.ts pulls it in as a side effect.
test.describe("releaseEventCapacity success signal", () => {
  test("returns false for an event id that no longer exists", async () => {
    const result = await releaseEventCapacity("nonexistent-event-id-does-not-exist", 5, prisma);
    expect(result).toBe(false);
  });

  test("returns true and reduces bookedCount for a real event", async () => {
    const client = await prisma.client.create({ data: { slug: `release-fn-probe-${Date.now()}`, config: "{}" } });
    const event = await prisma.event.create({
      data: { clientId: client.id, name: "probe", startDate: new Date(), endDate: new Date(), bookedCount: 5 },
    });

    const result = await releaseEventCapacity(event.id, 5, prisma);
    expect(result).toBe(true);

    const reloaded = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(reloaded.bookedCount).toBe(0);

    await prisma.event.delete({ where: { id: event.id } });
    await prisma.client.delete({ where: { id: client.id } });
  });
});
