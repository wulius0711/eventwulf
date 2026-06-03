"use client";
import { useState, useEffect } from "react";
import type { InvoiceEntry } from "@/lib/types";

const STATUS_LABELS: Record<string, string> = { offen: "Offen", storniert: "Storniert" };
const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  offen:     { bg: "#fefce8", color: "#a16207" },
  storniert: { bg: "#fef2f2", color: "#b91c1c" },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function InvoiceArchive() {
  const [invoices, setInvoices] = useState<InvoiceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "offen" | "storniert">("all");

  useEffect(() => {
    fetch("/api/admin/invoices")
      .then((r) => r.json())
      .then((data: InvoiceEntry[]) => { setInvoices(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/admin/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) setInvoices((prev) => prev.map((i) => i.id === id ? { ...i, status } : i));
  }

  const filtered = filter === "all" ? invoices : invoices.filter((i) => i.status === filter);

  if (loading) return <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Lade Dokumente…</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Filter tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", gap: "0.25rem" }}>
        {(["all", "offen", "storniert"] as const).map((t) => (
          <button key={t} onClick={() => setFilter(t)} style={{
            padding: "0.45rem 1rem", border: "none",
            borderBottom: `2px solid ${filter === t ? "var(--primary)" : "transparent"}`,
            background: "none", color: filter === t ? "var(--primary)" : "var(--muted)",
            cursor: "pointer", fontWeight: filter === t ? 600 : 400, fontSize: "0.88rem",
          }}>
            {t === "all" ? "Alle" : STATUS_LABELS[t]}
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <p style={{ padding: "1.5rem", color: "var(--muted)", fontSize: "0.85rem" }}>Keine Dokumente gefunden.</p>
        ) : filtered.map((inv) => {
          const sc = STATUS_COLORS[inv.status] ?? STATUS_COLORS.offen;
          const gross = inv.lineItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0) * (1 + inv.taxRate);
          return (
            <div key={inv.id} style={{
              display: "flex", alignItems: "center", padding: "0.85rem 1.5rem",
              borderBottom: "1px solid var(--border)", gap: "0.75rem", flexWrap: "wrap",
            }}>
              <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--muted)", minWidth: "60px" }}>
                Angebot
              </span>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, minWidth: "130px" }}>{inv.number}</span>
              <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{fmtDate(inv.issuedAt)}</span>
              <span style={{ fontWeight: 700, fontSize: "0.9rem", flex: 1 }}>
                {gross.toLocaleString("de-AT", { style: "currency", currency: "EUR" })}
              </span>
              <span style={{ background: sc.bg, color: sc.color, padding: "0.15rem 0.55rem", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 600 }}>
                {STATUS_LABELS[inv.status]}
              </span>
              <div style={{ display: "flex", gap: "0.35rem" }}>
                <button
                  onClick={() => window.open(`/api/admin/invoices/${inv.id}/html`, "_blank")}
                  style={{ padding: "0.28rem 0.65rem", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "none", color: "var(--text)", cursor: "pointer", fontSize: "0.78rem" }}>
                  Vorschau
                </button>
                {inv.status !== "storniert" && (
                  <button onClick={() => updateStatus(inv.id, "storniert")}
                    style={{ padding: "0.28rem 0.65rem", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "none", color: "var(--error)", cursor: "pointer", fontSize: "0.78rem" }}>
                    Stornieren
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
