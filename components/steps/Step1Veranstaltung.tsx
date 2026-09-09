"use client";
import { useState, useEffect } from "react";
import { useFormStore } from "@/store/form";
import Calendar from "@/components/Calendar";
import type { EventConfig, RoomEntry } from "@/lib/types";

interface Props {
  slug: string;
  config: EventConfig;
}

const HOURS = Array.from({ length: 19 }, (_, i) => {
  const h = i + 6;
  return `${String(h).padStart(2, "0")}:00`;
});

function RoomPicker({ slug, config }: { slug: string; config: EventConfig }) {
  const { form, setField } = useFormStore();
  const [rooms, setRooms] = useState<RoomEntry[]>([]);

  useEffect(() => {
    fetch(`/api/rooms?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json()).then(setRooms).catch(() => {});
  }, [slug]);

  if (config.formFields?.raum === false || rooms.length === 0) return null;

  function select(room: RoomEntry) {
    const alreadySelected = form.roomId === room.id;
    setField("roomId", alreadySelected ? "" : room.id);
    setField("raum", alreadySelected ? "" : room.name);
  }

  return (
    <div>
      <label style={{ marginBottom: "0.5rem", display: "block" }}>Raum wählen</label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(180px, 100%), 1fr))", gap: "0.75rem" }}>
        {rooms.map((room) => {
          const selected = form.roomId === room.id;
          return (
            <button
              key={room.id}
              type="button"
              onClick={() => select(room)}
              style={{
                textAlign: "left", padding: 0, overflow: "hidden", cursor: "pointer",
                borderRadius: "var(--radius-sm)", border: `2px solid ${selected ? "var(--primary)" : "var(--border)"}`,
                background: "var(--surface)", display: "flex", flexDirection: "column",
              }}
            >
              {room.image ? (
                <img src={room.image} alt="" style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover" }} />
              ) : (
                <div style={{ width: "100%", aspectRatio: "16/9", background: "var(--bg2)" }} />
              )}
              <div style={{ padding: "0.5rem 0.65rem" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text)" }}>{room.name}</div>
                {room.capacity != null && (
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>bis {room.capacity} Personen</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function fmtDate(iso: string) {
  if (!iso) return "–";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export default function Step1Veranstaltung({ slug, config }: Props) {
  const { form, setField } = useFormStore();

  const selectedStart = form.datumVon ? new Date(form.datumVon + "T12:00:00") : null;
  const selectedEnd = form.datumBis ? new Date(form.datumBis + "T12:00:00") : null;
  const showUhrzeiten = config.formFields?.uhrzeiten !== false;

  function localISO(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function handleRangeChange(start: Date | null, end: Date | null) {
    setField("datumVon", start ? localISO(start) : "");
    setField("datumBis", end ? localISO(end) : "");
  }

  const hasRange = form.datumVon || form.datumBis;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div className="ew-field">
        <input type="text" placeholder=" " value={form.artTitel} onChange={(e) => setField("artTitel", e.target.value)} autoFocus />
        <label>Art / Titel der Veranstaltung *</label>
      </div>

      <RoomPicker slug={slug} config={config} />

      <div>
        <label style={{ marginBottom: "0.5rem", display: "block" }}>Zeitraum wählen</label>
        <Calendar slug={slug} selectedStart={selectedStart} selectedEnd={selectedEnd} onRangeChange={handleRangeChange} showCapacity={config.showCapacity === true} roomId={form.roomId} />
      </div>

      <div className="ew-date-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", background: hasRange ? "var(--primary-tint)" : "var(--bg2)", border: `1px solid ${hasRange ? "var(--primary-dim)" : "var(--border)"}`, borderRadius: "var(--radius-sm)", padding: "0.85rem 1rem", transition: "all 0.2s" }}>
        <div>
          <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginBottom: "0.2rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>Anreise</div>
          <div style={{ fontWeight: 600, fontSize: "0.95rem", color: hasRange ? "var(--primary-text)" : "var(--muted)" }}>{fmtDate(form.datumVon)}</div>
        </div>
        <div>
          <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginBottom: "0.2rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>Abreise</div>
          <div style={{ fontWeight: 600, fontSize: "0.95rem", color: hasRange ? "var(--primary-text)" : "var(--muted)" }}>{fmtDate(form.datumBis)}</div>
        </div>
      </div>

      {showUhrzeiten && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))", gap: "1rem" }}>
          <div className={`ew-field${form.zeitVon ? " has-value" : ""}`}>
            <select value={form.zeitVon} onChange={(e) => setField("zeitVon", e.target.value)}>
              <option value=""></option>
              {HOURS.map((h) => <option key={h} value={h}>{h} Uhr</option>)}
            </select>
            <label>Veranstaltungsbeginn (Uhrzeit)</label>
          </div>
          <div className={`ew-field${form.zeitBis ? " has-value" : ""}`}>
            <select value={form.zeitBis} onChange={(e) => setField("zeitBis", e.target.value)}>
              <option value=""></option>
              {HOURS.map((h) => <option key={h} value={h}>{h} Uhr</option>)}
            </select>
            <label>Veranstaltungsende (Uhrzeit)</label>
          </div>
        </div>
      )}
    </div>
  );
}
