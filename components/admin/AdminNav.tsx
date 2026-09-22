"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NavIcons } from "./icons";

interface Props {
  isSuperAdmin: boolean;
  slugs: string[];
  activeSlug: string;
  newInquiryCount: number;
  openInvoiceCount: number;
  onNavigate?: () => void;
}

const links = [
  { href: "/admin/dashboard",    label: "Dashboard",      icon: "dashboard" },
  { href: "/admin/config",       label: "Einstellungen",  icon: "config" },
  { href: "/admin/elemente",     label: "Elemente",       icon: "elemente" },
  { href: "/admin/embed",        label: "Embed-Codes",    icon: "embed" },
  { href: "/admin/inquiries",    label: "Anfragen",       icon: "inquiries" },
  { href: "/admin/invoices",     label: "Angebote",       icon: "invoices" },
  { href: "/admin/vorschau",     label: "Vorschau",       icon: "vorschau" },
  { href: "/admin/handbuch",     label: "Handbuch",       icon: "handbuch" },
];

export default function AdminNav({ isSuperAdmin, slugs, activeSlug, newInquiryCount, openInvoiceCount, onNavigate }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const badgeCounts: Record<string, number> = {
    "/admin/inquiries": newInquiryCount,
    "/admin/invoices": openInvoiceCount,
  };

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
      {links.map(({ href, label, icon }) => {
        const badge = badgeCounts[href] ?? 0;
        return (
          <Link key={href} href={href} className={`ew-nav-link${pathname.startsWith(href) ? " active" : ""}`} onClick={onNavigate}>
            <span className="ew-nav-icon">{NavIcons[icon]}</span>
            {label}
            {badge > 0 && (
              <span
                style={{
                  marginLeft: "auto", background: "#dc2626", color: "#fff", borderRadius: "999px",
                  fontSize: "0.72rem", fontWeight: 700, lineHeight: 1, padding: "0.2rem 0.45rem", minWidth: "1.1rem",
                  textAlign: "center", display: "inline-block",
                }}
              >
                {badge}
              </span>
            )}
          </Link>
        );
      })}

      {isSuperAdmin && (
        <Link href="/admin/clients" className={`ew-nav-link${pathname.startsWith("/admin/clients") ? " active" : ""}`} onClick={onNavigate}>
          <span className="ew-nav-icon">{NavIcons.clients}</span>
          Kunden
        </Link>
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
