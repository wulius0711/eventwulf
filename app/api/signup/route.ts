import { NextRequest, NextResponse } from "next/server";
import { isValidEmail, str } from "@/lib/validate";
import { rateLimit, getIp } from "@/lib/ratelimit";
import { stripe, priceIdFor, type BillablePlan, type BillingInterval } from "@/lib/stripe";

const TRIAL_DAYS = 14;

function isBillablePlan(val: unknown): val is BillablePlan {
  return val === "basis" || val === "pro";
}

function isBillingInterval(val: unknown): val is BillingInterval {
  return val === "monthly" || val === "yearly";
}

export async function POST(req: NextRequest) {
  if (!rateLimit(`signup:${getIp(req)}`, 5, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Zu viele Versuche. Bitte warte 15 Minuten." }, { status: 429 });
  }

  const { companyName, email, plan, interval, accept } = await req.json();
  const name = str(companyName, 200);
  if (!name) return NextResponse.json({ error: "Firmenname ungültig" }, { status: 400 });
  if (!isValidEmail(email)) return NextResponse.json({ error: "E-Mail ungültig" }, { status: 400 });
  if (!isBillablePlan(plan)) return NextResponse.json({ error: "Ungültiger Plan" }, { status: 400 });
  if (!isBillingInterval(interval)) return NextResponse.json({ error: "Ungültiges Intervall" }, { status: 400 });
  if (accept !== true) return NextResponse.json({ error: "Bitte AGB und Datenschutzerklärung akzeptieren." }, { status: 400 });

  const origin = req.nextUrl.origin;
  // Proof of the AGB / privacy acknowledgement (server time); kept on the session and on the subscription.
  const metadata = { signup: "true", companyName: name, plan, consent: new Date().toISOString() };
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceIdFor(plan, interval), quantity: 1 }],
    customer_email: email,
    subscription_data: { trial_period_days: TRIAL_DAYS, metadata },
    metadata,
    success_url: `${origin}/signup/complete?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/signup?cancelled=1`,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
