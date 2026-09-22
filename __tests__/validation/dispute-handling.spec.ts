import { test, expect } from "@playwright/test";
import { disputeClosedResult } from "@/lib/plan";
import { prisma } from "../helpers/testDb";
import { createTestClientWithAdmin, createTestRoom, loginAsTestAdmin, deleteTestOrganization } from "../helpers/fixtures";

// Regression test for the chargeback-handling product decision: opening a
// dispute (charge.dispute.created) is purely an admin-visibility marker,
// with NO effect on effectivePlan()/access — only a LOST dispute
// (charge.dispute.closed with status "lost") triggers the same
// effective-but-not-persisted downgrade to Basis already used for
// past_due/unpaid (Phase 1). See app/api/stripe/webhook/route.ts and
// lib/plan.ts.
//
// The webhook's own stripe.charges.retrieve() call (needed to resolve the
// org from a Dispute, which has no direct customer reference) is
// deliberately NOT covered by an automated test here, for the same reason
// as stripe.subscriptions.retrieve() in Phase 5: this environment's
// STRIPE_SECRET_KEY is a live-mode key, and there's no test-mode key yet.
// See the maintainability backlog.
test.describe("disputeClosedResult — deciding won vs. lost from Stripe's Dispute.status", () => {
  // Verified against https://docs.stripe.com/api/disputes/object: "lost" is
  // the only status meaning the dispute was resolved against us. "won",
  // "warning_closed" (an inquiry that never became a formal chargeback),
  // and "prevented" all mean no money was actually lost.
  test("status 'lost' is treated as lost", () => {
    expect(disputeClosedResult("lost")).toEqual({ lost: true });
  });

  test("status 'won' is not treated as lost", () => {
    expect(disputeClosedResult("won")).toEqual({ lost: false });
  });

  test("status 'warning_closed' (inquiry never became a formal dispute) is not treated as lost", () => {
    expect(disputeClosedResult("warning_closed")).toEqual({ lost: false });
  });

  test("status 'prevented' is not treated as lost", () => {
    expect(disputeClosedResult("prevented")).toEqual({ lost: false });
  });
});

test.describe("Plan enforcement around a chargeback", () => {
  test.describe.configure({ mode: "serial" });
  let org: Awaited<ReturnType<typeof createTestClientWithAdmin>>;
  let roomId: string;

  test.beforeAll(async () => {
    org = await createTestClientWithAdmin();
    await prisma.organization.update({ where: { id: org.organization.id }, data: { plan: "premium", subscriptionStatus: "active" } });
    const room = await createTestRoom(org.client.id, { name: "Premium Room" });
    roomId = room.id;
  });

  test.afterAll(async () => {
    await deleteTestOrganization(org.organization.id, org.client.id);
  });

  test("an OPEN dispute (disputeOpenedAt set) has no effect on access", async ({ request }) => {
    // Simulates what charge.dispute.created writes — see the webhook.
    await prisma.organization.update({ where: { id: org.organization.id }, data: { disputeOpenedAt: new Date() } });

    await loginAsTestAdmin(request, org.email, org.password);
    const res = await request.get("/api/admin/rooms");
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.plan).toBe("premium");
    expect(body.limit).toBeNull();
  });

  test("a WON dispute (disputeOpenedAt cleared, disputeLostAt never set) keeps access unaffected", async ({ request }) => {
    // Simulates what charge.dispute.closed writes on a win — see the webhook.
    await prisma.organization.update({ where: { id: org.organization.id }, data: { disputeOpenedAt: null } });

    await loginAsTestAdmin(request, org.email, org.password);
    const res = await request.get("/api/admin/rooms");
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.plan).toBe("premium");
  });

  test("a LOST dispute (disputeLostAt set) locks access even though org.plan is still premium in the DB", async ({ request }) => {
    // Simulates what charge.dispute.closed writes on a loss — see the webhook.
    await prisma.organization.update({ where: { id: org.organization.id }, data: { disputeOpenedAt: null, disputeLostAt: new Date() } });

    await loginAsTestAdmin(request, org.email, org.password);
    const res = await request.get("/api/admin/rooms");
    expect(res.status()).toBe(403); // Rooms needs Pro+; effectivePlan() is now "basis"

    // The subscribed plan itself is untouched, same reasoning as the
    // payment-failure case (Phase 1) — this is an effective, not a
    // persisted, downgrade.
    const dbOrg = await prisma.organization.findUniqueOrThrow({ where: { id: org.organization.id } });
    expect(dbOrg.plan).toBe("premium");
  });

  test("the public widget also hides the room while the dispute is lost, though the row still exists", async ({ request }) => {
    const res = await request.get(`/api/rooms?slug=${org.client.slug}`);
    expect(res.ok()).toBe(true);
    const rooms = await res.json();
    expect(rooms).toHaveLength(0);

    const stillExists = await prisma.room.findUnique({ where: { id: roomId } });
    expect(stillExists).not.toBeNull();
  });

  test("a subsequent successful payment (subscriptionStatus active again) does NOT lift the lost-dispute lock", async ({ request }) => {
    // A lost dispute has no natural "undo" in Stripe — effectivePlan()
    // deliberately never clears disputeLostAt on its own (see lib/plan.ts).
    await prisma.organization.update({ where: { id: org.organization.id }, data: { subscriptionStatus: "active" } });

    await loginAsTestAdmin(request, org.email, org.password);
    const res = await request.get("/api/admin/rooms");
    expect(res.status()).toBe(403);
  });
});
