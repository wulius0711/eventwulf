import { test, expect } from "@playwright/test";
import { prisma } from "../helpers/testDb";
import { createTestClientWithAdmin, loginAsTestAdmin, createTestEvent, createTestInquiry, deleteTestOrganization } from "../helpers/fixtures";

const CRON_HEADERS = { authorization: "Bearer test-cron-secret" };
const PAST = new Date(Date.now() - 60_000);

// Regression test for Medium finding 1: does a real concurrent admin-cancel
// vs. cron-expiry race on the same inquiry release event capacity exactly
// once? A second inquiry on the same event holds an unrelated, legitimate
// reservation specifically so a double-release is observable — bookedCount
// alone can't distinguish "released once" from "released twice" once it
// hits its GREATEST(...,0) floor, since both attempts would just clamp to 0.
test.describe("Cancel vs. cron-expiry race releases capacity exactly once", () => {
  // The cron endpoint sweeps ALL clients' expired inquiries at once — running
  // these test cases in parallel would let one test's cron call race the
  // fixtures another test case is still creating within the same run (same
  // lesson as cron-status-race.spec.ts).
  test.describe.configure({ mode: "serial" });
  let org: Awaited<ReturnType<typeof createTestClientWithAdmin>>;

  test.beforeAll(async () => {
    org = await createTestClientWithAdmin();
  });

  test.afterAll(async () => {
    await deleteTestOrganization(org.organization.id, org.client.id);
  });

  test("bookedCount reflects exactly one release, not two", async ({ request }) => {
    const event = await createTestEvent(org.client.id, { maxParticipants: null });

    // Created with holdExpiresAt: null (not yet cron-eligible) on purpose —
    // the cron sweeps ALL clients globally, so a row created already-expired
    // is a moving target for any *other* spec file's concurrent cron call
    // during the several awaits below, well before this test's own race even
    // starts. holdExpiresAt only flips to the past as the very last setup
    // step, right before firing the race, to keep that window as small as
    // the one this test is actually trying to test.
    const raceInquiry = await createTestInquiry(org.client.id, {
      eventId: event.id,
      status: "neu",
      participantCount: 5,
    });
    // Unrelated, legitimate reservation on the same event — untouched by this race.
    await createTestInquiry(org.client.id, {
      eventId: event.id,
      status: "bestaetigt",
      participantCount: 3,
    });
    await prisma.event.update({ where: { id: event.id }, data: { bookedCount: 8 } }); // 5 + 3
    await loginAsTestAdmin(request, org.email, org.password);

    const expired = await prisma.inquiry.update({ where: { id: raceInquiry.id }, data: { holdExpiresAt: PAST } });

    const [patchRes, cronRes] = await Promise.all([
      request.patch("/api/admin/inquiries", {
        data: { id: raceInquiry.id, status: "storniert", updatedAt: expired.updatedAt.toISOString() },
      }),
      request.get("/api/cron/event-holds", { headers: CRON_HEADERS }),
    ]);

    expect(cronRes.status()).toBe(200);
    // Either outcome is acceptable for the PATCH — it may win the race (200)
    // or lose it because the cron got there first (409 via the updatedAt
    // guard). What matters is bookedCount below, not which one "won".
    expect([200, 409]).toContain(patchRes.status());

    const reloadedEvent = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(reloadedEvent.bookedCount).toBe(3); // only the raced inquiry's 5 released, not 10
  });

  test("cron running first does not let a stale-updatedAt cancel PATCH release capacity again", async ({ request }) => {
    // Promise.all doesn't guarantee ordering — this test forces the one
    // sequence that's actually dangerous: the cron's raw SQL UPDATE changes
    // status but never touches updatedAt (verified directly against the DB
    // beforehand), so an admin's PATCH sent with the updatedAt they loaded
    // *before* the cron ran could still pass the updatedAt guard even though
    // the row already changed underneath it.
    const event = await createTestEvent(org.client.id, { maxParticipants: null });

    // Same reasoning as the test above: created not-yet-expired, flipped to
    // expired as the last setup step, to keep the window small.
    const raceInquiry = await createTestInquiry(org.client.id, {
      eventId: event.id,
      status: "neu",
      participantCount: 5,
    });
    await createTestInquiry(org.client.id, { eventId: event.id, status: "bestaetigt", participantCount: 3 });
    await prisma.event.update({ where: { id: event.id }, data: { bookedCount: 8 } });

    const expired = await prisma.inquiry.update({ where: { id: raceInquiry.id }, data: { holdExpiresAt: PAST } });
    const staleUpdatedAt = expired.updatedAt.toISOString();

    // Cron runs first, to completion.
    const cronRes = await request.get("/api/cron/event-holds", { headers: CRON_HEADERS });
    expect(cronRes.status()).toBe(200);

    const afterCron = await prisma.inquiry.findUniqueOrThrow({ where: { id: raceInquiry.id } });
    expect(afterCron.status).toBe("abgelaufen");
    expect(afterCron.updatedAt.toISOString()).toBe(staleUpdatedAt); // confirms the raw UPDATE left it untouched

    const eventAfterCron = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(eventAfterCron.bookedCount).toBe(3); // cron correctly released the 5

    // Admin's browser still holds the updatedAt from before the cron ran.
    await loginAsTestAdmin(request, org.email, org.password);
    const patchRes = await request.patch("/api/admin/inquiries", {
      data: { id: raceInquiry.id, status: "storniert", updatedAt: staleUpdatedAt },
    });

    const eventAfterPatch = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    // Whether the PATCH is accepted or rejected, capacity must not move again —
    // the unrelated inquiry's 3 must survive either way.
    expect(eventAfterPatch.bookedCount).toBe(3);
    if (patchRes.status() === 200) {
      // If the guard let it through despite the stale value, at least the
      // capacity logic must not have double-released — already checked above.
    } else {
      expect(patchRes.status()).toBe(409);
    }
  });
});
