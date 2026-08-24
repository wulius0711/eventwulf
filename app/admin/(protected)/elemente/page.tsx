import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loadConfigFromDB } from "@/lib/loadConfig";
import ElementeTabs from "@/components/admin/ElementeTabs";

export default async function ElementePage() {
  const session = await getSession();
  const client = await prisma.client.findUnique({ where: { slug: session!.clientSlug } });
  const config = await loadConfigFromDB(client!.slug);

  return (
    <div>
      <h1 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "1.5rem" }}>
        Elemente
      </h1>
      <ElementeTabs initialConfig={config} />
    </div>
  );
}
