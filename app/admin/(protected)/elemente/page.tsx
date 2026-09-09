import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loadConfigFromDB } from "@/lib/loadConfig";
import ElementeTabs from "@/components/admin/ElementeTabs";

export default async function ElementePage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const client = await prisma.client.findUnique({ where: { slug: session.clientSlug } });
  if (!client) redirect("/admin/login"); // client was deleted while this session's cookie was still valid

  const config = await loadConfigFromDB(client.slug);

  return (
    <div>
      <h1 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "1.5rem" }}>
        Elemente
      </h1>
      <ElementeTabs initialConfig={config} />
    </div>
  );
}
