"use client";
import { usePathname, useRouter } from "next/navigation";

interface Props {
  isSuperAdmin: boolean;
  slugs: string[];
  activeSlug: string;
}

const links = [
  { href: "/admin/config",       label: "Einstellungen" },
  { href: "/admin/packages",     label: "Pakete" },
  { href: "/admin/availability", label: "Verfügbarkeit" },
  { href: "/admin/inquiries",    label: "Anfragen" },
  { href: "/admin/invoices",     label: "Dokumente" },
  { href: "/admin/vorschau",     label: "Vorschau" },
  { href: "/admin/handbuch",     label: "Handbuch" },
];

export default function AdminNav({ isSuperAdmin, slugs, activeSlug }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  async function switchSlug(slug: string) {
    await fetch("/api/admin/switch-slug", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    router.refresh();
  }

  return (
    <>
      {links.map(({ href, label }) => (
        <a key={href} href={href} className={`ew-nav-link${pathname.startsWith(href) ? " active" : ""}`}>
          {label}
        </a>
      ))}

      {isSuperAdmin && (
        <a href="/admin/clients" className={`ew-nav-link${pathname.startsWith("/admin/clients") ? " active" : ""}`}>
          Kunden
        </a>
      )}

      {slugs.length > 1 && (
        <div style={{ padding: "0.5rem 0.875rem", marginTop: "0.5rem" }}>
          <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.4rem" }}>
            Kunde
          </div>
          <select
            value={activeSlug}
            onChange={(e) => switchSlug(e.target.value)}
            style={{ fontSize: "0.82rem", padding: "0.3rem 0.5rem", borderRadius: "6px", cursor: "pointer", width: "100%" }}
          >
            {slugs.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}
