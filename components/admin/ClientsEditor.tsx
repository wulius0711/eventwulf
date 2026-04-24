"use client";
import { useState, useEffect } from "react";

interface OrgEntry {
  id: string;
  name: string;
  createdAt: string;
  clients: { id: string; slug: string; createdAt: string }[];
  users: { email: string }[];
}

export default function ClientsEditor() {
  const [orgs, setOrgs] = useState<OrgEntry[]>([]);
  const [slug, setSlug] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [addSlugOrgId, setAddSlugOrgId] = useState<string | null>(null);
  const [newSlug, setNewSlug] = useState("");
  const [addSlugError, setAddSlugError] = useState("");
  const [addSlugLoading, setAddSlugLoading] = useState(false);

  useEffect(() => {
    fetch("/api/admin/clients").then((r) => r.json()).then(setOrgs).catch(() => {});
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
      setOrgs((prev) => [...prev, {
        id: data.id,
        name: slug,
        createdAt: new Date().toISOString(),
        clients: [{ id: "", slug, createdAt: new Date().toISOString() }],
        users: [{ email }],
      }]);
      setSlug(""); setEmail(""); setPassword("");
    } else {
      setError(data.error ?? "Fehler");
    }
    setLoading(false);
  }

  async function handleAddSlug(orgId: string) {
    setAddSlugLoading(true);
    setAddSlugError("");
    const res = await fetch(`/api/admin/orgs/${orgId}/clients`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: newSlug }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setOrgs((prev) => prev.map((o) => o.id === orgId
        ? { ...o, clients: [...o.clients, { id: "", slug: newSlug, createdAt: new Date().toISOString() }] }
        : o
      ));
      setNewSlug(""); setAddSlugOrgId(null);
    } else {
      setAddSlugError(data.error ?? "Fehler");
    }
    setAddSlugLoading(false);
  }

  const cardStyle = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "1.5rem",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Create new org */}
      <form onSubmit={handleCreate} style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: "1rem" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>Neuen Kunden anlegen</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
          <div>
            <label>Erster Slug (URL-Kennung)</label>
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

      {/* Org list */}
      <div style={cardStyle}>
        <div style={{ fontWeight: 600, fontSize: "0.95rem", marginBottom: "1rem" }}>Kunden ({orgs.length})</div>
        {orgs.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", margin: 0 }}>Noch keine Kunden.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {orgs.map((org) => (
              <div key={org.id} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
                <div style={{ padding: "0.75rem 1rem", background: "var(--bg2)", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{org.name}</span>
                  <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{org.users[0]?.email}</span>
                </div>
                <div style={{ padding: "0.5rem 1rem", display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
                  {org.clients.map((c) => (
                    <div key={c.slug} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <code style={{ fontSize: "0.82rem", background: "var(--bg2)", padding: "0.2rem 0.5rem", borderRadius: "4px" }}>{c.slug}</code>
                      <a href={`/?kunde=${c.slug}`} target="_blank" style={{ fontSize: "0.75rem", color: "var(--primary)", textDecoration: "none" }}>↗</a>
                    </div>
                  ))}
                  {addSlugOrgId === org.id ? (
                    <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                      <input
                        type="text"
                        value={newSlug}
                        onChange={(e) => setNewSlug(e.target.value)}
                        placeholder="neuer-slug"
                        pattern="[a-z0-9-]+"
                        style={{ width: "140px", fontSize: "0.82rem", padding: "0.25rem 0.5rem" }}
                        autoFocus
                      />
                      <button type="button" onClick={() => handleAddSlug(org.id)} disabled={addSlugLoading} style={{ padding: "0.3rem 0.7rem", background: "var(--primary)", color: "var(--btn-text)", border: "none", borderRadius: "var(--radius-sm)", fontSize: "0.8rem", cursor: "pointer" }}>
                        {addSlugLoading ? "…" : "OK"}
                      </button>
                      <button type="button" onClick={() => { setAddSlugOrgId(null); setNewSlug(""); setAddSlugError(""); }} style={{ padding: "0.3rem 0.6rem", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "none", color: "var(--muted)", fontSize: "0.8rem", cursor: "pointer" }}>
                        ×
                      </button>
                      {addSlugError && <span style={{ fontSize: "0.78rem", color: "#dc2626" }}>{addSlugError}</span>}
                    </div>
                  ) : (
                    <button type="button" onClick={() => { setAddSlugOrgId(org.id); setAddSlugError(""); }} style={{ padding: "0.25rem 0.6rem", border: "1px dashed var(--border)", borderRadius: "var(--radius-sm)", background: "none", color: "var(--muted)", fontSize: "0.78rem", cursor: "pointer" }}>
                      + Slug
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
