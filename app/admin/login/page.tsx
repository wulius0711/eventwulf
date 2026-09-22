"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthWordmark } from "@/components/AuthWordmark";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (res.ok) {
      router.push("/admin/dashboard");
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Anmeldung fehlgeschlagen");
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
        <a href="https://eventwulf.at" aria-label="eventwulf – zur Startseite" style={{ position: "relative", alignSelf: "flex-start", display: "inline-block", textDecoration: "none" }}>
          <AuthWordmark size={22} />
        </a>
        <div style={{ position: "relative" }}>
          <p style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "#fff", letterSpacing: "-0.01em", lineHeight: 1.3 }}>
            Schön, dich wiederzusehen.
          </p>
          <p style={{ margin: "0.5rem 0 0", fontSize: "0.9rem", color: "rgba(255,255,255,0.75)" }}>
            Anfragen, Räume und Events an einem Ort.
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
        <div style={{ width: "100%", maxWidth: "340px" }}>
          {/* Mobile only (the photo panel with the logo is hidden there) */}
          <a href="https://eventwulf.at" className="ew-auth-mobile-logo" aria-label="eventwulf – zur Startseite" style={{ display: "none", marginBottom: "1.25rem", textDecoration: "none" }}>
            <AuthWordmark size={19} />
          </a>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.01em", marginBottom: "0.4rem" }}>
            Admin Login
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "1.75rem" }}>
            Bitte melde dich an, um fortzufahren.
          </p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <label>Passwort</label>
                <a href="/admin/forgot" style={{ color: "var(--muted)", fontSize: "0.78rem", textDecoration: "none" }}>Passwort vergessen?</a>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p style={{ color: "var(--error)", fontSize: "0.85rem", margin: 0 }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="ew-admin-btn ew-admin-btn-primary"
              style={{ marginTop: "0.5rem", width: "100%", padding: "0.75rem 1.25rem", fontSize: "15px", fontWeight: 600 }}
            >
              {loading ? "Anmelden…" : "Anmelden"}
            </button>
          </form>

          <p style={{ margin: "1.25rem 0 0", textAlign: "center", fontSize: "0.85rem", color: "var(--muted)" }}>
            Noch kein Konto?{" "}
            <a href="/signup" style={{ color: "var(--text)", textDecoration: "underline" }}>Kostenlos testen</a>
          </p>
        </div>
      </div>
    </div>
  );
}
