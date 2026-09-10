import { test, expect } from "@playwright/test";
import { prisma } from "../helpers/testDb";
import { createTestClientWithAdmin, createTestEvent, createTestInquiry, deleteTestOrganization } from "../helpers/fixtures";

const CRON_HEADERS = { authorization: "Bearer test-cron-secret" };
const PAST = new Date(Date.now() - 60_000);

// Regression test for Medium finding 2 (Durchgang 1, part 2): one row's
// per-row transaction failing/skipping must not affect any other row in the
// same cron run — event-holds now runs each row in its own transaction with
// the try/catch outside the transaction boundary, instead of one shared
// transaction for the whole batch.
//
// The updated === 0 guard (an Inquiry row that changed between the cron's
// scan and its own turn) is used as the trigger here, not a genuinely
// nonexistent Event — that specific case is proven separately and more
// directly in release-event-capacity.spec.ts, since it can't be reproduced
// through black-box HTTP timing (Inquiry.eventId has ON DELETE SET NULL, so
// deleting the Event before the cron runs just makes the row invisible to
// the scan, never reaching the failure path). Both guards live in the same
// per-row transaction and both roll back only that one row on a mismatch, so
// proving isolation via either one demonstrates the same structural property.
test.describe("event-holds cron: one row's outcome does not affect others", () => {
  test.describe.configure({ mode: "serial" });
  let org: Awaited<ReturnType<typeof createTestClientWithAdmin>>;

  test.beforeAll(async () => {
    org = await createTestClientWithAdmin();
  });

  test.afterAll(async () => {
    await deleteTestOrganization(org.organization.id, org.client.id);
  });

  test("other rows expire and release capacity correctly regardless of one row's race", async ({ request }) => {
    // Three unrelated, "clean" rows that should always succeed.
    const controls = await Promise.all(
      Array.from({ length: 3 }, async () => {
        const event = await createTestEvent(org.client.id, { maxParticipants: null });
        await prisma.event.update({ where: { id: event.id }, data: { bookedCount: 4 } });
        const inquiry = await createTestInquiry(org.client.id, {
          eventId: event.id,
          status: "neu",
          participantCount: 4,
        });
        await prisma.inquiry.update({ where: { id: inquiry.id }, data: { holdExpiresAt: PAST } });
        return { event, inquiry };
      })
    );

    // A fourth row that a concurrent write races against the cron for — best
    // effort at landing between the cron's scan and this row's own turn, not
    // a guaranteed hit (see the file comment above for why this can't be
    // deterministic from outside). The assertions below only rely on the
    // other three rows, which is the actual property under test.
    const racedEvent = await createTestEvent(org.client.id, { maxParticipants: null });
    await prisma.event.update({ where: { id: racedEvent.id }, data: { bookedCount: 4 } });
    const racedInquiry = await createTestInquiry(org.client.id, {
      eventId: racedEvent.id,
      status: "neu",
      participantCount: 4,
    });
    await prisma.inquiry.update({ where: { id: racedInquiry.id }, data: { holdExpiresAt: PAST } });

    await Promise.all([
      request.get("/api/cron/event-holds", { headers: CRON_HEADERS }),
      prisma.inquiry.update({ where: { id: racedInquiry.id }, data: { status: "bestaetigt", holdExpiresAt: null } }),
    ]);

    for (const { event, inquiry } of controls) {
      const reloadedInquiry = await prisma.inquiry.findUniqueOrThrow({ where: { id: inquiry.id } });
      expect(reloadedInquiry.status).toBe("abgelaufen");

      const reloadedEvent = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
      expect(reloadedEvent.bookedCount).toBe(0); // 4 released, not left inflated or double-released
    }

    // The raced row's capacity must have been released at most once, whichever
    // way the race resolved — never left inconsistent (e.g. status flipped
    // without a matching release, or released twice).
    const reloadedRacedEvent = await prisma.event.findUniqueOrThrow({ where: { id: racedEvent.id } });
    expect([0, 4]).toContain(reloadedRacedEvent.bookedCount);
  });
});
