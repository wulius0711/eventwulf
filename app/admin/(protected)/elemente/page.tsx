import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loadConfigFromDB } from "@/lib/loadConfig";
import { isPlan } from "@/lib/plan";
import ElementeTabs from "@/components/admin/ElementeTabs";

export default async function ElementePage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const { tab } = await searchParams;
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const client = await prisma.client.findUnique({ where: { slug: session.clientSlug } });
  if (!client) redirect("/admin/login"); // client was deleted while this session's cookie was still valid

  const config = await loadConfigFromDB(client.slug);

  const SUPERADMIN = process.env.SUPERADMIN_SLUG ?? "admin";
  const isSuperAdmin = session.clientSlug === SUPERADMIN;
  const org = await prisma.organization.findUnique({ where: { id: session.organizationId }, select: { plan: true } });
  const plan = isSuperAdmin ? null : (isPlan(org?.plan) ? org.plan : "basis");

  return (
    <div>
      <h1 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "1.5rem" }}>
        Elemente
      </h1>
      <ElementeTabs initialConfig={config} plan={plan} initialTab={typeof tab === "string" ? tab : undefined} />
    </div>
  );
}
