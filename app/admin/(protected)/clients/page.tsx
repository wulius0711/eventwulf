import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import ClientsEditor from "@/components/admin/ClientsEditor";
import PageTransition from "@/components/admin/PageTransition";

export default async function ClientsPage() {
  const session = await getSession();
  const SUPERADMIN = process.env.SUPERADMIN_SLUG ?? "admin";
  if (session?.clientSlug !== SUPERADMIN) redirect("/admin/config");

  return (
    <PageTransition>
      <div>
        <h1 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "1.5rem" }}>
          Kunden verwalten
        </h1>
        <ClientsEditor superadminSlug={SUPERADMIN} />
      </div>
    </PageTransition>
  );
}
