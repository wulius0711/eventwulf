import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";
import { stripe, priceIdFor, type BillablePlan, type BillingInterval } from "@/lib/stripe";

function isBillablePlan(val: unknown): val is BillablePlan {
  return val === "basis" || val === "pro";
}

function isBillingInterval(val: unknown): val is BillingInterval {
  return val === "monthly" || val === "yearly";
}

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
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceIdFor(plan, interval), quantity: 1 }],
    customer: org.stripeCustomerId ?? undefined,
    customer_email: org.stripeCustomerId ? undefined : session.email,
    client_reference_id: org.id,
    subscription_data: { metadata: { organizationId: org.id } },
    success_url: `${origin}/admin/config?billing=success`,
    cancel_url: `${origin}/admin/config?billing=cancelled`,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
