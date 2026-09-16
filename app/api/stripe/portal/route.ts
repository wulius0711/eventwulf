import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const org = await prisma.organization.findUnique({ where: { id: session.organizationId } });
  if (!org) return NextResponse.json({ error: "Organisation nicht gefunden" }, { status: 404 });
  if (!org.stripeCustomerId) {
    return NextResponse.json({ error: "Kein Stripe-Kunde für diese Organisation hinterlegt" }, { status: 400 });
  }

  const origin = req.nextUrl.origin;
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    return_url: `${origin}/admin/config?tab=abrechnung`,
    // Dedicated configuration so the portal shows eventwulf's own branding —
    // the Stripe account is shared with bookingwulf, and without this the
    // portal falls back to the account's generic default configuration.
    configuration: process.env.STRIPE_PORTAL_CONFIGURATION_ID,
  });

  return NextResponse.json({ url: portalSession.url });
}
