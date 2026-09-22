"use client";
import { useState } from "react";
import type { Plan } from "@/lib/plan";

// Premium has no fixed self-serve price (sales-led, see lib/stripe.ts) — a
// Pro customer hitting a limit that only Premium removes can't check out on
// their own, so this offers a contact link instead of a broken upgrade call.
//
// hasActiveSubscription: true if this org already has a non-canceled Stripe
// subscription (hasActiveSubscription() in lib/stripe.ts). Every standalone
// signup gets one immediately (see checkout.session.completed in
// app/api/stripe/webhook/route.ts), so this is the common case, not an edge
// case — starting a fresh Checkout Session here would create a SECOND,
// parallel subscription on the same Stripe customer instead of changing the
// existing one, and Stripe allows that without complaint. The Customer
// Portal is already configured for exactly this switch ("Kund/innen können
// Pläne ändern": upgrades apply immediately with proration, downgrades at
// period end), so an org with an existing subscription is routed there
// instead of through checkout.
export default function UpgradeButton({ currentPlan, hasActiveSubscription }: { currentPlan: Plan; hasActiveSubscription: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (currentPlan === "premium") return null;

  const linkStyle: React.CSSProperties = {
    display: "inline-block",
    fontSize: "0.82rem",
    textDecoration: "none",
  };

  if (currentPlan === "pro") {
    return (
      <a href="https://eventwulf.at/contact" target="_blank" rel="noopener noreferrer" className="ew-admin-btn ew-admin-btn-primary" style={linkStyle}>
        Für Premium Kontakt aufnehmen
      </a>
    );
  }

  async function openPortal() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.url) {
      window.location.href = data.url;
    } else {
      setError(data.error ?? "Konnte Abo-Verwaltung nicht öffnen");
      setLoading(false);
    }
  }

  if (hasActiveSubscription) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
        <button type="button" onClick={openPortal} disabled={loading} className="ew-admin-btn ew-admin-btn-primary" style={linkStyle}>
          {loading ? "Weiter zu Stripe…" : "Auf Pro upgraden"}
        </button>
        {error && <span style={{ color: "var(--error)", fontSize: "0.8rem" }}>{error}</span>}
      </span>
    );
  }

  async function upgrade(interval: "monthly" | "yearly") {
    setLoading(true);
    setError("");
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "pro", interval }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.url) {
      window.location.href = data.url;
    } else {
      setError(data.error ?? "Konnte Upgrade nicht starten");
      setLoading(false);
    }
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
      <button
        type="button"
        onClick={() => upgrade("monthly")}
        disabled={loading}
        className="ew-admin-btn ew-admin-btn-primary"
        style={linkStyle}
      >
        {loading ? "Weiter zu Stripe…" : "Auf Pro upgraden"}
      </button>
      <button
        type="button"
        onClick={() => upgrade("yearly")}
        disabled={loading}
        style={{
          background: "none", border: "none", padding: 0,
          color: "var(--muted)", fontSize: "0.78rem", textDecoration: "underline",
          cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
        }}
      >
        oder jährlich (~10% sparen)
      </button>
      {error && <span style={{ color: "var(--error)", fontSize: "0.8rem" }}>{error}</span>}
    </span>
  );
}
