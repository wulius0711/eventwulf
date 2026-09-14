"use client";
import { useState } from "react";
import type { Plan } from "@/lib/plan";

// Premium has no fixed self-serve price (sales-led, see lib/stripe.ts) — a
// Pro customer hitting a limit that only Premium removes can't check out on
// their own, so this offers a contact link instead of a broken upgrade call.
export default function UpgradeButton({ currentPlan }: { currentPlan: Plan }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (currentPlan === "premium") return null;

  const linkStyle: React.CSSProperties = {
    display: "inline-block",
    padding: "0.4rem 0.85rem",
    background: "var(--admin-accent)",
    color: "var(--admin-accent-text)",
    border: "none",
    borderRadius: "var(--radius-sm)",
    fontWeight: 600,
    fontSize: "0.82rem",
    textDecoration: "none",
  };

  if (currentPlan === "pro") {
    return (
      <a href="https://eventwulf.at/contact" target="_blank" rel="noopener noreferrer" style={linkStyle}>
        Für Premium Kontakt aufnehmen
      </a>
    );
  }

  async function upgrade() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "pro", interval: "monthly" }),
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
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.6rem" }}>
      <button
        type="button"
        onClick={upgrade}
        disabled={loading}
        style={{ ...linkStyle, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}
      >
        {loading ? "Weiter zu Stripe…" : "Auf Pro upgraden"}
      </button>
      {error && <span style={{ color: "var(--error)", fontSize: "0.8rem" }}>{error}</span>}
    </span>
  );
}
