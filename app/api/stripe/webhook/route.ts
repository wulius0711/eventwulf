import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { randomBytes } from "crypto";
import { hashSync } from "bcryptjs";
import { prisma } from "@/lib/db";
import { loadConfig } from "@/lib/loadConfig";
import { stripe, planForPriceId } from "@/lib/stripe";

// Stripe needs the raw body to verify the webhook signature — Next.js route
// handlers don't parse bodies automatically, so req.text() below already
// gives us the untouched payload.
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook nicht konfiguriert" }, { status: 500 });

  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Fehlende Signatur" }, { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "Ungültige Signatur" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const checkoutSession = event.data.object as Stripe.Checkout.Session;
      if (typeof checkoutSession.customer !== "string") break;

      const organizationId = checkoutSession.client_reference_id;
      if (organizationId) {
        // Existing org (from the in-app upgrade flow) subscribing/upgrading.
        await prisma.organization.update({
          where: { id: organizationId },
          data: { stripeCustomerId: checkoutSession.customer },
        });
        break;
      }

      // No client_reference_id — this is a standalone signup (app/api/signup).
      // The org doesn't exist yet; create it now that payment has succeeded.
      const meta = checkoutSession.metadata;
      const email = checkoutSession.customer_details?.email ?? checkoutSession.customer_email;
      if (meta?.signup !== "true" || !meta.companyName || !email) break;
      if (meta.plan !== "basis" && meta.plan !== "pro") break;

      // Idempotency guard — Stripe can redeliver the same event.
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) break;

      const slug = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "-") + "-" + randomBytes(3).toString("hex");
      const defaultConfig = loadConfig("default");

      await prisma.organization.create({
        data: {
          name: meta.companyName,
          plan: meta.plan,
          stripeCustomerId: checkoutSession.customer,
          subscriptionStatus: "trialing",
          clients: { create: { slug, config: JSON.stringify(defaultConfig) } },
          users: { create: { email, password: hashSync(randomBytes(32).toString("hex"), 12) } },
        },
      });
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      if (typeof subscription.customer !== "string") break;

      const org = await prisma.organization.findUnique({ where: { stripeCustomerId: subscription.customer } });
      if (!org) break; // webhook arrived before checkout.session.completed created the org — a later update will sync it

      const priceId = subscription.items.data[0]?.price.id;
      const plan = priceId ? planForPriceId(priceId) : null;

      await prisma.organization.update({
        where: { id: org.id },
        data: {
          stripeSubscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
          ...(plan ? { plan } : {}),
        },
      });
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      if (typeof subscription.customer !== "string") break;

      const org = await prisma.organization.findUnique({ where: { stripeCustomerId: subscription.customer } });
      if (!org) break;

      await prisma.organization.update({
        where: { id: org.id },
        data: { subscriptionStatus: "canceled", plan: "basis" },
      });
      break;
    }
  }

  return NextResponse.json({ received: true });
}
