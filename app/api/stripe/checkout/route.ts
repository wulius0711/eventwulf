import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";
import { stripe, priceIdFor, hasActiveSubscription, type BillablePlan, type BillingInterval } from "@/lib/stripe";

function isBillablePlan(val: unknown): val is BillablePlan {
  return val === "basis" || val === "pro";
}

function isBillingInterval(val: unknown): val is BillingInterval {
  return val === "monthly" || val === "yearly";
}

// Structural subset of Stripe's checkout.sessions resource — same reasoning
// as SubscriptionLike in lib/stripe.ts: only the one method this route
// actually calls, so a test can swap in a fake without needing the real
// Stripe SDK's full shape.
interface CheckoutSessionsClient {
  create(params: Stripe.Checkout.SessionCreateParams): Promise<Stripe.Checkout.Session>;
}

// DI, same shape as recordSignupCardFingerprint (lib/trialAbuse.ts): a real
// default for production, a swappable client for tests. Pulled out of POST
// so the guard-then-create decision is one small, directly-testable unit —
// this is the fix for the duplicate-checkout finding: an org that already
// has a non-canceled Stripe subscription would otherwise get a SECOND,
// parallel one from a fresh Checkout Session (Stripe allows this without
// complaint), silently double-billing them. See hasActiveSubscription() in
// lib/stripe.ts and UpgradeButton.tsx, which routes this same case to the
// billing portal instead of ever calling this endpoint — this is the
// server-side defense-in-depth for the same gap if reached directly.
export async function createCheckoutSession(
  org: { id: string; stripeCustomerId: string | null; stripeSubscriptionId?: string | null; subscriptionStatus?: string | null },
  plan: BillablePlan,
  interval: BillingInterval,
  origin: string,
  customerEmail: string,
  sessionsClient: CheckoutSessionsClient = stripe.checkout.sessions
): Promise<{ ok: true; url: string | null } | { ok: false; status: number; error: string }> {
  // Runs, and returns, before any Stripe API call is made — no live-mode
  // request happens on this path, regardless of which sessionsClient was
  // passed in.
  if (hasActiveSubscription(org)) {
    return { ok: false, status: 400, error: "Du hast bereits ein aktives Abo. Bitte nutze die Abo-Verwaltung, um deinen Plan zu ändern." };
  }

  const checkoutSession = await sessionsClient.create({
    mode: "subscription",
    line_items: [{ price: priceIdFor(plan, interval), quantity: 1 }],
    customer: org.stripeCustomerId ?? undefined,
    customer_email: org.stripeCustomerId ? undefined : customerEmail,
    client_reference_id: org.id,
    subscription_data: { metadata: { organizationId: org.id } },
    success_url: `${origin}/admin/config?billing=success`,
    cancel_url: `${origin}/admin/config?billing=cancelled`,
  });
  return { ok: true, url: checkoutSession.url };
}

// Test-only stand-in for the real Stripe client, wired in below only when
// STRIPE_CHECKOUT_FAKE_FOR_TESTS=true — set exclusively in
// playwright.config.ts's webServer env, the same pattern as
// RATELIMIT_DISABLED: never reachable through any request header or body,
// so this isn't a new attack surface. This route's happy path (an org
// WITHOUT an existing subscription actually completing a Checkout Session)
// stays untested by an automated test for the standing live-key reason
// (STRIPE_SECRET_KEY here is a live-mode key — see the maintainability
// backlog) — but the guard itself is now fully, safely testable over real
// HTTP: create() throws immediately, so if the guard above ever regressed
// and let a request through, a test would see a clean, distinctive crash
// instead of a silent live-mode API call.
const testFakeCheckoutClient: CheckoutSessionsClient = {
  async create() {
    throw new Error("checkout/route.ts: fake Stripe client reached under test — the active-subscription guard should have returned before this call.");
  },
};

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  // Durchgang 1, Fund 2: this endpoint was completely unlimited — every call
  // is a real Stripe Checkout Session creation against the bookingwulf-shared
  // account. Keyed on organizationId, not IP (unlike /api/signup): the
  // caller is already authenticated, so the org id is a server-verified
  // identity, not something spoofable the way getIp()'s X-Forwarded-For
  // parsing is (see the cross-cutting finding on that helper).
  if (!(await rateLimit(`stripe-checkout:${session.organizationId}`, 10, 60 * 60 * 1000))) {
    return NextResponse.json({ error: "Zu viele Versuche. Bitte warte eine Stunde." }, { status: 429 });
  }

  const { plan, interval } = await req.json();
  if (!isBillablePlan(plan) || !isBillingInterval(interval)) {
    return NextResponse.json({ error: "Ungültiger Plan" }, { status: 400 });
  }

  const org = await prisma.organization.findUnique({ where: { id: session.organizationId } });
  if (!org) return NextResponse.json({ error: "Organisation nicht gefunden" }, { status: 404 });

  const origin = req.nextUrl.origin;
  const result = await createCheckoutSession(
    org,
    plan,
    interval,
    origin,
    session.email,
    process.env.STRIPE_CHECKOUT_FAKE_FOR_TESTS === "true" ? testFakeCheckoutClient : undefined
  );

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ url: result.url });
}
