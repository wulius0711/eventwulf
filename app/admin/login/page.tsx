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
      router.push("/admin/config");
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Anmeldung fehlgeschlagen");
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
          maxWidth: "380px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "2.5rem 2rem",
        }}
      >
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
            className="ew-btn ew-btn-primary"
            style={{ marginTop: "0.25rem" }}
          >
            {loading ? "Anmelden…" : "Anmelden"}
          </button>
        </form>
      </div>
    </div>
  );
}
