"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function InviteAcceptForm({ token }: { token: string }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [invalidReason, setInvalidReason] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/team/accept?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const data = await r.json();
        if (r.ok) setEmail(data.email);
        else setInvalidReason(data.error ?? "Einladung ungültig oder abgelaufen");
      })
      .catch(() => setInvalidReason("Einladung konnte nicht geprüft werden"))
      .finally(() => setChecking(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/team/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    if (res.ok) {
      router.push("/admin/config");
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Konnte Einladung nicht annehmen");
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
        {checking ? (
          <p style={{ color: "var(--muted)", fontSize: "0.9rem", margin: 0 }}>Einladung wird geprüft…</p>
        ) : invalidReason ? (
          <>
            <h1 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "0.5rem" }}>Einladung ungültig</h1>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>{invalidReason}</p>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "0.25rem" }}>Willkommen bei eventwulf</h1>
            <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "1.75rem" }}>
              Setze ein Passwort für <strong>{email}</strong>, um loszulegen.
            </p>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label>Passwort</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>

              {error && <p style={{ color: "var(--error)", fontSize: "0.85rem", margin: 0 }}>{error}</p>}

              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: "0.75rem",
                  background: "var(--admin-accent)",
                  color: "var(--admin-accent-text)",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  fontWeight: 600,
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.7 : 1,
                  marginTop: "0.25rem",
                }}
              >
                {loading ? "Wird gespeichert…" : "Passwort setzen & einloggen"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
