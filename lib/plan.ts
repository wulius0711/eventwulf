export type Plan = "basis" | "pro" | "premium";

const PLAN_ORDER: Plan[] = ["basis", "pro", "premium"];

// Which plan first unlocks a given feature. Add new features here as they're gated.
const FEATURE_MIN_PLAN = {
  rooms: "pro",
} as const satisfies Record<string, Plan>;

export type Feature = keyof typeof FEATURE_MIN_PLAN;

export const PLAN_LABELS: Record<Plan, string> = { basis: "Basis", pro: "Pro", premium: "Premium" };

export function hasFeature(plan: Plan, feature: Feature): boolean {
  return PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(FEATURE_MIN_PLAN[feature]);
}

export function minPlanFor(feature: Feature): Plan {
  return FEATURE_MIN_PLAN[feature];
}

// Max rooms per client, by plan. null = unlimited.
const ROOM_LIMIT: Record<Plan, number | null> = { basis: 0, pro: 3, premium: null };

export function roomLimitFor(plan: Plan): number | null {
  return ROOM_LIMIT[plan];
}

// Max active events per client, by plan. null = unlimited. Unlike rooms,
// events are available on every plan — only the count is gated.
const EVENT_LIMIT: Record<Plan, number | null> = { basis: 3, pro: null, premium: null };

export function eventLimitFor(plan: Plan): number | null {
  return EVENT_LIMIT[plan];
}

// Max Standorte (Client slugs) per Organization, by plan. null = unlimited.
// Only the superadmin creates these today (no self-service UI), so this is
// the one thing standing between "1 Standort" on the Basis pricing card and
// it actually being true — see app/api/admin/orgs/[id]/clients/route.ts.
const LOCATION_LIMIT: Record<Plan, number | null> = { basis: 1, pro: 1, premium: null };

export function locationLimitFor(plan: Plan): number | null {
  return LOCATION_LIMIT[plan];
}

// Max team members (User rows) per Organization, by plan. null = unlimited.
const TEAM_LIMIT: Record<Plan, number | null> = { basis: 1, pro: 2, premium: null };

export function teamLimitFor(plan: Plan): number | null {
  return TEAM_LIMIT[plan];
}

export function isPlan(val: unknown): val is Plan {
  return typeof val === "string" && (PLAN_ORDER as string[]).includes(val);
}

// Thrown inside a `pg_advisory_xact_lock`-guarded transaction (see
// lib/roomAvailability.ts for the same locking pattern applied to room
// availability) when a count()-then-create()/update() limit check fails.
// Shared across the four plan-limit enforcement points (rooms, events, team,
// locations) so each can catch it and render its own message — the lock
// itself is what makes the count+write atomic, this class just carries the
// "over limit" outcome out of the transaction callback.
export class PlanLimitExceededError extends Error {}

// Statuses where Stripe has stopped collecting on an existing subscription
// but hasn't canceled it yet (see
// https://docs.stripe.com/billing/subscriptions/overview#subscription-statuses):
// "past_due" fires right after the first failed recurring charge; whether it
// later becomes "canceled" or "unpaid" depends on the Stripe account's
// dashboard retry settings, so both are covered here rather than assuming
// one. "incomplete"/"incomplete_expired" only apply to a subscription's
// *first* payment — this app collects that payment during Stripe Checkout
// itself (see app/api/signup/route.ts, app/api/stripe/checkout/route.ts), so
// they shouldn't occur in practice, but are included for defensiveness.
const PAYMENT_FAILURE_STATUSES = new Set(["past_due", "unpaid", "incomplete", "incomplete_expired"]);

// The plan to enforce right now, as opposed to `org.plan` (the plan the
// customer is actually subscribed/billed to). These differ exactly while a
// payment has failed: `org.plan` is deliberately left untouched so a later
// successful payment restores access without us needing to remember what
// they had, but every feature/limit check should gate on this instead of
// raw `org.plan` — otherwise a customer keeps full paid access for the
// entire multi-week Stripe dunning cycle before `customer.subscription.deleted`
// finally fires and resets `org.plan` itself.
//
// UI code showing the customer their plan (billing tab, upgrade button)
// should keep using `org.plan` plus a separate payment-failure notice
// instead of this — silently showing "Basis" here reads as an unannounced
// downgrade, not a payment problem to fix. See eventwulf-security-notion.md.
//
// disputeLostAt (see app/api/stripe/webhook/route.ts's charge.dispute.closed
// handling) is the same kind of effective-but-not-persisted downgrade,
// triggered by a lost chargeback instead of a failed payment — deliberately
// reusing this one mechanism rather than a second, separate access-revoking
// path. Unlike the payment-failure statuses, it's never cleared
// automatically: a lost dispute has no natural "undo" in Stripe.
export function effectivePlan(
  org: { plan?: string | null; subscriptionStatus?: string | null; disputeLostAt?: Date | string | null } | null | undefined
): Plan {
  const plan = isPlan(org?.plan) ? org.plan : "basis";
  if (org?.disputeLostAt) return "basis";
  if (org?.subscriptionStatus && PAYMENT_FAILURE_STATUSES.has(org.subscriptionStatus)) return "basis";
  return plan;
}

// Stripe's Dispute.status enum (verified against
// https://docs.stripe.com/api/disputes/object): "lost" is the only value
// meaning the dispute was resolved against us — "won", "warning_closed"
// (an inquiry that never became a formal chargeback), and the (currently
// undocumented-in-practice-here) "prevented" all mean no money was actually
// lost, so they're treated the same as a win. Pulled out as its own pure
// function — the interesting decision in the charge.dispute.closed handler,
// unit-testable without a live Stripe API call (see the webhook's own
// stripe.charges.retrieve() call, which isn't automated-test-covered for
// the same live-key reason as stripe.subscriptions.retrieve() in Phase 5).
export function disputeClosedResult(status: string): { lost: boolean } {
  return { lost: status === "lost" };
}
