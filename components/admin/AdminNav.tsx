"use client";
import { usePathname, useRouter } from "next/navigation";

interface Props {
  isSuperAdmin: boolean;
  slugs: string[];
  activeSlug: string;
}

const links = [
  { href: "/admin/config",       label: "Einstellungen" },
  { href: "/admin/availability", label: "Verfügbarkeit" },
  { href: "/admin/inquiries",    label: "Anfragen" },
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
      {links.map(({ href, label }) => {
        const active = pathname.startsWith(href);
        return (
          <a key={href} href={href} style={{
            fontSize: "0.85rem",
            color: active ? "var(--text)" : "var(--muted)",
            textDecoration: "none",
            fontWeight: active ? 700 : 400,
          }}>
            {label}
          </a>
        );
      })}
      {isSuperAdmin && (
        <a href="/admin/clients" style={{
          fontSize: "0.85rem",
          color: pathname.startsWith("/admin/clients") ? "var(--text)" : "var(--muted)",
          textDecoration: "none",
          fontWeight: pathname.startsWith("/admin/clients") ? 700 : 400,
        }}>
          Kunden
        </a>
      )}
      {slugs.length > 1 && (
        <select
          value={activeSlug}
          onChange={(e) => switchSlug(e.target.value)}
          style={{
            fontSize: "0.82rem",
            padding: "0.3rem 0.6rem",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            background: "var(--bg2)",
            color: "var(--text)",
            cursor: "pointer",
            width: "auto",
          }}
        >
          {slugs.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      )}
      <a href="/" target="_blank" style={{ fontSize: "0.85rem", color: "var(--muted)", textDecoration: "none" }}>
        Vorschau ↗
      </a>
    </>
  );
}
