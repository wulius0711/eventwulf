import { test, expect } from "@playwright/test";
import { hasActiveSubscription } from "@/lib/stripe";

// Regression test for the duplicate-checkout finding: UpgradeButton
// (components/admin/UpgradeButton.tsx) unconditionally called
// /api/stripe/checkout, and every standalone signup already has a
// non-canceled subscription (see checkout.session.completed in
// app/api/stripe/webhook/route.ts) — so a completely normal "upgrade to
// Pro" click created a SECOND, parallel Stripe subscription on the same
// customer instead of changing the existing one. hasActiveSubscription()
// is the pure decision both the fixed UpgradeButton (route to the billing
// portal instead) and the server-side guard in
// app/api/stripe/checkout/route.ts (defense-in-depth, reject directly) are
// built on. Pure and DB/network-free, so fully testable here.
test.describe("hasActiveSubscription — does this org already have a subscription a second checkout would duplicate?", () => {
  test("no stripeSubscriptionId at all — never subscribed (e.g. an admin-provisioned org, see app/api/provision/route.ts)", () => {
    expect(hasActiveSubscription({ stripeSubscriptionId: null, subscriptionStatus: null })).toBe(false);
  });

  test("an active subscription counts as active", () => {
    expect(hasActiveSubscription({ stripeSubscriptionId: "sub_1", subscriptionStatus: "active" })).toBe(true);
  });

  test("a trialing subscription counts as active — this is the common case right after standalone signup", () => {
    expect(hasActiveSubscription({ stripeSubscriptionId: "sub_1", subscriptionStatus: "trialing" })).toBe(true);
  });

  test("past_due/unpaid still count as active — the subscription still exists and would still be duplicated", () => {
    expect(hasActiveSubscription({ stripeSubscriptionId: "sub_1", subscriptionStatus: "past_due" })).toBe(true);
    expect(hasActiveSubscription({ stripeSubscriptionId: "sub_1", subscriptionStatus: "unpaid" })).toBe(true);
  });

  test("a canceled subscription does not count as active — nothing left to duplicate, a fresh checkout is fine", () => {
    expect(hasActiveSubscription({ stripeSubscriptionId: "sub_1", subscriptionStatus: "canceled" })).toBe(false);
  });

  test("incomplete_expired does not count as active (defensive — shouldn't occur since this app collects the first payment during Checkout itself)", () => {
    expect(hasActiveSubscription({ stripeSubscriptionId: "sub_1", subscriptionStatus: "incomplete_expired" })).toBe(false);
  });
});
