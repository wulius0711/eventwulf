"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

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
          <h1 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "0.25rem" }}>
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
              <label>Passwort</label>
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
              style={{ marginTop: "0.25rem", width: "fit-content" }}
            >
              {loading ? "Anmelden…" : "Anmelden"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
