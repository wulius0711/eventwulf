"use client";
import { useState, useEffect } from "react";

interface BlockedRow {
  id: string;
  startDate: string;
  endDate: string;
  label: string;
}

function fmt(iso: string) {
  const d = new Date(iso.substring(0, 10) + "T12:00:00");
  return d.toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function isoDate(iso: string) {
  return iso.substring(0, 10);
}

export default function AvailabilityEditor() {
  const [entries, setEntries]     = useState<BlockedRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate]     = useState("");
  const [label, setLabel]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  useEffect(() => {
    fetch("/api/admin/availability")
      .then((r) => r.json())
      .then(setEntries)
      .catch(() => {});
  }, []);

  function startEdit(entry: BlockedRow) {
    setEditingId(entry.id);
    setStartDate(isoDate(entry.startDate));
    setEndDate(isoDate(entry.endDate));
    setLabel(entry.label);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setStartDate(""); setEndDate(""); setLabel("");
    setError("");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!startDate || !endDate) return;
    if (new Date(endDate) < new Date(startDate)) {
      setError("Enddatum muss nach Startdatum liegen");
      return;
    }
    setLoading(true);
    setError("");

    const body = {
      startDate,
      endDate,
      label: label || "nicht verfügbar",
      ...(editingId ? { id: editingId } : {}),
    };

    const res = await fetch("/api/admin/availability", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const saved = await res.json();
      setEntries((prev) =>
        editingId
          ? prev.map((e) => e.id === editingId ? saved : e)
          : [...prev, saved]
      );
      cancelEdit();
    } else {
      setError("Fehler beim Speichern");
    }
    setLoading(false);
  }

  async function handleDelete(id: string, label: string) {
    if (!window.confirm(`Sperrzeit „${label}" wirklich löschen?`)) return;
    const res = await fetch("/api/admin/availability", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setEntries((prev) => prev.filter((e) => e.id !== id));
      if (editingId === id) cancelEdit();
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>

      <form onSubmit={handleSubmit} style={{
        background: "var(--surface)", border: `1px solid ${editingId ? "var(--primary)" : "var(--border)"}`,
        borderRadius: "var(--radius)", padding: "1.5rem",
        display: "flex", flexDirection: "column", gap: "1rem",
      }}>
        {editingId && (
          <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--primary)", fontWeight: 600 }}>
            Eintrag wird bearbeitet
          </p>
        )}

        <div className="ew-date-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div>
            <label>Von</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </div>
          <div>
            <label>Bis</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          </div>
        </div>

        <div>
          <label>Bezeichnung (optional)</label>
          <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="nicht verfügbar" />
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
            {loading ? "Speichern…" : editingId ? "Änderungen speichern" : "Zeitraum sperren"}
          </button>
        </div>
      </form>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
        <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: "0.95rem" }}>
          Gesperrte Zeiträume ({entries.length})
        </div>
        {entries.length === 0 ? (
          <p style={{ padding: "1.25rem 1.5rem", color: "var(--muted)", fontSize: "0.85rem" }}>Noch keine Einträge.</p>
        ) : entries.map((entry) => (
          <div key={entry.id} className="ew-entry-row" style={{
            display: "flex", alignItems: "center", padding: "0.8rem 1.5rem",
            borderBottom: "1px solid var(--border)", gap: "0.75rem",
            background: editingId === entry.id ? "var(--primary-tint)" : "transparent",
          }}>
            <span style={{
              background: "var(--primary-tint)", color: "var(--primary)",
              padding: "0.18rem 0.55rem", borderRadius: "4px",
              fontSize: "0.78rem", fontWeight: 500, whiteSpace: "nowrap",
            }}>
              {fmt(entry.startDate)} – {fmt(entry.endDate)}
            </span>
            <span style={{ fontSize: "0.85rem", color: "var(--muted)", flex: 1 }}>{entry.label}</span>
            <div className="ew-entry-actions" style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
              <button onClick={() => startEdit(entry)} style={{
                padding: "0.28rem 0.65rem", border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)", background: "none",
                color: "var(--text)", cursor: "pointer", fontSize: "0.78rem",
              }}>
                Bearbeiten
              </button>
              <button onClick={() => handleDelete(entry.id, entry.label)} style={{
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
