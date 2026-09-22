import { test, expect } from "@playwright/test";
import { subscriptionSync } from "@/lib/stripe";

// Regression test for the Durchgang-1 High finding fix (webhook event
// ordering, Phase 5): app/api/stripe/webhook/route.ts now refetches a
// subscription's CURRENT state from Stripe (instead of trusting the
// possibly-stale snapshot embedded in whichever event happened to arrive —
// Stripe doesn't guarantee delivery order and explicitly warns against
// using `created` to determine it, see docs.stripe.com/webhooks#event-ordering).
// Once you have that current state, converting it to a plan+status is
// deterministic — subscriptionSync is that mapping, pulled out as its own
// pure function specifically so it's testable here without a DB or network.
//
// NOT covered here (deliberately, see maintainability backlog): the actual
// `stripe.subscriptions.retrieve()` call in the webhook route itself.
// lib/stripe.ts's `stripe` client is constructed from whatever
// STRIPE_SECRET_KEY is in the environment, and in this environment that's a
// LIVE-mode restricted key (.env.local: rk_live_...) — there is no
// sk_test_... key configured yet. An automated end-to-end test that
// exercised the real webhook route's retrieve() call would make a genuine
// outbound request against the live, bookingwulf-shared Stripe account.
// That test is deferred until a test-mode key is available for the test
// environment (tracked separately: the test server inheriting whatever key
// happens to be in .env.local, live or test, is itself a maintainability
// finding — see the backlog). Do not add a test here that calls the real
// Stripe API without one.
test.describe("subscriptionSync — deriving plan/status from a subscription's current state", () => {
  const PRO_MONTHLY_PRICE_ID = "price_1UFGZEH9wnwEESOk8MQRVHfu"; // lib/stripe.ts PRICE_IDS.pro.monthly

  function fakeSubscription(status: string, priceId?: string) {
    return { status, items: { data: priceId ? [{ price: { id: priceId } }] : [] } };
  }

  test("a canceled subscription always maps to basis, regardless of its price", () => {
    const result = subscriptionSync(fakeSubscription("canceled", PRO_MONTHLY_PRICE_ID));
    expect(result).toEqual({ subscriptionStatus: "canceled", plan: "basis" });
  });

  test("an active subscription maps to the plan matching its price", () => {
    const result = subscriptionSync(fakeSubscription("active", PRO_MONTHLY_PRICE_ID));
    expect(result).toEqual({ subscriptionStatus: "active", plan: "pro" });
  });

  test("an active subscription with an unrecognized price leaves plan unset (caller keeps the existing org.plan)", () => {
    const result = subscriptionSync(fakeSubscription("active", "price_unknown"));
    expect(result).toEqual({ subscriptionStatus: "active", plan: null });
  });

  test("a subscription with no line items at all leaves plan unset", () => {
    const result = subscriptionSync(fakeSubscription("past_due"));
    expect(result).toEqual({ subscriptionStatus: "past_due", plan: null });
  });

  test("the ordering-safety scenario: refetching a genuinely-canceled subscription yields basis even though a stale 'active' event exists", () => {
    // Simulates the bug this phase fixes: an out-of-order
    // customer.subscription.updated event (embedded snapshot says "active")
    // is delivered AFTER customer.subscription.deleted was already
    // processed. The webhook no longer trusts that embedded snapshot — it
    // refetches, gets this (the subscription's real current state), and
    // that's what subscriptionSync sees and converts.
    const whatTheStaleEventClaimed = fakeSubscription("active", PRO_MONTHLY_PRICE_ID);
    const whatStripeActuallyReturnsOnRefetch = fakeSubscription("canceled", PRO_MONTHLY_PRICE_ID);

    expect(subscriptionSync(whatTheStaleEventClaimed).plan).toBe("pro");
    // This is the one that actually gets written to the DB in the real
    // handler — the refetch result, never the stale claim above.
    expect(subscriptionSync(whatStripeActuallyReturnsOnRefetch)).toEqual({ subscriptionStatus: "canceled", plan: "basis" });
  });
});
