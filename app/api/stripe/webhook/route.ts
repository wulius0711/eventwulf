import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { randomBytes } from "crypto";
import { hashSync } from "bcryptjs";
import { Resend } from "resend";
import { prisma } from "@/lib/db";
import { loadConfig } from "@/lib/loadConfig";
import { stripe, planForPriceId } from "@/lib/stripe";
import { sanitizeEmailHeader } from "@/lib/validate";
import { resolveBaseUrl } from "@/app/api/submit/route";

// Matches the team-invite TTL (app/api/admin/team/route.ts) — well within
// the 14-day trial, so a new signup always has time to set a password.
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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

      // No password is set here — same reason as a team invite (see
      // app/api/admin/team/route.ts): the account owner can't know a
      // password we never showed them. They set their own via the invite
      // link below, using the same /admin/invite/[token] flow.
      const inviteToken = randomBytes(32).toString("hex");
      await prisma.organization.create({
        data: {
          name: meta.companyName,
          plan: meta.plan,
          stripeCustomerId: checkoutSession.customer,
          subscriptionStatus: "trialing",
          clients: { create: { slug, config: JSON.stringify(defaultConfig) } },
          users: {
            create: {
              email,
              password: hashSync(randomBytes(32).toString("hex"), 12),
              inviteToken,
              inviteTokenExpiresAt: new Date(Date.now() + INVITE_TTL_MS),
            },
          },
        },
      });

      // Stripe posts this webhook to whatever endpoint URL is configured on
      // the Stripe side — req.url's own origin isn't reliable for building a
      // customer-facing link (see resolveBaseUrl's rationale in submit/route.ts).
      const { host, proto } = resolveBaseUrl(process.env.NEXT_PUBLIC_APP_URL, process.env.VERCEL_URL, req.headers.get("host") ?? "");
      const inviteUrl = `${proto}://${host}/admin/invite/${inviteToken}`;
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: `eventwulf <anfrage@eventwulf.at>`,
          to: email,
          subject: `Willkommen bei eventwulf — Konto aktivieren`,
          html: `
            <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:2rem">
              <h2 style="margin:0 0 0.5rem;font-size:1.2rem;color:#1a1612">Willkommen bei eventwulf, ${sanitizeEmailHeader(meta.companyName)}!</h2>
              <p style="margin:0 0 1.5rem;color:#6b7280;font-size:0.9rem">
                Deine 14-tägige Testphase hat begonnen. Setze jetzt ein Passwort, um dich einzuloggen und loszulegen.
              </p>
              <p style="margin:0 0 1.5rem"><a href="${inviteUrl}" style="display:inline-block;padding:10px 20px;background:#996C1E;color:#ffffff;border-radius:8px;text-decoration:none;font-size:0.9rem;font-weight:600">Konto aktivieren</a></p>
              <p style="margin:0;color:#6b7280;font-size:0.8rem">Der Link ist 7 Tage gültig.</p>
            </div>
          `,
        });
      } catch (e) {
        console.error(`Failed to send welcome email for signup ${email}:`, e);
      }
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
