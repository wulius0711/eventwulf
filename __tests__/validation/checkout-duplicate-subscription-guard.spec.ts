import { test, expect } from "@playwright/test";
import { prisma } from "../helpers/testDb";
import { createTestClientWithAdmin, loginAsTestAdmin, deleteTestOrganization } from "../helpers/fixtures";

// Regression test for the duplicate-checkout finding: every standalone
// signup already has a non-canceled Stripe subscription (see
// checkout.session.completed in app/api/stripe/webhook/route.ts), so
// UpgradeButton's completely normal "upgrade to Pro" click used to call
// /api/stripe/checkout again — and Stripe happily creates a SECOND,
// parallel subscription on the same customer instead of changing the
// existing one, silently double-billing them. UpgradeButton itself now
// routes this case to the billing portal instead (see UpgradeButton.tsx);
// this test covers the server-side defense-in-depth in
// app/api/stripe/checkout/route.ts for the same case reached directly.
//
// STRIPE_SECRET_KEY in this environment is a live-mode key (see the
// maintainability backlog) — this route's happy path (an org WITHOUT an
// existing subscription actually completing a Checkout Session) stays
// deliberately untested here for that reason. What this test DOES fully
// cover, over real HTTP against the actual running route (auth, rate
// limit, DB lookup, guard — everything except the final Stripe call),
// is that the guard reliably intercepts before any Stripe client method
// is ever reached: STRIPE_CHECKOUT_FAKE_FOR_TESTS=true (set only in
// playwright.config.ts's webServer env, see the comment there) swaps in a
// fake client whose create() throws immediately. If the guard ever
// regressed, this test would see that throw surface as an unhandled
// 500 — not our expected clean 400, and never a live-mode API call either
// way.
test.describe("Duplicate-checkout guard on /api/stripe/checkout", () => {
  test("an org with an active subscription is rejected before any Stripe call is made", async ({ request }) => {
    const org = await createTestClientWithAdmin();
    await prisma.organization.update({
      where: { id: org.organization.id },
      data: { stripeCustomerId: `cus_test_${org.organization.id}`, stripeSubscriptionId: `sub_test_${org.organization.id}`, subscriptionStatus: "active" },
    });

    try {
      await loginAsTestAdmin(request, org.email, org.password);
      const res = await request.post("/api/stripe/checkout", {
        data: { plan: "pro", interval: "monthly" },
      });

      // The fake client's create() throws synchronously if ever reached —
      // an unhandled throw from inside a route handler surfaces as some
      // flavor of 500 with a body Next.js generates itself, never our own
      // { error: "..." } JSON. Getting exactly our message is proof the
      // guard returned first.
      expect(res.status()).toBe(400);
      expect((await res.json()).error).toBe("Du hast bereits ein aktives Abo. Bitte nutze die Abo-Verwaltung, um deinen Plan zu ändern.");
    } finally {
      await deleteTestOrganization(org.organization.id, org.client.id);
    }
  });

  test.describe("trialing and past_due also count as active (not just 'active')", () => {
    for (const subscriptionStatus of ["trialing", "past_due", "unpaid"]) {
      test(`subscriptionStatus "${subscriptionStatus}" is rejected the same way`, async ({ request }) => {
        const org = await createTestClientWithAdmin();
        await prisma.organization.update({
          where: { id: org.organization.id },
          data: { stripeCustomerId: `cus_test_${org.organization.id}`, stripeSubscriptionId: `sub_test_${org.organization.id}`, subscriptionStatus },
        });

        try {
          await loginAsTestAdmin(request, org.email, org.password);
          const res = await request.post("/api/stripe/checkout", { data: { plan: "pro", interval: "monthly" } });
          expect(res.status()).toBe(400);
        } finally {
          await deleteTestOrganization(org.organization.id, org.client.id);
        }
      });
    }
  });
});
