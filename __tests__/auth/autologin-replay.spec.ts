import { test, expect } from "@playwright/test";
import { createHmac } from "crypto";
import { prisma } from "../helpers/testDb";
import { createTestClientWithAdmin, deleteTestOrganization } from "../helpers/fixtures";

// Regression test for Medium finding 9 (Durchgang 2, part 3): /api/autologin
// only checked the HMAC signature and a 60s time window — a token
// intercepted and replayed within that window was accepted a second time.
// A UsedAutologinToken row is now inserted on first use, keyed by a hash of
// the signature, with a unique constraint doing the actual replay-blocking
// (an INSERT that can't succeed twice for the same key) — deliberately not
// an in-memory Set, which wouldn't be shared across serverless instances
// (the same reason lib/ratelimit.ts's in-memory limiter is disabled, not
// relied on, for real protection in this suite).
test.describe("Autologin replay protection", () => {
  let org: Awaited<ReturnType<typeof createTestClientWithAdmin>>;
  const bookingAppKey = "test-booking-app-key";

  test.beforeAll(async () => {
    org = await createTestClientWithAdmin();
    await prisma.organization.update({ where: { id: org.organization.id }, data: { bookingAppKey } });
  });

  test.afterAll(async () => {
    await deleteTestOrganization(org.organization.id, org.client.id);
  });

  function autologinUrl(orgId: string, ts: number) {
    const sig = createHmac("sha256", bookingAppKey).update(`autologin:${orgId}:${ts}`).digest("hex");
    return `/api/autologin?orgId=${orgId}&ts=${ts}&sig=${sig}`;
  }

  test("a valid token works once; replaying the exact same token afterwards is rejected", async ({ request }) => {
    const url = autologinUrl(org.organization.id, Date.now());

    const first = await request.get(url, { maxRedirects: 0 });
    expect(first.status()).toBeLessThan(400);
    expect(first.headers()["set-cookie"]).toBeTruthy();

    const second = await request.get(url, { maxRedirects: 0 });
    expect(second.status()).toBe(401);
  });

  test("two genuinely concurrent requests with the same token: exactly one succeeds", async ({ request }) => {
    const url = autologinUrl(org.organization.id, Date.now());

    const [a, b] = await Promise.all([
      request.get(url, { maxRedirects: 0 }),
      request.get(url, { maxRedirects: 0 }),
    ]);

    // Ascending sort: the successful redirect (< 400) sorts before the
    // rejected replay (401), not the other way round.
    const statuses = [a.status(), b.status()].sort((x, y) => x - y);
    expect(statuses[0]).toBeLessThan(400);
    expect(statuses[1]).toBe(401);
  });

  test("a different, never-used token still works normally", async ({ request }) => {
    const url = autologinUrl(org.organization.id, Date.now());
    const res = await request.get(url, { maxRedirects: 0 });
    expect(res.status()).toBeLessThan(400);
  });
});
