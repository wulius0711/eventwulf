"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PLAN_LABELS } from "@/lib/plan";

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const searchParams = useSearchParams();
  const initialPlan = searchParams.get("plan") === "pro" ? "pro" : "basis";
  const initialInterval = searchParams.get("interval") === "yearly" ? "yearly" : "monthly";

  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState<"basis" | "pro">(initialPlan);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">(initialInterval);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName, email, plan, interval: billingInterval }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.url) {
      window.location.href = data.url;
    } else {
      setError(data.error ?? "Registrierung fehlgeschlagen");
      setLoading(false);
    }
  }

  return (
    <div
      className="admin-shell"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.5rem",
        background: "var(--bg)",
      }}
    >
      <img src="/eventwulf-logo.png" alt="eventwulf" style={{ height: "32px", width: "auto" }} />
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "2.5rem 2rem",
        }}
      >
        <h1 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "0.25rem" }}>
          eventwulf registrieren
        </h1>
        <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "1.75rem" }}>
          Jetzt 14 Tage kostenlos testen. Jederzeit kündbar — sonst läuft die Abrechnung nach der Testphase automatisch weiter.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label>Firmenname</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              maxLength={200}
            />
          </div>
          <div>
            <label>E-Mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label>Plan</label>
            <select value={plan} onChange={(e) => setPlan(e.target.value as "basis" | "pro")}>
              <option value="basis">{PLAN_LABELS.basis} — 29 € / Monat</option>
              <option value="pro">{PLAN_LABELS.pro} — 59 € / Monat</option>
            </select>
          </div>
          <div>
            <label>Abrechnung</label>
            <select value={billingInterval} onChange={(e) => setBillingInterval(e.target.value as "monthly" | "yearly")}>
              <option value="monthly">Monatlich</option>
              <option value="yearly">Jährlich (~10 % günstiger)</option>
            </select>
          </div>

          {error && (
            <p style={{ color: "var(--error)", fontSize: "0.85rem", margin: 0 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="ew-admin-btn ew-admin-btn-primary"
            style={{ marginTop: "0.25rem" }}
          >
            {loading ? "Weiter zu Stripe…" : "Kostenlose Testphase starten"}
          </button>
        </form>
      </div>
    </div>
  );
}
