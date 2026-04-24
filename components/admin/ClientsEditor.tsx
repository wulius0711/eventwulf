"use client";
import { useState, useEffect } from "react";

interface ClientEntry {
  id: string;
  slug: string;
  createdAt: string;
  _count: { users: number };
}

export default function ClientsEditor() {
  const [clients, setClients] = useState<ClientEntry[]>([]);
  const [slug, setSlug] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/admin/clients")
      .then((r) => r.json())
      .then(setClients)
      .catch(() => {});
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, email, password }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setClients((prev) => [...prev, { id: data.id, slug: data.slug, createdAt: new Date().toISOString(), _count: { users: 1 } }]);
      setSlug("");
      setEmail("");
      setPassword("");
    } else {
      setError(data.error ?? "Fehler");
    }
    setLoading(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      <form
        onSubmit={handleCreate}
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        <h2 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>Neuen Kunden anlegen</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
          <div>
            <label>Slug (URL-Kennung)</label>
            <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="mein-retreat" required pattern="[a-z0-9-]+" />
          </div>
          <div>
            <label>Admin E-Mail</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label>Passwort</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </div>
        </div>
        {error && <p style={{ color: "#dc2626", fontSize: "0.85rem", margin: 0 }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ padding: "0.65rem 1.5rem", background: "var(--primary)", color: "var(--btn-text)", border: "none", borderRadius: "var(--radius-sm)", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", alignSelf: "flex-start" }}>
          {loading ? "Anlegen…" : "Kunde anlegen"}
        </button>
      </form>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
        <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: "0.95rem" }}>
          Kunden ({clients.length})
        </div>
        {clients.length === 0 ? (
          <p style={{ padding: "1.5rem", color: "var(--muted)", fontSize: "0.85rem" }}>Noch keine Kunden.</p>
        ) : (
          clients.map((c) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", padding: "0.85rem 1.5rem", borderBottom: "1px solid var(--border)", gap: "1rem" }}>
              <code style={{ fontSize: "0.85rem", background: "var(--bg2)", padding: "0.2rem 0.5rem", borderRadius: "4px" }}>{c.slug}</code>
              <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{c._count.users} User</span>
              <a href={`/?kunde=${c.slug}`} target="_blank" style={{ marginLeft: "auto", fontSize: "0.8rem", color: "var(--primary)", textDecoration: "none" }}>Vorschau ↗</a>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
