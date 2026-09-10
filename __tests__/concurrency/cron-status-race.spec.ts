import { test, expect } from "@playwright/test";
import { prisma } from "../helpers/testDb";
import { createTestClient, createTestEvent, createTestRoom, createTestInquiry, deleteTestClient } from "../helpers/fixtures";

// Matches how Vercel actually authenticates scheduled cron invocations —
// see lib/cronAuth.ts.
const CRON_HEADERS = { authorization: "Bearer test-cron-secret" };
const PAST = new Date(Date.now() - 60_000); // already expired

// Regression test for Fund 4: the hold-expiry crons previously read an
// inquiry's status, then wrote "abgelaufen" in a separate step — an admin
// confirming the booking in between would be silently overwritten, and its
// capacity wrongly released. Both crons now use a single conditional
// UPDATE (event-holds: UPDATE ... RETURNING inside a transaction with the
// capacity release; room-holds: a plain conditional updateMany), so the
// status re-check happens atomically with the write itself.
test.describe("Cron hold-expiry status race (event-holds)", () => {
  // The cron endpoint sweeps ALL clients' expired inquiries at once (by
  // design, matching production) — running these test cases in parallel
  // would let one test's cron call race the fixtures another test case is
  // still creating within the same run.
  test.describe.configure({ mode: "serial" });
  let client: Awaited<ReturnType<typeof createTestClient>>;

  test.beforeAll(async () => {
    client = await createTestClient();
  });

  test.afterAll(async () => {
    await deleteTestClient(client.id);
  });

  test("does not touch an inquiry an admin already confirmed", async ({ request }) => {
    const event = await createTestEvent(client.id, { maxParticipants: null });
    await prisma.event.update({ where: { id: event.id }, data: { bookedCount: 4 } });
    const inquiry = await createTestInquiry(client.id, {
      eventId: event.id,
      status: "bestaetigt", // already confirmed by an "admin" before the cron runs
      participantCount: 4,
      holdExpiresAt: PAST,
    });

    const res = await request.get("/api/cron/event-holds", { headers: CRON_HEADERS });
    expect(res.status()).toBe(200);

    const reloadedInquiry = await prisma.inquiry.findUniqueOrThrow({ where: { id: inquiry.id } });
    expect(reloadedInquiry.status).toBe("bestaetigt");

    const reloadedEvent = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(reloadedEvent.bookedCount).toBe(4); // untouched, not wrongly released
  });

  test("expires a still-pending inquiry and releases its capacity exactly once", async ({ request }) => {
    const event = await createTestEvent(client.id, { maxParticipants: null });
    await prisma.event.update({ where: { id: event.id }, data: { bookedCount: 5 } });
    const inquiry = await createTestInquiry(client.id, {
      eventId: event.id,
      status: "neu",
      participantCount: 5,
      // holdExpiresAt flips to the past only as the very last setup step
      // (see cancel-cron-race.spec.ts) — set at creation time, the row would
      // be sweepable by ANY concurrently running test file's cron call
      // (fullyParallel: true) before this test's own request below fires,
      // making the below released assertion flaky.
    });
    await prisma.inquiry.update({ where: { id: inquiry.id }, data: { holdExpiresAt: PAST } });

    const first = await request.get("/api/cron/event-holds", { headers: CRON_HEADERS });
    expect(first.status()).toBe(200);
    const firstBody = await first.json();
    expect(firstBody.released).toBeGreaterThanOrEqual(1);

    const afterFirst = await prisma.inquiry.findUniqueOrThrow({ where: { id: inquiry.id } });
    expect(afterFirst.status).toBe("abgelaufen");
    expect(afterFirst.holdExpiresAt).toBeNull();

    const eventAfterFirst = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(eventAfterFirst.bookedCount).toBe(0);

    // Idempotency: a retried/duplicate cron invocation must be a no-op for
    // rows it already processed — the conditional UPDATE finds nothing left
    // to match, so it can't release the same capacity a second time.
    const second = await request.get("/api/cron/event-holds", { headers: CRON_HEADERS });
    expect(second.status()).toBe(200);

    const eventAfterSecond = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(eventAfterSecond.bookedCount).toBe(0);
  });

  test("rejects requests without the correct cron secret", async ({ request }) => {
    const res = await request.get("/api/cron/event-holds", { headers: { authorization: "Bearer wrong" } });
    expect(res.status()).toBe(401);
  });

  test("rejects the old custom x-cron-secret header — Vercel never sends it", async ({ request }) => {
    // Regression guard for the header-mismatch bug: Vercel's real cron
    // trigger sends Authorization: Bearer <secret>, never a custom header.
    // A request using the old mechanism must not be treated as authorized.
    const res = await request.get("/api/cron/event-holds", { headers: { "x-cron-secret": "test-cron-secret" } });
    expect(res.status()).toBe(401);
  });
});

test.describe("Cron hold-expiry status race (room-holds)", () => {
  let client: Awaited<ReturnType<typeof createTestClient>>;

  test.beforeAll(async () => {
    client = await createTestClient();
  });

  test.afterAll(async () => {
    await deleteTestClient(client.id);
  });

  test("does not touch a confirmed room inquiry, expires a still-pending one", async ({ request }) => {
    const room = await createTestRoom(client.id);
    const confirmed = await createTestInquiry(client.id, { roomId: room.id, status: "bestaetigt", holdExpiresAt: PAST });
    // Same flip-last requirement as above — "pending" is a real cron
    // candidate (status "neu"), so it must not sit sweepable from creation.
    const pending = await createTestInquiry(client.id, { roomId: room.id, status: "neu" });
    await prisma.inquiry.update({ where: { id: pending.id }, data: { holdExpiresAt: PAST } });

    const res = await request.get("/api/cron/room-holds", { headers: CRON_HEADERS });
    expect(res.status()).toBe(200);

    const reloadedConfirmed = await prisma.inquiry.findUniqueOrThrow({ where: { id: confirmed.id } });
    expect(reloadedConfirmed.status).toBe("bestaetigt");

    const reloadedPending = await prisma.inquiry.findUniqueOrThrow({ where: { id: pending.id } });
    expect(reloadedPending.status).toBe("abgelaufen");
  });

  test("rejects the old custom x-cron-secret header", async ({ request }) => {
    const res = await request.get("/api/cron/room-holds", { headers: { "x-cron-secret": "test-cron-secret" } });
    expect(res.status()).toBe(401);
  });
});

test.describe("Cron auth header (reminders)", () => {
  // Only the auth mechanism itself — the reminder logic is unrelated to
  // Block B and not exercised further here.
  test("accepts the real Vercel auth header, rejects the old custom one", async ({ request }) => {
    const ok = await request.get("/api/cron/reminders", { headers: CRON_HEADERS });
    expect(ok.status()).toBe(200);

    const rejected = await request.get("/api/cron/reminders", { headers: { "x-cron-secret": "test-cron-secret" } });
    expect(rejected.status()).toBe(401);
  });
});
