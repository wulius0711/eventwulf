import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { loadConfigFromDB } from "@/lib/loadConfig";
import InquiryInbox from "@/components/admin/InquiryInbox";

export default async function InquiriesPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const config = await loadConfigFromDB(session.clientSlug);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h1 style={{ margin: "0 0 0.25rem", fontSize: "1.3rem", fontWeight: 700 }}>Anfragen</h1>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--muted)" }}>
          Alle eingegangenen Buchungsanfragen.
        </p>
      </div>
      <InquiryInbox config={config} />
    </div>
  );
}
