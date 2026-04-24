"use client";
import { useState, useEffect } from "react";
import type { BlockedDateEntry } from "@/lib/types";

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function AvailabilityEditor() {
  const [entries, setEntries] = useState<BlockedDateEntry[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [label, setLabel] = useState("nicht verfügbar");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/availability")
      .then((r) => r.json())
      .then(setEntries)
      .catch(() => {});
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!startDate || !endDate) return;
    if (new Date(endDate) < new Date(startDate)) {
      setError("Enddatum muss nach Startdatum liegen");
      return;
    }

    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate, endDate, label }),
    });

    if (res.ok) {
      const entry = await res.json();
      setEntries((prev) => [...prev, entry]);
      setStartDate("");
      setEndDate("");
      setLabel("nicht verfügbar");
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
    if (res.ok) setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Add form */}
      <form
        onSubmit={handleAdd}
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
        <h2 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>
          Zeitraum sperren
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div>
            <label>Von</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label>Bis</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>
        </div>

        <div>
          <label>Bezeichnung</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="nicht verfügbar"
          />
        </div>

        {error && <p style={{ color: "#dc2626", fontSize: "0.85rem", margin: 0 }}>{error}</p>}

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "0.65rem 1.5rem",
            background: "var(--primary)",
            color: "var(--btn-text)",
            border: "none",
            borderRadius: "var(--radius-sm)",
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            alignSelf: "flex-start",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Speichern…" : "Zeitraum sperren"}
        </button>
      </form>

      {/* Existing entries */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "1rem 1.5rem",
            borderBottom: "1px solid var(--border)",
            fontWeight: 600,
            fontSize: "0.95rem",
          }}
        >
          Gesperrte Zeiträume ({entries.length})
        </div>

        {entries.length === 0 ? (
          <p style={{ padding: "1.5rem", color: "var(--muted)", fontSize: "0.85rem" }}>
            Noch keine Zeiträume gesperrt.
          </p>
        ) : (
          <div>
            {entries.map((entry) => (
              <div
                key={entry.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "0.85rem 1.5rem",
                  borderBottom: "1px solid var(--border)",
                  gap: "1rem",
                }}
              >
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                  }}
                >
                  <span
                    style={{
                      background: "var(--primary-tint)",
                      color: "var(--primary)",
                      padding: "0.2rem 0.6rem",
                      borderRadius: "4px",
                      fontSize: "0.78rem",
                      fontWeight: 500,
                    }}
                  >
                    {fmt(entry.startDate)} – {fmt(entry.endDate)}
                  </span>
                  <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                    {entry.label}
                  </span>
                </div>
                <button
                  onClick={() => handleDelete(entry.id)}
                  style={{
                    padding: "0.3rem 0.7rem",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    background: "none",
                    color: "#dc2626",
                    cursor: "pointer",
                    fontSize: "0.8rem",
                  }}
                >
                  Löschen
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
