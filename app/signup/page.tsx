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
    <div className="admin-shell ew-auth-wrap" style={{ display: "flex", minHeight: "100vh" }}>
      <div
        className="ew-auth-split-left"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "relative",
          backgroundImage: "url(/auth-bg/1.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          padding: "2.5rem 3rem",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to bottom, rgba(15,23,20,0.55) 0%, rgba(15,23,20,0.15) 45%, rgba(15,23,20,0.65) 100%)",
          }}
        />
        <img
          src="/eventwulf-logo.png"
          alt="eventwulf"
          style={{ position: "relative", height: "28px", width: "auto", alignSelf: "flex-start", filter: "brightness(0) invert(1)" }}
        />
        <div style={{ position: "relative" }}>
          <p style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "#fff", letterSpacing: "-0.01em", lineHeight: 1.3 }}>
            Anfragen, Räume und Events an einem Ort.
          </p>
          <p style={{ margin: "0.5rem 0 0", fontSize: "0.9rem", color: "rgba(255,255,255,0.75)" }}>
            14 Tage kostenlos testen, jederzeit kündbar.
          </p>
        </div>
      </div>

      <div
        className="ew-auth-split-right"
        style={{
          width: "480px",
          flexShrink: 0,
          background: "var(--surface)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2.5rem 2rem",
          overflowY: "auto",
        }}
      >
        <div style={{ width: "100%", maxWidth: "360px" }}>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "0.25rem" }}>
            eventwulf registrieren
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "1.75rem" }}>
            Jetzt 14 Tage kostenlos testen. Jederzeit kündbar — sonst startet die Abrechnung automatisch nach der Testphase.
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
              style={{ marginTop: "0.25rem", width: "fit-content" }}
            >
              {loading ? "Weiter zu Stripe…" : "Kostenlose Testphase starten"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
