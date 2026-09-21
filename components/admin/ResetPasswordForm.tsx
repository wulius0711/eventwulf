"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthSplit from "@/components/admin/AuthSplit";

export default function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [invalidReason, setInvalidReason] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/reset?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (r.ok) setEmail(data.email);
        else setInvalidReason(data.error ?? "Link ungültig oder abgelaufen");
      })
      .catch(() => setInvalidReason("Der Link konnte nicht geprüft werden"))
      .finally(() => setChecking(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    if (res.ok) {
      router.push("/admin/dashboard");
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Das Passwort konnte nicht gesetzt werden");
      setLoading(false);
    }
  }

  return (
    <AuthSplit headline="Gleich geschafft." sub="Lege ein neues Passwort fest und mach dort weiter, wo du aufgehört hast.">
      {checking ? (
        <p style={{ color: "var(--muted)", fontSize: "0.9rem", margin: 0 }}>Link wird geprüft…</p>
      ) : invalidReason ? (
        <>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.01em", marginBottom: "0.4rem" }}>Link ungültig</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: "1.75rem" }}>{invalidReason}. Fordere einfach einen neuen Link an.</p>
          <a href="/admin/forgot" className="ew-admin-btn ew-admin-btn-primary" style={{ display: "block", textAlign: "center", padding: "0.75rem 1.25rem", fontSize: "15px", fontWeight: 600, textDecoration: "none" }}>
            Neuen Link anfordern
          </a>
        </>
      ) : (
        <>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.01em", marginBottom: "0.4rem" }}>Neues Passwort</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "1.75rem" }}>
            Lege ein Passwort für <strong style={{ color: "var(--text)" }}>{email}</strong> fest.
          </p>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label>Neues Passwort</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
              <p style={{ color: "var(--muted)", fontSize: "0.78rem", margin: "0.4rem 0 0" }}>Mindestens 8 Zeichen.</p>
            </div>
            {error && <p style={{ color: "var(--error)", fontSize: "0.85rem", margin: 0 }}>{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="ew-admin-btn ew-admin-btn-primary"
              style={{ marginTop: "0.5rem", width: "100%", padding: "0.75rem 1.25rem", fontSize: "15px", fontWeight: 600 }}
            >
              {loading ? "Wird gespeichert…" : "Passwort speichern & einloggen"}
            </button>
          </form>
        </>
      )}
    </AuthSplit>
  );
}
