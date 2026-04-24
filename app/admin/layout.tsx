import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import LogoutButton from "@/components/admin/LogoutButton";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const SUPERADMIN = process.env.SUPERADMIN_SLUG ?? "admin";
  const isSuperAdmin = session.clientSlug === SUPERADMIN;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <nav
        style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
          padding: "0.75rem 1.5rem",
          display: "flex",
          alignItems: "center",
          gap: "1.5rem",
        }}
      >
        <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>Admin</span>
        <a href="/admin/config" style={{ fontSize: "0.85rem", color: "var(--muted)", textDecoration: "none" }}>Einstellungen</a>
        <a href="/admin/availability" style={{ fontSize: "0.85rem", color: "var(--muted)", textDecoration: "none" }}>Verfügbarkeit</a>
        {isSuperAdmin && (
          <a href="/admin/clients" style={{ fontSize: "0.85rem", color: "var(--muted)", textDecoration: "none" }}>Kunden</a>
        )}
        <a href="/" target="_blank" style={{ fontSize: "0.85rem", color: "var(--muted)", textDecoration: "none" }}>Vorschau ↗</a>
        <div style={{ marginLeft: "auto" }}>
          <LogoutButton />
        </div>
      </nav>
      <main style={{ maxWidth: "800px", margin: "0 auto", padding: "2rem 1.5rem" }}>
        {children}
      </main>
    </div>
  );
}
