"use client";
import { useState, useEffect } from "react";
import type { PackageEntry } from "@/lib/types";

const empty = (): Omit<PackageEntry, "id"> => ({
  name: "",
  description: "",
  pricePerPerson: 0,
  minParticipants: 1,
  maxParticipants: 50,
  durationDays: 1,
  isActive: true,
  sortOrder: 0,
});

function fmtPrice(n: number) {
  return n.toLocaleString("de-AT", { style: "currency", currency: "EUR" });
}

export default function PackagesEditor() {
  const [packages, setPackages] = useState<PackageEntry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(empty());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/packages")
      .then((r) => r.json())
      .then(setPackages)
      .catch(() => {});
  }, []);

  function startEdit(pkg: PackageEntry) {
    setEditingId(pkg.id);
    setForm({
      name: pkg.name,
      description: pkg.description,
      pricePerPerson: pkg.pricePerPerson,
      minParticipants: pkg.minParticipants,
      maxParticipants: pkg.maxParticipants,
      durationDays: pkg.durationDays,
      isActive: pkg.isActive,
      sortOrder: pkg.sortOrder,
    });
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(empty());
    setError("");
  }

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Name ist pflicht"); return; }
    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/packages", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...(editingId ? { id: editingId } : {}), ...form }),
    });

    if (res.ok) {
      const saved = await res.json() as PackageEntry;
      setPackages((prev) =>
        editingId
          ? prev.map((p) => (p.id === editingId ? saved : p))
          : [...prev, saved]
      );
      cancelEdit();
    } else {
      const d = await res.json().catch(() => ({})) as { error?: string };
      setError(d.error ?? "Fehler beim Speichern");
    }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    const res = await fetch("/api/admin/packages", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setPackages((prev) => prev.filter((p) => p.id !== id));
      if (editingId === id) cancelEdit();
    }
  }

  async function toggleActive(pkg: PackageEntry) {
    const res = await fetch("/api/admin/packages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: pkg.id, isActive: !pkg.isActive }),
    });
    if (res.ok) {
      const saved = await res.json() as PackageEntry;
      setPackages((prev) => prev.map((p) => (p.id === pkg.id ? saved : p)));
    }
  }

  const inputStyle: React.CSSProperties = { width: "100%", boxSizing: "border-box" };
  const fieldStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "0.3rem" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Form */}
      <form onSubmit={handleSubmit} style={{
        background: "var(--surface)",
        border: `1px solid ${editingId ? "var(--primary)" : "var(--border)"}`,
        borderRadius: "var(--radius)", padding: "1.5rem",
        display: "flex", flexDirection: "column", gap: "1rem",
      }}>
        {editingId && (
          <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--primary)", fontWeight: 600 }}>
            Paket wird bearbeitet
          </p>
        )}

        <div style={fieldStyle}>
          <label>Paketname *</label>
          <input style={inputStyle} type="text" value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="z.B. Tagesseminar, 2-Tages-Retreat" />
        </div>

        <div style={fieldStyle}>
          <label>Beschreibung</label>
          <textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Kurze Beschreibung des Pakets"
            rows={2}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", fontSize: "0.875rem",
              padding: "0.5rem 0.75rem", border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)", background: "var(--bg)", color: "var(--text)" }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
          <div style={fieldStyle}>
            <label>Preis / Person (€)</label>
            <input style={inputStyle} type="number" min="0" step="0.01" value={form.pricePerPerson}
              onChange={(e) => set("pricePerPerson", parseFloat(e.target.value) || 0)} />
          </div>
          <div style={fieldStyle}>
            <label>Min. Teilnehmer</label>
            <input style={inputStyle} type="number" min="1" value={form.minParticipants}
              onChange={(e) => set("minParticipants", parseInt(e.target.value) || 1)} />
          </div>
          <div style={fieldStyle}>
            <label>Max. Teilnehmer</label>
            <input style={inputStyle} type="number" min="1" value={form.maxParticipants}
              onChange={(e) => set("maxParticipants", parseInt(e.target.value) || 50)} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div style={fieldStyle}>
            <label>Dauer (Tage)</label>
            <input style={inputStyle} type="number" min="1" value={form.durationDays}
              onChange={(e) => set("durationDays", parseInt(e.target.value) || 1)} />
          </div>
          <div style={fieldStyle}>
            <label>Reihenfolge</label>
            <input style={inputStyle} type="number" min="0" value={form.sortOrder}
              onChange={(e) => set("sortOrder", parseInt(e.target.value) || 0)} />
          </div>
        </div>

        {error && <p style={{ color: "var(--error)", fontSize: "0.85rem", margin: 0 }}>{error}</p>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
          {editingId && (
            <button type="button" onClick={cancelEdit} style={{
              padding: "0.65rem 1.25rem", border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)", background: "none",
              color: "var(--muted)", cursor: "pointer", fontWeight: 500,
            }}>
              Abbrechen
            </button>
          )}
          <button type="submit" disabled={loading} style={{
            padding: "0.65rem 1.5rem", background: "var(--primary)", color: "var(--btn-text)",
            border: "none", borderRadius: "var(--radius-sm)", fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
          }}>
            {loading ? "Speichern…" : editingId ? "Änderungen speichern" : "Paket erstellen"}
          </button>
        </div>
      </form>

      {/* List */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
        <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: "0.95rem" }}>
          Pakete ({packages.length})
        </div>
        {packages.length === 0 ? (
          <p style={{ padding: "1.25rem 1.5rem", color: "var(--muted)", fontSize: "0.85rem" }}>
            Noch keine Pakete. Erstelle das erste Paket oben.
          </p>
        ) : packages.map((pkg) => (
          <div key={pkg.id} style={{
            display: "flex", alignItems: "center", padding: "0.9rem 1.5rem",
            borderBottom: "1px solid var(--border)", gap: "0.75rem", flexWrap: "wrap",
            background: editingId === pkg.id ? "var(--primary-tint)" : "transparent",
            opacity: pkg.isActive ? 1 : 0.55,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                {pkg.name}
                {!pkg.isActive && (
                  <span style={{ fontSize: "0.72rem", background: "var(--bg2)", color: "var(--muted)",
                    padding: "0.1rem 0.45rem", borderRadius: "4px", fontWeight: 400 }}>
                    inaktiv
                  </span>
                )}
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.15rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <span>{fmtPrice(pkg.pricePerPerson)} / Person</span>
                <span>{pkg.minParticipants}–{pkg.maxParticipants} Teilnehmer</span>
                <span>{pkg.durationDays} {pkg.durationDays === 1 ? "Tag" : "Tage"}</span>
              </div>
              {pkg.description && (
                <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "0.2rem" }}>{pkg.description}</div>
              )}
            </div>
            <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
              <button onClick={() => toggleActive(pkg)} style={{
                padding: "0.28rem 0.65rem", border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)", background: "none",
                color: pkg.isActive ? "var(--error)" : "var(--text)", cursor: "pointer", fontSize: "0.78rem",
              }}>
                {pkg.isActive ? "Deaktivieren" : "Aktivieren"}
              </button>
              <button onClick={() => startEdit(pkg)} style={{
                padding: "0.28rem 0.65rem", border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)", background: "none",
                color: "var(--text)", cursor: "pointer", fontSize: "0.78rem",
              }}>
                Bearbeiten
              </button>
              <button onClick={() => handleDelete(pkg.id)} style={{
                padding: "0.28rem 0.65rem", border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)", background: "none",
                color: "var(--error)", cursor: "pointer", fontSize: "0.78rem",
              }}>
                Löschen
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
