import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import LogoutButton from "@/components/admin/LogoutButton";
import AdminNav from "@/components/admin/AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || !session.organizationId) redirect("/admin/login");

  const SUPERADMIN = process.env.SUPERADMIN_SLUG ?? "admin";
  const isSuperAdmin = session.clientSlug === SUPERADMIN;

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    include: { clients: { select: { slug: true }, orderBy: { createdAt: "asc" } } },
  });
  const slugs = org?.clients.map((c) => c.slug) ?? [];
  const bookingAppUrl = isSuperAdmin ? null : (org?.bookingAppUrl ?? null);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <nav
        className="admin-nav-bar"
        style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
          padding: "0.75rem 1.5rem",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "1.5rem",
        }}
      >
        {bookingAppUrl ? (
          <a href={bookingAppUrl} style={{ position: "absolute", left: "1.5rem", fontSize: "0.85rem", color: "var(--muted)", textDecoration: "none" }}>
            ← bookingwulf
          </a>
        ) : (
          <span style={{ position: "absolute", left: "1.5rem", fontWeight: 700, fontSize: "0.95rem" }}>Admin</span>
        )}
        <AdminNav isSuperAdmin={isSuperAdmin} slugs={slugs} activeSlug={session.clientSlug} />
        <div style={{ position: "absolute", right: "1.5rem" }}>
          <LogoutButton />
        </div>
      </nav>
      <main style={{ maxWidth: "800px", margin: "0 auto", padding: "2rem 1.5rem" }}>
        {children}
      </main>
    </div>
  );
}
