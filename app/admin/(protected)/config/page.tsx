import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loadConfigFromDB } from "@/lib/loadConfig";
import { isPlan } from "@/lib/plan";
import { hasActiveSubscription } from "@/lib/stripe";
import ConfigEditor from "@/components/admin/ConfigEditor";
import PageTransition from "@/components/admin/PageTransition";

interface Props {
  searchParams: Promise<{ tab?: string }>;
}

export default async function ConfigPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const client = await prisma.client.findUnique({ where: { slug: session.clientSlug } });
  if (!client) redirect("/admin/login"); // client was deleted while this session's cookie was still valid

  const config = await loadConfigFromDB(client.slug);
  const org = await prisma.organization.findUnique({ where: { id: session.organizationId }, select: { plan: true, subscriptionStatus: true, stripeCustomerId: true, stripeSubscriptionId: true } });
  // Deliberately org.plan here, not effectivePlan() — this drives the
  // "Aktueller Plan" label and the upgrade button. Showing the
  // payment-failure-downgraded plan here would look like an unannounced
  // downgrade instead of a payment problem to fix (and could offer an
  // "upgrade" to a plan the org already has). The actual feature/limit
  // enforcement elsewhere already uses effectivePlan() regardless of what's
  // shown here. See PAYMENT_FAILURE_STATUSES in lib/plan.ts.
  const plan = isPlan(org?.plan) ? org.plan : "basis";
  const paymentIssue = org?.subscriptionStatus === "past_due" || org?.subscriptionStatus === "unpaid";
  const { tab } = await searchParams;
  const initialTab = tab === "abrechnung" || tab === "team" || tab === "passwort" ? tab : "firma";

  return (
    <PageTransition>
      <div>
        <h1 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "1.5rem" }}>
          Einstellungen
        </h1>
        <ConfigEditor
          initialConfig={config}
          plan={plan}
          paymentIssue={paymentIssue}
          initialTab={initialTab}
          hasStripeCustomer={!!org?.stripeCustomerId}
          hasActiveSubscription={hasActiveSubscription(org ?? {})}
        />
      </div>
    </PageTransition>
  );
}
