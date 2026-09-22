import { randomBytes } from "crypto";
import { test, expect } from "@playwright/test";
import { stripe } from "@/lib/stripe";

// Regression test for the unified error handling in
// app/api/stripe/webhook/route.ts (Durchgang 1, Fund 4): any error while
// processing an event — a known StripeRefetchError from one of the three
// stripe.subscriptions/charges.retrieve() calls, or anything else, e.g. an
// unanticipated Prisma error — must produce a clean 500, not be silently
// swallowed and not crash unhandled, so Stripe's own retry mechanism (up to
// 3 days, exponential backoff) kicks in.
//
// This specific scenario (checkout.session.completed with a
// client_reference_id that doesn't resolve to any Organization) triggers a
// real Prisma "record not found" error (P2025) without needing any live
// Stripe API call at all — that branch is pure DB (prisma.organization.update
// with no existence check first). The three StripeRefetchError call sites
// aren't automated-test-covered for the live-key reason already tracked on
// the maintainability backlog, but they now share the exact same outer
// catch as this scenario (that's the whole point of the fix — one error
// path instead of two), so this one test verifies the mechanism all four
// sites rely on.
//
// stripe.webhooks.generateTestHeaderString() is a local, offline HMAC
// computation (per Stripe's own SDK docs: "useful for signing payloads in
// unit tests") — no network call, safe to use with the real
// STRIPE_WEBHOOK_SECRET regardless of live/test mode.
function signedWebhookRequest(eventPayload: object) {
  const payload = JSON.stringify(eventPayload);
  const secret = process.env.STRIPE_WEBHOOK_SECRET!;
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
  return { payload, signature };
}

test.describe("Stripe webhook error handling", () => {
  test("an internal error while processing an event returns a clean 500, not an unhandled crash", async ({ request }) => {
    const event = {
      id: `evt_test_${randomBytes(8).toString("hex")}`,
      object: "event",
      type: "checkout.session.completed",
      data: {
        object: {
          object: "checkout.session",
          customer: `cus_test_${randomBytes(8).toString("hex")}`,
          client_reference_id: `org_does_not_exist_${randomBytes(8).toString("hex")}`,
        },
      },
    };
    const { payload, signature } = signedWebhookRequest(event);

    const res = await request.post("/api/stripe/webhook", {
      data: payload,
      headers: { "content-type": "application/json", "stripe-signature": signature },
    });

    expect(res.status()).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Interner Fehler bei der Verarbeitung");
  });

  test("an event type with no handling branch still returns 200 (falls through cleanly)", async ({ request }) => {
    const event = {
      id: `evt_test_${randomBytes(8).toString("hex")}`,
      object: "event",
      type: "customer.created",
      data: { object: { object: "customer", id: `cus_test_${randomBytes(8).toString("hex")}` } },
    };
    const { payload, signature } = signedWebhookRequest(event);

    const res = await request.post("/api/stripe/webhook", {
      data: payload,
      headers: { "content-type": "application/json", "stripe-signature": signature },
    });

    expect(res.ok()).toBe(true);
    expect(await res.json()).toEqual({ received: true });
  });
});
