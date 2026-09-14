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
    // eventwulf.at's domain forward strips subpaths (redirects /contact to
    // the marketing site's root) — Framer custom domains need a paid plan
    // to fix at the DNS level, so this links straight to the framer.website
    // alias instead, which serves /contact correctly.
    return (
      <a href="https://eventwulf.framer.website/contact" target="_blank" rel="noopener noreferrer" style={linkStyle}>
        Für Premium Kontakt aufnehmen
      </a>
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
        style={{ ...linkStyle, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}
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
