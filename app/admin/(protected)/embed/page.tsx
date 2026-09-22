import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import EmbedEditor from "@/components/admin/EmbedEditor";
import PageTransition from "@/components/admin/PageTransition";

export default async function EmbedPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const client = await prisma.client.findUnique({ where: { slug: session.clientSlug }, select: { id: true } });
  if (!client) redirect("/admin/login"); // client was deleted while this session's cookie was still valid

  return (
    <PageTransition>
      <div>
        <h1 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "1.5rem" }}>
          Embed-Codes
        </h1>
        <EmbedEditor slug={session.clientSlug} />
      </div>
    </PageTransition>
  );
}
