import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import ConfigEditor from "@/components/admin/ConfigEditor";
import type { YogaConfig } from "@/lib/types";

export default async function ConfigPage() {
  const session = await getSession();
  const client = await prisma.client.findUnique({ where: { slug: session!.clientSlug } });
  const config = JSON.parse(client!.config) as YogaConfig;

  return (
    <div>
      <h1 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "1.5rem" }}>
        Einstellungen
      </h1>
      <ConfigEditor initialConfig={config} slug={client!.slug} />
    </div>
  );
}
