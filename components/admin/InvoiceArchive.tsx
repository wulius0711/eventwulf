"use client";
import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { InvoiceEntry } from "@/lib/types";
import { useToast } from "@/components/admin/Toast";
import { InboxEmptyIcon, FilterEmptyIcon } from "@/components/admin/icons";

const STATUS_LABELS: Record<string, string> = { offen: "Offen", storniert: "Storniert" };
const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  offen:     { bg: "#fefce8", color: "#a16207" },
  storniert: { bg: "#fef2f2", color: "#b91c1c" },
};

const PAGE_SIZES = [20, 50, 100];
const PAGE_SIZE_KEY = "ew-admin-invoices-pagesize";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function InvoiceArchive() {
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [invoices, setInvoices] = useState<InvoiceEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  // Deep-linked from the dashboard's "Offene Angebote" card, e.g. ?status=offen.
  const [filter, setFilter] = useState<"all" | "offen" | "storniert">(() => {
    const s = searchParams.get("status");
    return s === "offen" || s === "storniert" ? s : "all";
  });
  const [pageSize, setPageSize] = useState(() => {
    try {
      const stored = Number(localStorage.getItem(PAGE_SIZE_KEY));
      return PAGE_SIZES.includes(stored) ? stored : 20;
    } catch { return 20; }
  });

  useEffect(() => {
    try { localStorage.setItem(PAGE_SIZE_KEY, String(pageSize)); } catch {}
  }, [pageSize]);

  function buildParams(skip: number) {
    const params = new URLSearchParams();
    if (filter !== "all") params.set("statuses", filter);
    params.set("take", String(pageSize));
    params.set("skip", String(skip));
    return params;
  }

  useEffect(() => {
    const hadStatusParam = !!searchParams.get("status");
    setLoading(true);
    fetch(`/api/admin/invoices?${buildParams(0)}`)
      .then((r) => r.json())
      .then((res: { invoices: InvoiceEntry[]; total: number }) => {
        setInvoices(res.invoices);
        setTotal(res.total);
        setLoading(false);
        // ?status=offen was consumed into filter's initial state above —
        // drop it from the URL now that it's applied.
        if (hadStatusParam) router.replace("/admin/invoices");
      })
      .catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, pageSize]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/admin/invoices?${buildParams(invoices.length)}`);
      const data = await res.json() as { invoices: InvoiceEntry[]; total: number };
      setInvoices((prev) => [...prev, ...data.invoices]);
      setTotal(data.total);
    } finally {
      setLoadingMore(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/admin/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setInvoices((prev) => {
        const next = prev.map((i) => i.id === id ? { ...i, status } : i);
        // A cancelled offer that no longer matches the active status filter
        // drops out of view instead of lingering until the next reload.
        if (filter !== "all" && filter !== status) {
          setTotal((t) => Math.max(0, t - 1));
          return next.filter((i) => i.id !== id);
        }
        return next;
      });
      showToast("success", "Status aktualisiert");
    } else {
      showToast("error", "Fehler beim Ändern des Status");
    }
  }

  if (loading) return <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Lade Angebote…</p>;

  const canLoadMore = invoices.length < total;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Filter tabs + page size */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", gap: "0.25rem" }}>
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
        <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} style={{ width: "auto", marginBottom: "0.4rem" }} title="Anzahl pro Seite">
          {PAGE_SIZES.map((n) => <option key={n} value={n}>{n} pro Seite</option>)}
        </select>
      </div>

      {/* List */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
        {invoices.length === 0 ? (
          <div className="ew-empty-state" style={{ border: "none", borderRadius: 0 }}>
            <span className="ew-empty-state-icon">{filter === "all" ? InboxEmptyIcon : FilterEmptyIcon}</span>
            <div className="ew-empty-state-title">{filter === "all" ? "Noch keine Angebote" : "Keine Treffer"}</div>
            <p className="ew-empty-state-body">
              {filter === "all" ? "Angebote, die du aus Anfragen erstellst, erscheinen hier." : `Keine Angebote mit Status „${STATUS_LABELS[filter]}".`}
            </p>
            {filter !== "all" && (
              <button type="button" className="ew-admin-btn ew-admin-btn-outline ew-empty-state-action" onClick={() => setFilter("all")}>
                Filter zurücksetzen
              </button>
            )}
          </div>
        ) : invoices.map((inv) => {
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
              <span style={{ background: sc.bg, color: sc.color, padding: "0.15rem 0.55rem", borderRadius: "999px", fontSize: "0.75rem", fontWeight: 600 }}>
                {STATUS_LABELS[inv.status]}
              </span>
              <div style={{ display: "flex", gap: "0.35rem" }}>
                <button
                  onClick={() => window.open(`/api/admin/invoices/${inv.id}/html`, "_blank")}
                  className="ew-admin-btn ew-admin-btn-outline" style={{ fontSize: "0.78rem" }}>
                  Vorschau
                </button>
                {inv.status !== "storniert" ? (
                  <button onClick={() => updateStatus(inv.id, "storniert")}
                    className="ew-admin-btn ew-admin-btn-outline-danger" style={{ fontSize: "0.78rem" }}>
                    Stornieren
                  </button>
                ) : (
                  <button onClick={() => updateStatus(inv.id, "offen")}
                    className="ew-admin-btn ew-admin-btn-outline" style={{ fontSize: "0.78rem" }}>
                    Wieder öffnen
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {canLoadMore && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loadingMore}
          className="ew-admin-btn ew-admin-btn-outline"
          style={{ alignSelf: "center", fontSize: "0.85rem" }}
        >
          {loadingMore ? "Lädt…" : `Weitere laden (${invoices.length} von ${total})`}
        </button>
      )}
    </div>
  );
}
