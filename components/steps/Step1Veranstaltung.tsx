"use client";
import { useState, useEffect, useRef } from "react";
import { useFormStore } from "@/store/form";
import Calendar from "@/components/Calendar";
import type { EventConfig, RoomEntry } from "@/lib/types";

interface Props {
  slug: string;
  config: EventConfig;
  initialRooms?: RoomEntry[];
}

const HOURS = Array.from({ length: 19 }, (_, i) => {
  const h = i + 6;
  return `${String(h).padStart(2, "0")}:00`;
});

function RoomPicker({ slug, config, initialRooms }: { slug: string; config: EventConfig; initialRooms?: RoomEntry[] }) {
  const { form, setField } = useFormStore();
  const [rooms, setRooms] = useState<RoomEntry[]>(initialRooms ?? []);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Server already provided the unfiltered room list for the no-dates-selected
  // case — skip re-fetching that exact same thing on mount (it caused a second,
  // late layout shift as the iframe embed resized again right after the user's
  // first paint). Any date-range change past this point still refetches to get
  // per-date availability.
  const skippedInitialFetch = useRef(!!initialRooms?.length);

  useEffect(() => {
    if (skippedInitialFetch.current) {
      skippedInitialFetch.current = false;
      if (!form.datumVon || !form.datumBis) return;
    }
    const dateParams = form.datumVon && form.datumBis
      ? `&datumVon=${encodeURIComponent(form.datumVon)}&datumBis=${encodeURIComponent(form.datumBis)}`
      : "";
    fetch(`/api/rooms?slug=${encodeURIComponent(slug)}${dateParams}`)
      .then((r) => r.json()).then(setRooms).catch(() => {});
  }, [slug, form.datumVon, form.datumBis]);

  if (config.formFields?.raum === false || rooms.length === 0) return null;

  function select(room: RoomEntry) {
    if (room.available === false) return;
    const alreadySelected = form.roomId === room.id;
    setField("roomId", alreadySelected ? "" : room.id);
    setField("raum", alreadySelected ? "" : room.name);
    setField("raumKapazitaet", alreadySelected ? null : room.capacity);
  }

  return (
    <div>
      <label style={{ marginBottom: "0.5rem", display: "block" }}>Raum wählen *</label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(180px, 100%), 1fr))", gap: "0.75rem" }}>
        {rooms.map((room) => {
          const selected = form.roomId === room.id;
          const unavailable = room.available === false;
          const descExpanded = expandedId === room.id;
          return (
            <div
              key={room.id}
              role="button"
              tabIndex={unavailable ? -1 : 0}
              aria-disabled={unavailable}
              aria-pressed={selected}
              onClick={() => select(room)}
              onKeyDown={(e) => {
                if (unavailable) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  select(room);
                }
              }}
              title={unavailable ? "Für den gewählten Zeitraum nicht verfügbar" : undefined}
              style={{
                textAlign: "left", padding: 0, overflow: "hidden",
                cursor: unavailable ? "not-allowed" : "pointer",
                borderRadius: "var(--radius-sm)", border: `1px solid ${selected ? "var(--primary)" : "var(--border-strong, var(--border))"}`,
                boxShadow: selected ? "0 0 0 3px var(--primary-tint)" : "none",
                background: "var(--surface)", display: "flex", flexDirection: "column",
                opacity: unavailable ? 0.45 : 1,
              }}
            >
              {room.image ? (
                <img src={room.image} alt="" style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", filter: unavailable ? "grayscale(1)" : undefined }} />
              ) : (
                <div style={{ width: "100%", aspectRatio: "16/9", background: "var(--bg2)" }} />
              )}
              <div style={{ padding: "0.5rem 0.65rem" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text)" }}>{room.name}</div>
                {room.capacity != null && (
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>bis {room.capacity} Personen</div>
                )}
                {room.description && (
                  <div style={{ marginTop: "0.25rem" }}>
                    <div
                      className="ew-desc"
                      style={{
                        fontSize: "0.75rem", color: "var(--muted)", lineHeight: 1.4,
                        display: descExpanded ? "block" : "-webkit-box",
                        WebkitLineClamp: descExpanded ? "unset" : 2,
                        WebkitBoxOrient: "vertical",
                        overflow: descExpanded ? "visible" : "hidden",
                      }}
                      dangerouslySetInnerHTML={{ __html: room.description }}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedId((prev) => (prev === room.id ? null : room.id));
                      }}
                      style={{
                        marginTop: "0.15rem", background: "none", border: "none", padding: 0,
                        color: "var(--primary-text)", fontWeight: 600, fontSize: "0.72rem", cursor: "pointer",
                      }}
                    >
                      {descExpanded ? "▾ Weniger anzeigen" : "▸ Mehr anzeigen"}
                    </button>
                  </div>
                )}
                {unavailable && (
                  <div style={{ fontSize: "0.72rem", color: "var(--error)", marginTop: "0.15rem" }}>Nicht verfügbar</div>
                )}
              </div>
            </div>
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

export default function Step1Veranstaltung({ slug, config, initialRooms }: Props) {
  const { form, setField } = useFormStore();
  const [dateConflict, setDateConflict] = useState(false);

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
    setDateConflict(false);
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

      <div>
        <label style={{ marginBottom: "0.5rem", display: "block" }}>Zeitraum wählen</label>
        <Calendar
          slug={slug} selectedStart={selectedStart} selectedEnd={selectedEnd} onRangeChange={handleRangeChange}
          roomId={form.roomId}
          onInvalidSelectionCleared={() => setDateConflict(true)}
        />
        {dateConflict && (
          <p className="ew-form-error">
            Der zuvor gewählte Zeitraum ist für „{form.raum}" nicht verfügbar und wurde zurückgesetzt. Bitte wähle einen neuen Zeitraum.
          </p>
        )}
      </div>

      <RoomPicker slug={slug} config={config} initialRooms={initialRooms} />

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
