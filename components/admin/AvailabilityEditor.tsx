"use client";
import { useState, useEffect } from "react";
import type { BlockedDateEntry } from "@/lib/types";

const EVENT_COLORS = [
  { label: "Grün",   value: "#16a34a" },
  { label: "Blau",   value: "#2563eb" },
  { label: "Lila",   value: "#7c3aed" },
  { label: "Orange", value: "#ea580c" },
  { label: "Pink",   value: "#db2777" },
  { label: "Grau",   value: "#6b7280" },
];

function fmt(iso: string) {
  const d = new Date(iso.substring(0, 10) + "T12:00:00");
  return d.toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function isoDate(iso: string) {
  return iso.substring(0, 10);
}

type EntryType = "blocked" | "event";

export default function AvailabilityEditor() {
  const [entries, setEntries]     = useState<BlockedDateEntry[]>([]);
  const [tab, setTab]             = useState<EntryType>("blocked");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [startDate, setStartDate]   = useState("");
  const [endDate, setEndDate]       = useState("");
  const [label, setLabel]           = useState("");
  const [color, setColor]           = useState(EVENT_COLORS[0].value);
  const [maxCapacity, setMaxCapacity] = useState("");
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");

  useEffect(() => {
    fetch("/api/admin/availability")
      .then((r) => r.json())
      .then(setEntries)
      .catch(() => {});
  }, []);

  function startEdit(entry: BlockedDateEntry) {
    setEditingId(entry.id);
    setTab(entry.type as EntryType);
    setStartDate(isoDate(entry.startDate));
    setEndDate(isoDate(entry.endDate));
    setLabel(entry.label);
    setColor(entry.color || EVENT_COLORS[0].value);
    setMaxCapacity(entry.maxCapacity != null ? String(entry.maxCapacity) : "");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setStartDate(""); setEndDate(""); setLabel("");
    setColor(EVENT_COLORS[0].value);
    setMaxCapacity("");
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
      type: tab,
      label: label || (tab === "blocked" ? "nicht verfügbar" : ""),
      color: tab === "event" ? color : "",
      maxCapacity: tab === "event" && maxCapacity ? Number(maxCapacity) : null,
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

  async function handleDelete(id: string) {
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

  const tabStyle = (t: EntryType) => ({
    padding: "0.45rem 1rem",
    border: "none",
    borderBottom: `2px solid ${tab === t ? "var(--primary)" : "transparent"}`,
    background: "none",
    color: tab === t ? "var(--primary)" : "var(--muted)",
    cursor: "pointer",
    fontWeight: tab === t ? 600 : 400,
    fontSize: "0.88rem",
  });

  const blocked = entries.filter((e) => e.type === "blocked");
  const events  = entries.filter((e) => e.type === "event");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>

      {/* Tab nav */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", gap: "0.25rem" }}>
        <button style={tabStyle("blocked")} onClick={() => { setTab("blocked"); if (!editingId) cancelEdit(); }}>Zeitraum sperren</button>
        <button style={tabStyle("event")}   onClick={() => { setTab("event");   if (!editingId) cancelEdit(); }}>Event eintragen</button>
      </div>

      {/* Form */}
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

        {tab === "blocked" ? (
          <div>
            <label>Bezeichnung (optional)</label>
            <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="nicht verfügbar" />
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "1rem", alignItems: "end" }}>
              <div>
                <label>Event-Name *</label>
                <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="z.B. Seminarwoche Gruppe Müller" required />
              </div>
              <div>
                <label>Farbe</label>
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  {EVENT_COLORS.map((c) => (
                    <button key={c.value} type="button" onClick={() => setColor(c.value)} title={c.label} style={{
                      width: "1.6rem", height: "1.6rem", borderRadius: "50%", background: c.value, flexShrink: 0,
                      border: color === c.value ? "3px solid var(--text)" : "2px solid transparent", cursor: "pointer",
                    }} />
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label>Max. Kapazität (Teilnehmer, optional)</label>
              <input type="number" min="1" value={maxCapacity} onChange={(e) => setMaxCapacity(e.target.value)}
                placeholder="z.B. 30 – leer lassen für unbegrenzt" style={{ maxWidth: "280px" }} />
            </div>
          </>
        )}

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
            {loading ? "Speichern…" : editingId ? "Änderungen speichern" : tab === "blocked" ? "Zeitraum sperren" : "Event speichern"}
          </button>
        </div>
      </form>

      {/* Lists */}
      {[
        { title: "Gesperrte Zeiträume", list: blocked, accent: "var(--primary)" as string | undefined },
        { title: "Eingetragene Events",  list: events,  accent: undefined as string | undefined },
      ].map(({ title, list, accent }) => (
        <div key={title} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
          <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: "0.95rem" }}>
            {title} ({list.length})
          </div>
          {list.length === 0 ? (
            <p style={{ padding: "1.25rem 1.5rem", color: "var(--muted)", fontSize: "0.85rem" }}>Noch keine Einträge.</p>
          ) : list.map((entry) => (
            <div key={entry.id} className="ew-entry-row" style={{
              display: "flex", alignItems: "center", padding: "0.8rem 1.5rem",
              borderBottom: "1px solid var(--border)", gap: "0.75rem",
              background: editingId === entry.id ? "var(--primary-tint)" : "transparent",
            }}>
              {entry.type === "event" && (
                <div style={{ width: "0.75rem", height: "0.75rem", borderRadius: "50%", background: entry.color || "#16a34a", flexShrink: 0 }} />
              )}
              <span style={{
                background: accent ? "var(--primary-tint)" : `${entry.color}22`,
                color: accent ?? entry.color,
                padding: "0.18rem 0.55rem", borderRadius: "4px",
                fontSize: "0.78rem", fontWeight: 500, whiteSpace: "nowrap",
              }}>
                {fmt(entry.startDate)} – {fmt(entry.endDate)}
              </span>
              <span style={{ fontSize: "0.85rem", color: "var(--muted)", flex: 1 }}>
                {entry.label}
                {entry.type === "event" && entry.maxCapacity != null && (
                  <span style={{
                    marginLeft: "0.6rem", fontSize: "0.75rem", fontWeight: 500,
                    color: entry.bookedCount! >= entry.maxCapacity ? "var(--error)" : "#16a34a",
                  }}>
                    {entry.bookedCount}/{entry.maxCapacity} Plätze belegt
                  </span>
                )}
              </span>
              <div className="ew-entry-actions" style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                <button onClick={() => startEdit(entry)} style={{
                  padding: "0.28rem 0.65rem", border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)", background: "none",
                  color: "var(--text)", cursor: "pointer", fontSize: "0.78rem",
                }}>
                  Bearbeiten
                </button>
                <button onClick={() => handleDelete(entry.id)} style={{
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
      ))}
    </div>
  );
}
