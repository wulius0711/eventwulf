"use client";
import { useState, useEffect, useRef } from "react";
import type { RoomEntry } from "@/lib/types";
import Toggle from "./Toggle";
import RichTextEditor from "./RichTextEditor";

function emptyForm() {
  return { name: "", description: "", image: "", capacity: "", isActive: true, sortOrder: "0" };
}

export default function RoomsEditor() {
  const [rooms, setRooms] = useState<RoomEntry[]>([]);
  const [locked, setLocked] = useState(false);
  const [lockedMessage, setLockedMessage] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/admin/rooms")
      .then(async (r) => {
        if (r.status === 403) {
          const data = await r.json().catch(() => ({}));
          setLocked(true);
          setLockedMessage(data.error ?? "Räume sind in deinem aktuellen Paket nicht verfügbar.");
          return;
        }
        setRooms(await r.json());
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  function set<K extends keyof ReturnType<typeof emptyForm>>(key: K, value: ReturnType<typeof emptyForm>[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function startEdit(room: RoomEntry) {
    setEditingId(room.id);
    setForm({
      name: room.name, description: room.description, image: room.image,
      capacity: room.capacity != null ? String(room.capacity) : "",
      isActive: room.isActive, sortOrder: String(room.sortOrder),
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
    // Vercel rejects request bodies over ~4.5MB at the platform level before our
    // API route even runs — catch it here so the admin gets a clear message
    // instead of a confusing generic upload failure.
    if (file.size > 4 * 1024 * 1024) {
      setError("Datei zu groß (max. 4MB)");
      return;
    }
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
    setLoading(true);
    setError("");

    const body = {
      ...form,
      capacity: form.capacity === "" ? null : Number(form.capacity),
      sortOrder: Number(form.sortOrder) || 0,
      ...(editingId ? { id: editingId } : {}),
    };

    const res = await fetch("/api/admin/rooms", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const saved = await res.json();
      setRooms((prev) => editingId ? prev.map((r) => r.id === editingId ? saved : r) : [...prev, saved]);
      cancelEdit();
    } else {
      const { error: msg } = await res.json().catch(() => ({ error: "Fehler beim Speichern" }));
      setError(msg);
    }
    setLoading(false);
  }

  async function handleDelete(room: RoomEntry) {
    if (!window.confirm(`Raum „${room.name}" wirklich löschen?`)) return;
    const id = room.id;

    let res = await fetch("/api/admin/rooms", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    if (res.status === 409) {
      const { eventCount } = await res.json().catch(() => ({ eventCount: 0 }));
      const plural = eventCount === 1 ? "einem Event" : `${eventCount} Events`;
      if (
        !window.confirm(
          `Diesem Raum ist noch ${plural} zugeordnet. Beim Löschen bleiben die Events erhalten, verlieren aber ihre Raumzuordnung — der Kalender blockiert diesen Raum dann nicht mehr dafür. Trotzdem löschen?`
        )
      ) {
        return;
      }
      res = await fetch("/api/admin/rooms", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, confirmed: true }),
      });
    }

    if (res.ok) {
      setRooms((prev) => prev.filter((r) => r.id !== id));
      if (editingId === id) cancelEdit();
    }
  }

  const miniBtn: React.CSSProperties = {
    padding: "0.28rem 0.65rem", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
    background: "none", color: "var(--text)", cursor: "pointer", fontSize: "0.78rem",
  };

  if (!loaded) return null;

  if (locked) {
    return (
      <div style={{
        background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: "var(--radius)",
        padding: "2.5rem 1.5rem", textAlign: "center", display: "flex", flexDirection: "column", gap: "0.5rem", alignItems: "center",
      }}>
        <div style={{ fontSize: "1.5rem" }}>🔒</div>
        <p style={{ margin: 0, fontWeight: 600, fontSize: "0.95rem" }}>Räume sind noch nicht freigeschaltet</p>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.85rem", maxWidth: "32rem" }}>{lockedMessage}</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      <p style={{ color: "var(--muted)", fontSize: "0.85rem", margin: 0 }}>
        Räume mit Kapazität und Bild — können im Buchungsformular ausgewählt werden.
      </p>
      <form onSubmit={handleSubmit} style={{
        background: "var(--surface)", border: `1px solid ${editingId ? "var(--primary)" : "var(--border)"}`,
        borderRadius: "var(--radius)", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem",
      }}>
        {editingId && <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--primary)", fontWeight: 600 }}>Raum wird bearbeitet</p>}

        <div>
          <label>Raum-Name *</label>
          <input type="text" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="z.B. Großer Saal" required />
        </div>

        <div>
          <label>Beschreibung</label>
          <RichTextEditor value={form.description} onChange={(html) => set("description", html)} />
        </div>

        <div>
          <label>Bild</label>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
              {form.image && <img src={form.image} alt="" style={{ width: "3rem", height: "3rem", borderRadius: "6px", objectFit: "cover" }} />}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                disabled={uploading}
                style={{ display: "none" }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                style={{
                  padding: "0.5rem 1rem", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
                  background: "none", color: "var(--text)", cursor: uploading ? "not-allowed" : "pointer", fontSize: "0.85rem",
                }}
              >
                {form.image ? "Bild ändern" : "Bild hochladen"}
              </button>
              {uploading && <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Lädt hoch…</span>}
            </div>
            <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
              {form.image ? "Neues Bild wählen, um das aktuelle zu ersetzen" : "JPEG, PNG oder WebP, wird automatisch optimiert (max. 4MB)"}
            </span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(160px, 100%), 1fr))", gap: "1rem" }}>
          <div>
            <label>Kapazität (Personen)</label>
            <input type="number" min="1" value={form.capacity} onChange={(e) => set("capacity", e.target.value)} placeholder="unbegrenzt" />
          </div>
          <div>
            <label>Sortierung</label>
            <input type="number" value={form.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} />
          </div>
        </div>

        <label style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", cursor: "pointer", fontSize: "0.88rem" }}>
          <Toggle checked={form.isActive} onChange={(v) => set("isActive", v)} />
          <span>
            <strong>Aktiv</strong>
            <span style={{ display: "block", fontSize: "0.78rem", color: "var(--muted)" }}>Nur aktive Räume erscheinen im Buchungsformular</span>
          </span>
        </label>

        {error && <p style={{ color: "var(--error)", fontSize: "0.85rem", margin: 0 }}>{error}</p>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
          {editingId && (
            <button type="button" onClick={cancelEdit} style={{ padding: "0.65rem 1.25rem", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "none", color: "var(--muted)", cursor: "pointer", fontWeight: 500 }}>
              Abbrechen
            </button>
          )}
          <button type="submit" disabled={loading} style={{ padding: "0.65rem 1.5rem", background: "var(--primary)", color: "var(--btn-text)", border: "none", borderRadius: "var(--radius-sm)", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
            {loading ? "Speichern…" : editingId ? "Änderungen speichern" : "Raum anlegen"}
          </button>
        </div>
      </form>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
        <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: "0.95rem" }}>
          Räume ({rooms.length})
        </div>
        {rooms.length === 0 ? (
          <p style={{ padding: "1.25rem 1.5rem", color: "var(--muted)", fontSize: "0.85rem" }}>Noch keine Räume angelegt.</p>
        ) : rooms.map((room) => (
          <div key={room.id} style={{ borderBottom: "1px solid var(--border)", background: editingId === room.id ? "var(--primary-tint)" : "transparent" }}>
            <div style={{ display: "flex", alignItems: "center", padding: "0.8rem 1.5rem", gap: "0.75rem" }}>
              {room.image ? (
                <img src={room.image} alt="" style={{ width: "2.5rem", height: "2.5rem", borderRadius: "6px", objectFit: "cover", flexShrink: 0 }} />
              ) : (
                <div style={{ width: "2.5rem", height: "2.5rem", borderRadius: "6px", background: "var(--bg2)", flexShrink: 0 }} />
              )}
              <span style={{ fontSize: "0.85rem", fontWeight: 500, flex: 1 }}>
                {room.name}
                {room.capacity != null && <span style={{ color: "var(--muted)", fontWeight: 400 }}> · bis {room.capacity} Personen</span>}
              </span>
              <span style={{
                background: room.isActive ? "var(--badge-confirmed-bg)" : "var(--badge-neutral-bg)",
                color: room.isActive ? "var(--badge-confirmed-text)" : "var(--badge-neutral-text)",
                padding: "0.18rem 0.55rem", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 600, whiteSpace: "nowrap",
              }}>
                {room.isActive ? "Aktiv" : "Inaktiv"}
              </span>
              <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                <button onClick={() => startEdit(room)} style={miniBtn}>Bearbeiten</button>
                <button onClick={() => handleDelete(room)} style={{ ...miniBtn, color: "var(--error)" }}>Löschen</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
