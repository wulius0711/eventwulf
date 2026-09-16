"use client";
import { useState } from "react";

export default function ManageBillingButton({ hasStripeCustomer }: { hasStripeCustomer: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!hasStripeCustomer) {
    return (
      <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
        Noch kein Zahlungskonto hinterlegt.
      </span>
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

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
      <button type="button" onClick={openPortal} disabled={loading} className="ew-admin-btn ew-admin-btn-outline">
        {loading ? "Weiter zu Stripe…" : "Abo verwalten"}
      </button>
      {error && <span style={{ color: "var(--error)", fontSize: "0.8rem" }}>{error}</span>}
    </span>
  );
}
