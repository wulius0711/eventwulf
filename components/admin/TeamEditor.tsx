"use client";
import { useState, useEffect } from "react";
import { PLAN_LABELS, type Plan } from "@/lib/plan";
import UpgradeButton from "./UpgradeButton";

interface Member {
  id: string;
  email: string;
  createdAt: string;
  pending: boolean;
  self: boolean;
}

export default function TeamEditor({ plan }: { plan: Plan }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [limit, setLimit] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/team")
      .then((r) => r.json())
      .then((data) => {
        setMembers(data.members);
        setLimit(data.limit);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }

  useEffect(load, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setError("");

    const res = await fetch("/api/admin/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (res.ok) {
      setEmail("");
      load();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Einladung fehlgeschlagen");
    }
    setInviting(false);
  }

  async function handleRemove(id: string, email: string) {
    if (!confirm(`${email} wirklich aus dem Team entfernen?`)) return;
    setRemovingId(id);
    setError("");

    const res = await fetch("/api/admin/team", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: id }),
    });

    if (res.ok) {
      load();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Entfernen fehlgeschlagen");
    }
    setRemovingId(null);
  }

  if (!loaded) return null;

  const atLimit = limit !== null && members.length >= limit;

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "1.5rem",
        marginBottom: "1.25rem",
      }}
    >
      <h2 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "1.25rem", color: "var(--text)" }}>Team</h2>

      {limit !== null && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", flexWrap: "wrap", fontSize: "0.85rem", color: "var(--muted)", marginBottom: "1.25rem" }}>
          <span>{members.length} von {limit} Mitgliedern ({PLAN_LABELS[plan]}-Paket)</span>
          {atLimit && <UpgradeButton currentPlan={plan} />}
        </div>
      )}

      {limit !== null && members.length > limit && (
        <div style={{
          background: "var(--surface)", border: "1px solid var(--primary)",
          borderRadius: "var(--radius-sm)", padding: "0.75rem 1rem", fontSize: "0.85rem", color: "var(--text)",
          marginBottom: "1.25rem",
        }}>
          Aktuell sind mehr Team-Mitglieder angelegt ({members.length}), als das gebuchte Paket erlaubt ({limit}) — z.B. nach einem Paket-Wechsel. Bestehende Mitglieder bleiben aktiv, aber es können keine weiteren angelegt werden, solange das so ist.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.5rem" }}>
        {members.map((m) => (
          <div
            key={m.id}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "0.6rem 0.85rem", background: "var(--bg2)", borderRadius: "var(--radius-sm)", fontSize: "0.85rem",
            }}
          >
            <span>
              {m.email}
              {m.pending && (
                <span style={{ marginLeft: "0.5rem", color: "var(--muted)", fontSize: "0.75rem" }}>(Einladung ausstehend)</span>
              )}
            </span>
            {!m.self && (
              <button
                type="button"
                onClick={() => handleRemove(m.id, m.email)}
                disabled={removingId === m.id}
                style={{ border: "none", background: "none", color: "var(--error)", cursor: "pointer", fontSize: "0.8rem" }}
              >
                {removingId === m.id ? "…" : "Entfernen"}
              </button>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleInvite} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: "220px" }}>
          <label>Mitglied einladen (E-Mail)</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={atLimit}
          />
        </div>
        <button
          type="submit"
          disabled={inviting || atLimit}
          className="ew-admin-btn ew-admin-btn-primary"
        >
          {inviting ? "Wird eingeladen…" : "Einladen"}
        </button>
      </form>
      {error && <p style={{ color: "var(--error)", fontSize: "0.85rem", marginTop: "0.75rem" }}>{error}</p>}
    </div>
  );
}
