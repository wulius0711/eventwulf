import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import VorschauClient from "./VorschauClient";

export default async function VorschauPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  return <VorschauClient slug={session.clientSlug} />;
}
