import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { randomBytes } from "crypto";
import { hashSync } from "bcryptjs";
import { Resend } from "resend";
import { prisma } from "@/lib/db";
import { loadConfig } from "@/lib/loadConfig";
import { stripe, subscriptionSync } from "@/lib/stripe";
import { disputeClosedResult } from "@/lib/plan";
import { welcomeEmailHtml } from "@/lib/emailTemplates";
import { recordSignupCardFingerprint } from "@/lib/trialAbuse";
import { resolveBaseUrl } from "@/app/api/submit/route";

// Matches the team-invite TTL (app/api/admin/team/route.ts) — well within
// the 14-day trial, so a new signup always has time to set a password.
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Thrown by any of the Stripe refetch/lookup calls below on failure — a
// single mechanism for every error path in handleEvent (this one and any
// unanticipated one, e.g. a Prisma error) so there's exactly one place
// (the outer catch in POST) that decides the HTTP response, instead of a
// second, parallel "return a NextResponse directly from a branch" path
// that a future refactor could silently stop propagating (as happened once
// already while building this — see the commit message).
class StripeRefetchError extends Error {}

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

  try {
    await handleEvent(event, req);
  } catch (e) {
    // One catch for every error path in handleEvent: a known
    // StripeRefetchError (subscription refetch, dispute charge lookup) gets
    // its specific message; anything else (e.g. an unanticipated Prisma
    // error) gets a generic one. Either way: log with the event id/type for
    // debugging, then 500 so Stripe retries via its own mechanism (up to 3
    // days, exponential backoff) instead of the delivery being silently
    // lost to whatever generic response Next.js would otherwise produce
    // for an uncaught exception in a route handler.
    console.error(`Error processing Stripe event ${event.id} (${event.type}):`, e);
    const message = e instanceof StripeRefetchError ? e.message : "Interner Fehler bei der Verarbeitung";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleEvent(event: Stripe.Event, req: NextRequest): Promise<void> {
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

      // Trial-abuse guard (business-risk finding): the same card, reused
      // across throwaway emails, otherwise gets an unlimited number of free
      // 14-day trials. The trial itself can't be prevented up front — it's
      // set on the Checkout Session before the card is even known — so this
      // reacts after the fact instead: recordSignupCardFingerprint()
      // (lib/trialAbuse.ts) is the actual, DB-only reuse check; if the card
      // was already used, the trial is ended immediately below rather than
      // blocking this signup outright.
      let cardFingerprintReused = false;
      if (typeof checkoutSession.subscription === "string") {
        try {
          const subscription = await stripe.subscriptions.retrieve(checkoutSession.subscription, { expand: ["default_payment_method"] });
          const paymentMethod = subscription.default_payment_method;
          const fingerprint = paymentMethod && typeof paymentMethod !== "string" ? paymentMethod.card?.fingerprint : undefined;
          if (fingerprint) {
            cardFingerprintReused = (await recordSignupCardFingerprint(fingerprint)).alreadyUsed;
          }
        } catch (e) {
          // Fail OPEN, unlike the subscription-sync/dispute refetches
          // elsewhere in this file (which return 500 so Stripe retries):
          // this is a fraud-prevention safeguard on top of a real, already
          // successful payment, not the core purpose of the handler. A
          // transient Stripe hiccup here shouldn't block a real signup from
          // completing.
          console.error(`Failed to check card fingerprint for signup ${email}:`, e);
        }
      }
      if (cardFingerprintReused) {
        try {
          await stripe.subscriptions.update(checkoutSession.subscription as string, { trial_end: "now" });
        } catch (e) {
          console.error(`Failed to end trial early for reused card fingerprint (signup ${email}):`, e);
        }
      }

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
          // welcomeEmailHtml (lib/emailTemplates.ts) HTML-escapes
          // meta.companyName — the customer's own signup input, previously
          // interpolated raw (see the identical fix in
          // app/api/admin/team/route.ts).
          html: welcomeEmailHtml(meta.companyName, inviteUrl),
        });
      } catch (e) {
        console.error(`Failed to send welcome email for signup ${email}:`, e);
      }
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const eventSubscription = event.data.object as Stripe.Subscription;
      if (typeof eventSubscription.customer !== "string") break;

      const org = await prisma.organization.findUnique({ where: { stripeCustomerId: eventSubscription.customer } });
      if (!org) break; // webhook arrived before checkout.session.completed created the org — a later update will sync it

      // Stripe doesn't guarantee event delivery order and explicitly warns
      // against using `created` to determine it (different events can share
      // the same second-granularity timestamp) — see
      // https://docs.stripe.com/webhooks#event-ordering. Instead of trusting
      // the (possibly stale) subscription snapshot embedded in whichever
      // event happened to arrive, refetch its actual current state. This
      // makes all three event types converge to the same truth regardless
      // of arrival order: a late "updated (active)" delivered after a
      // "deleted" was already processed refetches and sees the subscription
      // is actually canceled, and writes that — not "active". A canceled
      // subscription stays retrievable at Stripe (never hard-deleted), so
      // this covers the deleted case too, which is why all three event
      // types now share this one branch instead of three separate ones.
      let subscription: Stripe.Subscription;
      try {
        subscription = await stripe.subscriptions.retrieve(eventSubscription.id);
      } catch (e) {
        console.error(`Failed to refetch subscription ${eventSubscription.id}:`, e);
        // The outer catch in POST turns this into a 500, so Stripe retries
        // this delivery on its own schedule — using Stripe's own retry
        // mechanism as the safety net for a transient API hiccup here,
        // rather than silently skipping the sync.
        throw new StripeRefetchError("Stripe-Abfrage fehlgeschlagen");
      }

      // subscriptionSync (lib/stripe.ts) is the actual "who wins" mapping —
      // pulled out as its own pure function so it's unit-testable without a
      // DB or a live Stripe API call. See its own tests
      // (__tests__/validation/stripe-subscription-sync.spec.ts) for the
      // ordering-safety reasoning in concrete before/after terms.
      const { subscriptionStatus, plan } = subscriptionSync(subscription);

      await prisma.organization.update({
        where: { id: org.id },
        data: {
          stripeSubscriptionId: subscription.id,
          subscriptionStatus,
          ...(plan ? { plan } : {}),
        },
      });
      break;
    }

    case "charge.dispute.created": {
      const dispute = event.data.object as Stripe.Dispute;
      if (typeof dispute.charge !== "string") break;

      // The Dispute object has no direct customer reference — only a charge
      // id — so resolving the org needs one extra lookup, same pattern (and
      // same live-key testing caveat) as the subscription refetch above.
      let charge: Stripe.Charge;
      try {
        charge = await stripe.charges.retrieve(dispute.charge);
      } catch (e) {
        console.error(`Failed to look up charge ${dispute.charge} for dispute ${dispute.id}:`, e);
        throw new StripeRefetchError("Stripe-Abfrage fehlgeschlagen");
      }
      if (typeof charge.customer !== "string") break;

      const org = await prisma.organization.findUnique({ where: { stripeCustomerId: charge.customer } });
      if (!org) break;

      // Admin-visibility marker only — deliberately no effect on
      // effectivePlan()/access here (product decision: don't lock anyone out
      // just because a dispute was opened, only once one is actually lost).
      await prisma.organization.update({
        where: { id: org.id },
        data: { disputeOpenedAt: new Date(dispute.created * 1000) },
      });
      break;
    }

    case "charge.dispute.closed": {
      const dispute = event.data.object as Stripe.Dispute;
      if (typeof dispute.charge !== "string") break;

      let charge: Stripe.Charge;
      try {
        charge = await stripe.charges.retrieve(dispute.charge);
      } catch (e) {
        console.error(`Failed to look up charge ${dispute.charge} for dispute ${dispute.id}:`, e);
        throw new StripeRefetchError("Stripe-Abfrage fehlgeschlagen");
      }
      if (typeof charge.customer !== "string") break;

      const org = await prisma.organization.findUnique({ where: { stripeCustomerId: charge.customer } });
      if (!org) break;

      // disputeClosedResult (lib/plan.ts) is the actual won/lost decision —
      // pulled out as its own pure function for the same reason as
      // subscriptionSync above.
      const { lost } = disputeClosedResult(dispute.status);
      await prisma.organization.update({
        where: { id: org.id },
        data: lost
          ? { disputeOpenedAt: null, disputeLostAt: new Date() } // effectivePlan() now forces Basis until manually resolved
          : { disputeOpenedAt: null }, // won (or an inquiry that never became a real dispute) — no effect on access
      });
      break;
    }
  }
}
