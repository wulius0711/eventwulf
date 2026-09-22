import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import VorschauClient from "./VorschauClient";
import PageTransition from "@/components/admin/PageTransition";

export default async function VorschauPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  return (
    <PageTransition>
      <VorschauClient slug={session.clientSlug} />
    </PageTransition>
  );
}
