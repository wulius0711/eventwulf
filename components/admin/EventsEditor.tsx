"use client";
import { useState, useEffect, useRef } from "react";
import type { EventEntry } from "@/lib/types";
import Toggle from "./Toggle";

const EVENT_COLORS = [
  { label: "Grün",   value: "#16a34a" },
  { label: "Blau",   value: "#2563eb" },
  { label: "Lila",   value: "#7c3aed" },
  { label: "Orange", value: "#ea580c" },
  { label: "Pink",   value: "#db2777" },
  { label: "Grau",   value: "#6b7280" },
];

interface InquiryRow {
  id: string;
  data: string;
  status: string;
  participantCount: number;
  eventId: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  neu: "Neu", in_pruefung: "In Prüfung", angebot_versendet: "Angebot versendet",
  bestaetigt: "Bestätigt", abgelehnt: "Abgelehnt", storniert: "Storniert", abgelaufen: "Abgelaufen",
};

function fmt(iso: string) {
  const d = new Date(iso.substring(0, 10) + "T12:00:00");
  return d.toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function isoDate(iso: string) {
  return iso.substring(0, 10);
}

function todayIso() {
  return new Date().toISOString().substring(0, 10);
}

function fmtPrice(n: number) {
  return n.toLocaleString("de-AT", { style: "currency", currency: "EUR" });
}

function emptyForm() {
  return {
    name: "", description: "", image: "", startDate: "", endDate: "",
    color: EVENT_COLORS[0].value, intern: false, pricePerPerson: "0",
    minParticipants: "1", maxParticipants: "", isActive: true,
  };
}

export default function EventsEditor() {
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [inquiries, setInquiries] = useState<InquiryRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [showPast, setShowPast] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/admin/events").then((r) => r.json()).then(setEvents).catch(() => {});
    fetch("/api/admin/inquiries").then((r) => r.json()).then(setInquiries).catch(() => {});
  }, []);

  function set<K extends keyof ReturnType<typeof emptyForm>>(key: K, value: ReturnType<typeof emptyForm>[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function startEdit(ev: EventEntry) {
    setEditingId(ev.id);
    setForm({
      name: ev.name, description: ev.description, image: ev.image,
      startDate: isoDate(ev.startDate), endDate: isoDate(ev.endDate),
      color: ev.color || EVENT_COLORS[0].value, intern: ev.intern,
      pricePerPerson: String(ev.pricePerPerson), minParticipants: String(ev.minParticipants),
      maxParticipants: ev.maxParticipants != null ? String(ev.maxParticipants) : "",
      isActive: ev.isActive,
    });
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function duplicate(ev: EventEntry) {
    setEditingId(null);
    setForm({
      name: `${ev.name} (Kopie)`, description: ev.description, image: ev.image,
      startDate: "", endDate: "",
      color: ev.color || EVENT_COLORS[0].value, intern: ev.intern,
      pricePerPerson: String(ev.pricePerPerson), minParticipants: String(ev.minParticipants),
      maxParticipants: ev.maxParticipants != null ? String(ev.maxParticipants) : "",
      isActive: true,
    });
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm());
    setError("");
  }

  async function handleUpload(file: File) {
    setUploading(true);
    setError("");
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/admin/events/upload", { method: "POST", body });
    if (res.ok) {
      const { url } = await res.json();
      set("image", url);
    } else {
      const { error: msg } = await res.json().catch(() => ({ error: "Upload fehlgeschlagen" }));
      setError(msg);
    }
    setUploading(false);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.startDate || !form.endDate) return;
    if (new Date(form.endDate) < new Date(form.startDate)) {
      setError("Enddatum muss nach Startdatum liegen");
      return;
    }
    setLoading(true);
    setError("");

    const body = {
      ...form,
      pricePerPerson: Number(form.pricePerPerson) || 0,
      minParticipants: Number(form.minParticipants) || 1,
      maxParticipants: form.maxParticipants === "" ? null : Number(form.maxParticipants),
      ...(editingId ? { id: editingId } : {}),
    };

    const res = await fetch("/api/admin/events", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const saved = await res.json();
      setEvents((prev) => editingId ? prev.map((e) => e.id === editingId ? saved : e) : [...prev, saved]);
      cancelEdit();
    } else {
      const { error: msg } = await res.json().catch(() => ({ error: "Fehler beim Speichern" }));
      setError(msg);
    }
    setLoading(false);
  }

  async function handleDelete(ev: EventEntry) {
    const warning = ev.bookedCount > 0
      ? `Event „${ev.name}" wirklich löschen? ${ev.bookedCount} Person(en) haben sich bereits angemeldet — die Anfragen bleiben erhalten, verlieren aber den Bezug zu diesem Event.`
      : `Event „${ev.name}" wirklich löschen?`;
    if (!window.confirm(warning)) return;
    const id = ev.id;
    const res = await fetch("/api/admin/events", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setEvents((prev) => prev.filter((e) => e.id !== id));
      if (editingId === id) cancelEdit();
    }
  }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const upcoming = events.filter((e) => new Date(e.endDate) >= today);
  const past = events.filter((e) => new Date(e.endDate) < today);

  function badge(ev: EventEntry) {
    if (new Date(ev.endDate) < today) return { label: "Vergangen", bg: "var(--badge-neutral-bg)", color: "var(--badge-neutral-text)" };
    if (!ev.isActive) return { label: "Inaktiv", bg: "var(--badge-neutral-bg)", color: "var(--badge-neutral-text)" };
    if (ev.maxParticipants != null && ev.bookedCount >= ev.maxParticipants) return { label: "Ausgebucht", bg: "var(--badge-pending-bg)", color: "var(--badge-pending-text)" };
    return { label: "Aktiv", bg: "var(--badge-confirmed-bg)", color: "var(--badge-confirmed-text)" };
  }

  function renderList(list: EventEntry[]) {
    return list.map((ev) => {
      const b = badge(ev);
      const participants = inquiries.filter((i) => i.eventId === ev.id);
      return (
        <div key={ev.id} style={{ borderBottom: "1px solid var(--border)", background: editingId === ev.id ? "var(--primary-tint)" : "transparent" }}>
          <div style={{ display: "flex", alignItems: "center", padding: "0.8rem 1.5rem", gap: "0.75rem" }}>
            {ev.image ? (
              <img src={ev.image} alt="" style={{ width: "2.5rem", height: "2.5rem", borderRadius: "6px", objectFit: "cover", flexShrink: 0 }} />
            ) : (
              <div style={{ width: "0.75rem", height: "0.75rem", borderRadius: "50%", background: ev.color || "#16a34a", flexShrink: 0 }} />
            )}
            <span style={{ background: "var(--primary-tint)", color: "var(--primary-text)", padding: "0.18rem 0.55rem", borderRadius: "4px", fontSize: "0.78rem", fontWeight: 500, whiteSpace: "nowrap" }}>
              {fmt(ev.startDate)} – {fmt(ev.endDate)}
            </span>
            <span style={{ fontSize: "0.85rem", fontWeight: 500, flex: 1, cursor: "pointer" }} onClick={() => setExpandedId(expandedId === ev.id ? null : ev.id)}>
              {ev.name}
              {ev.pricePerPerson > 0 && <span style={{ color: "var(--muted)", fontWeight: 400 }}> · {fmtPrice(ev.pricePerPerson)} / Person</span>}
              {ev.maxParticipants != null && <span style={{ color: "var(--muted)", fontWeight: 400 }}> · {ev.bookedCount}/{ev.maxParticipants} Plätze</span>}
              {ev.intern && <span style={{ color: "var(--muted)", fontWeight: 400 }}> · intern (sperrt Kalender)</span>}
            </span>
            <span style={{ background: b.bg, color: b.color, padding: "0.18rem 0.55rem", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 600, whiteSpace: "nowrap" }}>{b.label}</span>
            <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
              <button onClick={() => startEdit(ev)} style={miniBtn}>Bearbeiten</button>
              <button onClick={() => duplicate(ev)} style={miniBtn}>Duplizieren</button>
              <button onClick={() => handleDelete(ev)} style={{ ...miniBtn, color: "var(--error)" }}>Löschen</button>
            </div>
          </div>
          {expandedId === ev.id && (
            <div style={{ padding: "0 1.5rem 1rem 1.5rem" }}>
              {participants.length === 0 ? (
                <p style={{ fontSize: "0.8rem", color: "var(--muted)", margin: 0 }}>Noch keine Anmeldungen.</p>
              ) : (
                <table style={{ width: "100%", fontSize: "0.82rem", borderCollapse: "collapse" }}>
                  <tbody>
                    {participants.map((p) => {
                      let name = "–";
                      try { name = JSON.parse(p.data).nameGruppenleitung || "–"; } catch { /* ignore */ }
                      return (
                        <tr key={p.id} style={{ borderTop: "1px solid var(--border)" }}>
                          <td style={{ padding: "0.4rem 0" }}>{name}</td>
                          <td style={{ padding: "0.4rem 0", color: "var(--muted)" }}>{p.participantCount} Personen</td>
                          <td style={{ padding: "0.4rem 0", color: "var(--muted)" }}>{STATUS_LABELS[p.status] ?? p.status}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      );
    });
  }

  const miniBtn: React.CSSProperties = {
    padding: "0.28rem 0.65rem", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
    background: "none", color: "var(--text)", cursor: "pointer", fontSize: "0.78rem",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      <form onSubmit={handleSubmit} style={{
        background: "var(--surface)", border: `1px solid ${editingId ? "var(--primary)" : "var(--border)"}`,
        borderRadius: "var(--radius)", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem",
      }}>
        {editingId && <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--primary)", fontWeight: 600 }}>Event wird bearbeitet</p>}

        <div>
          <label>Event-Name *</label>
          <input type="text" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="z.B. Yoga-Retreat im Herbst" required />
        </div>

        <div>
          <label>Beschreibung</label>
          <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} style={{ width: "100%", resize: "vertical" }} />
        </div>

        <div>
          <label>Bild</label>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            {form.image && <img src={form.image} alt="" style={{ width: "3rem", height: "3rem", borderRadius: "6px", objectFit: "cover" }} />}
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} disabled={uploading} />
            {uploading && <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Lädt hoch…</span>}
          </div>
        </div>

        <div className="ew-date-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div>
            <label>Von</label>
            <input
              type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} required
              min={editingId ? undefined : todayIso()}
            />
          </div>
          <div>
            <label>Bis</label>
            <input
              type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} required
              min={editingId ? undefined : (form.startDate || todayIso())}
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(160px, 100%), 1fr))", gap: "1rem" }}>
          <div>
            <label>Preis pro Person (€)</label>
            <input type="number" min="0" step="0.01" value={form.pricePerPerson} onChange={(e) => set("pricePerPerson", e.target.value)} />
          </div>
          <div>
            <label>Min. Teilnehmer</label>
            <input type="number" min="1" value={form.minParticipants} onChange={(e) => set("minParticipants", e.target.value)} />
          </div>
          <div>
            <label>Max. Teilnehmer</label>
            <input type="number" min="1" value={form.maxParticipants} onChange={(e) => set("maxParticipants", e.target.value)} placeholder="unbegrenzt" />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "1rem", alignItems: "end" }}>
          <div>
            <label>Farbe</label>
            <div style={{ display: "flex", gap: "0.4rem" }}>
              {EVENT_COLORS.map((c) => (
                <button key={c.value} type="button" onClick={() => set("color", c.value)} title={c.label} style={{
                  width: "1.6rem", height: "1.6rem", borderRadius: "50%", background: c.value, flexShrink: 0,
                  border: form.color === c.value ? "3px solid var(--text)" : "2px solid transparent", cursor: "pointer",
                }} />
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <label style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", cursor: "pointer", fontSize: "0.88rem" }}>
            <Toggle checked={form.intern} onChange={(v) => set("intern", v)} />
            <span>
              <strong>Intern</strong>
              <span style={{ display: "block", fontSize: "0.78rem", color: "var(--muted)" }}>Sperrt den Zeitraum im allgemeinen Kalender für andere Anfragen</span>
            </span>
          </label>
          <label style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", cursor: "pointer", fontSize: "0.88rem" }}>
            <Toggle checked={form.isActive} onChange={(v) => set("isActive", v)} />
            <span>
              <strong>Aktiv</strong>
              <span style={{ display: "block", fontSize: "0.78rem", color: "var(--muted)" }}>Nur aktive Events erscheinen im Buchungswidget (z.B. aus, um einen Entwurf vorzubereiten oder ein Event vorübergehend auszublenden, ohne es zu löschen)</span>
            </span>
          </label>
        </div>

        {error && <p style={{ color: "var(--error)", fontSize: "0.85rem", margin: 0 }}>{error}</p>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
          {editingId && (
            <button type="button" onClick={cancelEdit} style={{ padding: "0.65rem 1.25rem", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "none", color: "var(--muted)", cursor: "pointer", fontWeight: 500 }}>
              Abbrechen
            </button>
          )}
          <button type="submit" disabled={loading} style={{ padding: "0.65rem 1.5rem", background: "var(--primary)", color: "var(--btn-text)", border: "none", borderRadius: "var(--radius-sm)", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
            {loading ? "Speichern…" : editingId ? "Änderungen speichern" : "Event anlegen"}
          </button>
        </div>
      </form>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
        <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: "0.95rem" }}>
          Bevorstehende Events ({upcoming.length})
        </div>
        {upcoming.length === 0 ? (
          <p style={{ padding: "1.25rem 1.5rem", color: "var(--muted)", fontSize: "0.85rem" }}>Noch keine Events geplant.</p>
        ) : renderList(upcoming)}
      </div>

      {past.length > 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
          <button onClick={() => setShowPast((v) => !v)} style={{ width: "100%", textAlign: "left", padding: "1rem 1.5rem", borderBottom: showPast ? "1px solid var(--border)" : "none", fontWeight: 600, fontSize: "0.95rem", background: "none", border: "none", cursor: "pointer", color: "var(--text)" }}>
            {showPast ? "▾" : "▸"} Vergangene Events ({past.length})
          </button>
          {showPast && renderList(past)}
        </div>
      )}
    </div>
  );
}
