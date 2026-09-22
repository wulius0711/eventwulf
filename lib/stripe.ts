import Stripe from "stripe";
import type { Plan } from "@/lib/plan";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export type BillablePlan = Extract<Plan, "basis" | "pro">;
export type BillingInterval = "monthly" | "yearly";

// Premium has no fixed self-serve price — it's sold via manual sales contact,
// so it's deliberately absent here.
const PRICE_IDS: Record<BillablePlan, Record<BillingInterval, string>> = {
  basis: {
    monthly: "price_1UFGU9H9wnwEESOkhnVYK8cS",
    yearly: "price_1UFGXpH9wnwEESOk3p9PcO2G",
  },
  pro: {
    monthly: "price_1UFGZEH9wnwEESOk8MQRVHfu",
    yearly: "price_1UFGabH9wnwEESOkxpElB2Kz",
  },
};

export function priceIdFor(plan: BillablePlan, interval: BillingInterval): string {
  return PRICE_IDS[plan][interval];
}

export function planForPriceId(priceId: string): BillablePlan | null {
  for (const plan of Object.keys(PRICE_IDS) as BillablePlan[]) {
    if (Object.values(PRICE_IDS[plan]).includes(priceId)) return plan;
  }
  return null;
}

// Structural subset of Stripe.Subscription — deliberately not importing the
// real type here, so this stays trivially constructible in a test with a
// plain object literal, no `as Stripe.Subscription` cast needed.
interface SubscriptionLike {
  status: string;
  items: { data: { price: { id: string } }[] };
}

// Converts a subscription's CURRENT state (the caller is expected to have
// already refetched it — see app/api/stripe/webhook/route.ts for why:
// Stripe doesn't guarantee webhook delivery order) into what the DB should
// hold. Pulled out as its own pure function so this mapping — the part that
// actually decides "who wins" once you have the true current state — is
// unit-testable without a DB or a live Stripe API call.
export function subscriptionSync(subscription: SubscriptionLike): { subscriptionStatus: string; plan: BillablePlan | null } {
  // A canceled subscription's current price is irrelevant — access is
  // revoked regardless of what plan they were previously on.
  const priceId = subscription.items.data[0]?.price.id;
  const plan = subscription.status === "canceled" ? "basis" : priceId ? planForPriceId(priceId) : null;
  return { subscriptionStatus: subscription.status, plan };
}

// Whether this org already has a subscription that a second Checkout Session
// would duplicate rather than replace (Durchgang 3/4 finding: UpgradeButton
// unconditionally called /api/stripe/checkout, and Stripe happily creates a
// second, parallel subscription on the same customer — see
// app/api/stripe/checkout/route.ts and components/admin/UpgradeButton.tsx
// for where this is used). "canceled" and "incomplete_expired" both mean
// there's nothing left to protect against duplicating — the former is the
// normal end state after a cancellation, the latter only applies to a
// subscription's first payment, which this app always collects during
// Checkout itself (see PAYMENT_FAILURE_STATUSES in lib/plan.ts), so it
// shouldn't occur here in practice but is excluded defensively anyway.
export function hasActiveSubscription(org: { stripeSubscriptionId?: string | null; subscriptionStatus?: string | null }): boolean {
  return !!org.stripeSubscriptionId && org.subscriptionStatus !== "canceled" && org.subscriptionStatus !== "incomplete_expired";
}
