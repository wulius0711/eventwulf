import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";

// Called by /signup/complete after Stripe redirects back. Verifies the
// Checkout Session with Stripe itself (never trusts the session_id's mere
// presence) and reports once the account exists — the webhook is what
// actually creates the Organization/User, so this can run before that
// webhook has landed, hence "pending" instead of an error.
//
// Deliberately does NOT log the user in: an auto-login here meant nobody
// ever checked the welcome email to set a real password (why would they —
// they're already in), only to be locked out for good once that session
// cookie expired days later with no known password. Sending them to their
// inbox now, while they're still on the signup page and expecting it, is
// the only reliable way to make sure a password actually gets set.
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");
  if (!sessionId || !sessionId.startsWith("cs_")) {
    return NextResponse.json({ error: "Ungültige Session" }, { status: 400 });
  }

  const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);
  if (checkoutSession.status !== "complete") {
    return NextResponse.json({ error: "Zahlung nicht abgeschlossen" }, { status: 400 });
  }

  const email = checkoutSession.customer_details?.email ?? checkoutSession.customer_email;
  if (!email) return NextResponse.json({ error: "Keine E-Mail gefunden" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email }, select: { organizationId: true } });

  if (!user?.organizationId) {
    // Webhook hasn't created the account yet — client should retry shortly.
    return NextResponse.json({ pending: true });
  }

  return NextResponse.json({ ok: true });
}
