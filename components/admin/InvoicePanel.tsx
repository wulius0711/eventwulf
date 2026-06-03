"use client";
import { useState, useEffect } from "react";
import type { InvoiceEntry, InvoiceLineItem } from "@/lib/types";

interface Props {
  inquiryId: string;
  participantCount: number;
  packageName?: string;
  pricePerPerson?: number;
  onStatusChange?: (newInquiryStatus: string) => void;
}

const STATUS_LABELS: Record<string, string> = { offen: "Offen", storniert: "Storniert" };
const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  offen:     { bg: "#fefce8", color: "#a16207" },
  storniert: { bg: "#fef2f2", color: "#b91c1c" },
};

function emptyItem(): InvoiceLineItem {
  return { description: "", quantity: 1, unitPrice: 0 };
}

export default function InvoicePanel({ inquiryId, participantCount, packageName, pricePerPerson, onStatusChange }: Props) {
  const [invoices, setInvoices] = useState<InvoiceEntry[]>([]);
  const [creating, setCreating] = useState(false);
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([emptyItem()]);
  const [notes, setNotes] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/invoices")
      .then((r) => r.json())
      .then((all: InvoiceEntry[]) => setInvoices(all.filter((i) => i.inquiryId === inquiryId)))
      .catch(() => {});
  }, [inquiryId]);

  function openCreate() {
    const prefilled: InvoiceLineItem[] = packageName && participantCount > 0
      ? [{ description: packageName, quantity: participantCount, unitPrice: pricePerPerson ?? 0 }]
      : [emptyItem()];
    setLineItems(prefilled);
    setNotes("");
    setSendEmail(true);
    setError("");
    setCreating(true);
  }

  function setItem(idx: number, field: keyof InvoiceLineItem, value: string | number) {
    setLineItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  }

  function addItem() {
    setLineItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(idx: number) {
    setLineItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleCreate() {
    if (!creating) return;
    if (lineItems.some((i) => !i.description.trim())) { setError("Bitte alle Positionen ausfüllen"); return; }
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inquiryId, lineItems, notes, sendEmail }),
    });
    if (res.ok) {
      const inv = await res.json() as InvoiceEntry;
      setInvoices((prev) => [inv, ...prev]);
      if (sendEmail) onStatusChange?.("angebot_versendet");
      setCreating(false);
    } else {
      const d = await res.json().catch(() => ({})) as { error?: string };
      setError(d.error ?? "Fehler");
    }
    setSaving(false);
  }

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/admin/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setInvoices((prev) => prev.map((i) => i.id === id ? { ...i, status } : i));
    }
  }

  const net = lineItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  const btnBase: React.CSSProperties = {
    padding: "0.3rem 0.75rem", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
    background: "none", cursor: "pointer", fontSize: "0.78rem",
  };

  return (
    <div style={{ borderTop: "1px solid var(--border)", paddingTop: "0.9rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--muted)" }}>Dokumente</span>
        {!creating && (
          <button style={{ ...btnBase, color: "var(--text)" }} onClick={openCreate}>+ Angebot</button>
        )}
      </div>

      {/* Existing invoices */}
      {invoices.map((inv) => {
        const sc = STATUS_COLORS[inv.status] ?? STATUS_COLORS.offen;
        const gross = inv.lineItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0) * (1 + inv.taxRate);
        return (
          <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.6rem 0.75rem", background: "var(--bg2)", borderRadius: "var(--radius-sm)", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 600 }}>Angebot</span>
            <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{inv.number}</span>
            <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#1a1612" }}>
              {gross.toLocaleString("de-AT", { style: "currency", currency: "EUR" })}
            </span>
            <span style={{ background: sc.bg, color: sc.color, padding: "0.12rem 0.5rem", borderRadius: "4px", fontSize: "0.72rem", fontWeight: 600 }}>
              {STATUS_LABELS[inv.status]}
            </span>
            <div style={{ marginLeft: "auto", display: "flex", gap: "0.35rem" }}>
              <button style={btnBase} onClick={() => window.open(`/api/admin/invoices/${inv.id}/html`, "_blank")}>Vorschau</button>
              {inv.status !== "storniert" && (
                <button style={{ ...btnBase, color: "#dc2626" }} onClick={() => updateStatus(inv.id, "storniert")}>Stornieren</button>
              )}
            </div>
          </div>
        );
      })}

      {invoices.length === 0 && !creating && (
        <p style={{ fontSize: "0.8rem", color: "var(--muted)", margin: 0 }}>Noch keine Dokumente für diese Anfrage.</p>
      )}

      {/* Create form */}
      {creating && (
        <div style={{ border: "1px solid var(--primary)", borderRadius: "var(--radius)", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--primary)" }}>Angebot erstellen</div>

          {/* Line items */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {lineItems.map((item, idx) => (
              <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 70px 100px auto", gap: "0.4rem", alignItems: "center" }}>
                <input
                  type="text" placeholder="Leistung" value={item.description}
                  onChange={(e) => setItem(idx, "description", e.target.value)}
                  style={{ fontSize: "0.82rem" }}
                />
                <input
                  type="number" min="1" placeholder="Menge" value={item.quantity}
                  onChange={(e) => setItem(idx, "quantity", parseInt(e.target.value) || 1)}
                  style={{ fontSize: "0.82rem" }}
                />
                <input
                  type="number" min="0" step="0.01" placeholder="Preis €" value={item.unitPrice}
                  onChange={(e) => setItem(idx, "unitPrice", parseFloat(e.target.value) || 0)}
                  style={{ fontSize: "0.82rem" }}
                />
                <button onClick={() => removeItem(idx)} disabled={lineItems.length === 1}
                  style={{ ...btnBase, color: "#dc2626", opacity: lineItems.length === 1 ? 0.3 : 1 }}>×</button>
              </div>
            ))}
            <button onClick={addItem} style={{ ...btnBase, color: "var(--muted)", alignSelf: "flex-start" }}>+ Position</button>
          </div>

          <div style={{ fontSize: "0.82rem", color: "var(--muted)", textAlign: "right" }}>
            Netto: <strong>{net.toLocaleString("de-AT", { style: "currency", currency: "EUR" })}</strong>
            {" · "}Brutto (inkl. 20% MwSt.): <strong>{(net * 1.2).toLocaleString("de-AT", { style: "currency", currency: "EUR" })}</strong>
          </div>

          <div>
            <label style={{ fontSize: "0.82rem", display: "block", marginBottom: "0.25rem" }}>Anmerkungen (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              style={{ width: "100%", boxSizing: "border-box", resize: "vertical", fontSize: "0.82rem",
                fontFamily: "inherit", padding: "0.4rem 0.6rem", border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)", background: "var(--bg)", color: "var(--text)" }}
            />
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.82rem", cursor: "pointer" }}>
            <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} style={{ width: "auto" }} />
            Per E-Mail an Anfragenden senden
          </label>

          {error && <p style={{ color: "#dc2626", fontSize: "0.8rem", margin: 0 }}>{error}</p>}

          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
            <button style={{ ...btnBase, color: "var(--muted)" }} onClick={() => setCreating(false)}>Abbrechen</button>
            <button
              onClick={handleCreate} disabled={saving}
              style={{ padding: "0.4rem 1.25rem", background: "var(--primary)", color: "var(--btn-text)",
                border: "none", borderRadius: "var(--radius-sm)", fontWeight: 600,
                cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, fontSize: "0.82rem" }}
            >
              {saving ? "Wird erstellt…" : "Angebot erstellen"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
