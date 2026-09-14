import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signToken, cookieName, cookieOptions } from "@/lib/auth";
import { stripe } from "@/lib/stripe";

// Called by /signup/complete after Stripe redirects back. Verifies the
// Checkout Session with Stripe itself (never trusts the session_id's mere
// presence) and logs the newly-created user in — the webhook is what
// actually creates the Organization/User, so this can run before that
// webhook has landed, hence "pending" instead of an error.
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

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      organization: {
        include: { clients: { select: { slug: true }, orderBy: { createdAt: "asc" }, take: 1 } },
      },
    },
  });

  if (!user?.organization) {
    // Webhook hasn't created the account yet — client should retry shortly.
    return NextResponse.json({ pending: true });
  }

  const clientSlug = user.organization.clients[0]?.slug ?? "";
  const token = await signToken({
    userId: user.id,
    organizationId: user.organization.id,
    clientSlug,
    email: user.email,
    pwChangedAt: user.passwordChangedAt?.getTime() ?? 0,
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookieName(), token, cookieOptions());
  return res;
}
