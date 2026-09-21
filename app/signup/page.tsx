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
  const [accept, setAccept] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName, email, plan, interval: billingInterval, accept }),
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
    <div className="admin-shell ew-auth-dark ew-auth-wrap" style={{ display: "flex", minHeight: "100vh" }}>
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
            background: "linear-gradient(to bottom, rgba(14,21,37,0.72) 0%, rgba(21,110,71,0.22) 50%, rgba(14,21,37,0.85) 100%)",
          }}
        />
        <a href="https://eventwulf.at" aria-label="eventwulf – zur Startseite" style={{ position: "relative", alignSelf: "flex-start", display: "inline-block" }}>
          <img
            src="/eventwulf-logo.png"
            alt="eventwulf"
            style={{ display: "block", height: "28px", width: "auto", filter: "brightness(0) invert(1)" }}
          />
        </a>
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
          flexDirection: "column",
          padding: "2.5rem 2rem 1.5rem",
          overflowY: "auto",
        }}
      >
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: "360px" }}>
          {/* Mobile only (the photo panel with the logo is hidden there) */}
          <a href="https://eventwulf.at" className="ew-auth-mobile-logo" aria-label="eventwulf – zur Startseite" style={{ display: "none", marginBottom: "1.25rem" }}>
            <img src="/eventwulf-logo.png" alt="eventwulf" style={{ display: "block", height: "24px", width: "auto", filter: "brightness(0) invert(1)" }} />
          </a>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.01em", marginBottom: "0.4rem" }}>
            eventwulf registrieren
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "1.75rem" }}>
            14 Tage kostenlos testen, jederzeit kündbar. Zahlungsmethode erforderlich.
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
              <label>Paket</label>
              <select
                value={`${plan}:${billingInterval}`}
                onChange={(e) => {
                  const [pl, iv] = e.target.value.split(":");
                  setPlan(pl as "basis" | "pro");
                  setBillingInterval(iv as "monthly" | "yearly");
                }}
              >
                <option value="basis:monthly">{PLAN_LABELS.basis} — 29 € / Monat</option>
                <option value="basis:yearly">{PLAN_LABELS.basis} — 312 € / Jahr (spare ~10 %)</option>
                <option value="pro:monthly">{PLAN_LABELS.pro} — 59 € / Monat</option>
                <option value="pro:yearly">{PLAN_LABELS.pro} — 636 € / Jahr (spare ~10 %)</option>
              </select>
            </div>

            <label style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start", fontSize: "0.82rem", lineHeight: 1.5, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={accept}
                onChange={(e) => setAccept(e.target.checked)}
                required
                style={{ marginTop: "0.2rem", flexShrink: 0, accentColor: "var(--admin-accent)" }}
              />
              <span>
                Ich handle als Unternehmer, akzeptiere die{" "}
                <a href="https://eventwulf.at/legal/terms-conditions" target="_blank" rel="noopener noreferrer" style={{ color: "var(--text)", textDecoration: "underline" }}>AGB</a>{" "}
                und habe die{" "}
                <a href="https://eventwulf.at/legal/privacy-policy" target="_blank" rel="noopener noreferrer" style={{ color: "var(--text)", textDecoration: "underline" }}>Datenschutzerklärung</a>{" "}
                gelesen.
              </span>
            </label>

            {error && (
              <p style={{ color: "var(--error)", fontSize: "0.85rem", margin: 0 }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="ew-admin-btn ew-admin-btn-primary"
              style={{ marginTop: "0.5rem", width: "100%", padding: "0.75rem 1.25rem", fontSize: "15px", fontWeight: 600 }}
            >
              {loading ? "Weiter zu Stripe…" : "Kostenlose Testphase starten"}
            </button>
          </form>
        </div>
        </div>
        <div style={{ marginTop: "1.5rem", fontSize: "0.78rem", textAlign: "center" }}>
          <a href="https://eventwulf.at/legal/impressum" target="_blank" rel="noopener noreferrer" style={{ color: "var(--muted)", textDecoration: "none" }}>Impressum</a>
        </div>
      </div>
    </div>
  );
}
