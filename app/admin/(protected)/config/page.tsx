import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loadConfigFromDB } from "@/lib/loadConfig";
import { isPlan } from "@/lib/plan";
import ConfigEditor from "@/components/admin/ConfigEditor";

interface Props {
  searchParams: Promise<{ tab?: string }>;
}

export default async function ConfigPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const client = await prisma.client.findUnique({ where: { slug: session.clientSlug } });
  if (!client) redirect("/admin/login"); // client was deleted while this session's cookie was still valid

  const config = await loadConfigFromDB(client.slug);
  const org = await prisma.organization.findUnique({ where: { id: session.organizationId }, select: { plan: true, stripeCustomerId: true } });
  const plan = isPlan(org?.plan) ? org.plan : "basis";
  const { tab } = await searchParams;
  const initialTab = tab === "abrechnung" || tab === "team" || tab === "passwort" ? tab : "firma";

  return (
    <div>
      <h1 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "1.5rem" }}>
        Einstellungen
      </h1>
      <ConfigEditor initialConfig={config} plan={plan} initialTab={initialTab} hasStripeCustomer={!!org?.stripeCustomerId} />
    </div>
  );
}
