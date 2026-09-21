"use client";
import { useState } from "react";
import AuthSplit from "@/components/admin/AuthSplit";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (res.ok) {
      setSent(true);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Das hat leider nicht geklappt. Bitte versuche es erneut.");
    }
    setLoading(false);
  }

  return (
    <AuthSplit headline="Kein Problem, das passiert." sub="Wir schicken dir einen Link zum Zurücksetzen.">
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.01em", marginBottom: "0.4rem" }}>Passwort vergessen?</h1>
      {sent ? (
        <p style={{ color: "var(--muted)", fontSize: "0.9rem", lineHeight: 1.6, marginBottom: "1.75rem" }}>
          Falls zu <strong style={{ color: "var(--text)" }}>{email}</strong> ein Konto existiert, ist eine E-Mail mit einem Link unterwegs. Er ist 1 Stunde gültig. Bitte schau auch im Spam-Ordner nach.
        </p>
      ) : (
        <>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "1.75rem" }}>
            Gib deine E-Mail-Adresse ein. Wir schicken dir einen Link, mit dem du ein neues Passwort festlegst.
          </p>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label>E-Mail</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            {error && <p style={{ color: "var(--error)", fontSize: "0.85rem", margin: 0 }}>{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="ew-admin-btn ew-admin-btn-primary"
              style={{ marginTop: "0.5rem", width: "100%", padding: "0.75rem 1.25rem", fontSize: "15px", fontWeight: 600 }}
            >
              {loading ? "Wird gesendet…" : "Link senden"}
            </button>
          </form>
        </>
      )}
      <div style={{ marginTop: "1.5rem", fontSize: "0.85rem", textAlign: "center" }}>
        <a href="/admin/login" style={{ color: "var(--muted)", textDecoration: "none" }}>Zurück zum Login</a>
      </div>
    </AuthSplit>
  );
}
