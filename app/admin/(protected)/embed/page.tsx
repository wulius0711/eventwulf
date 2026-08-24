import { getSession } from "@/lib/auth";
import EmbedEditor from "@/components/admin/EmbedEditor";

export default async function EmbedPage() {
  const session = await getSession();

  return (
    <div>
      <h1 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "1.5rem" }}>
        Embed-Codes
      </h1>
      <EmbedEditor slug={session!.clientSlug} />
    </div>
  );
}
