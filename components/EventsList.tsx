"use client";
import { useState, useEffect, useRef } from "react";
import { sendResizeMessage } from "@/lib/iframeResize";

interface EventItem {
  id: string;
  name: string;
  description: string;
  image: string;
  startDate: string;
  endDate: string;
  color: string;
  pricePerPerson: number;
  minParticipants: number;
  maxParticipants: number | null;
  bookedCount: number;
}

interface Props {
  slug: string;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtPrice(n: number) {
  return n.toLocaleString("de-AT", { style: "currency", currency: "EUR" });
}

function EventCard({ event, slug, expanded, onToggle }: { event: EventItem; slug: string; expanded: boolean; onToggle: () => void }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [count, setCount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!bodyRef.current) return;
    const observer = new ResizeObserver(() => sendResizeMessage());
    observer.observe(bodyRef.current);
    return () => observer.disconnect();
  }, []);

  const remaining = event.maxParticipants != null ? event.maxParticipants - event.bookedCount : null;
  const soldOut = remaining !== null && remaining <= 0;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const personenAnzahl = parseInt(count, 10) || 0;
    if (personenAnzahl < event.minParticipants) {
      setError(`Mindestens ${event.minParticipants} Teilnehmer:innen erforderlich`);
      return;
    }
    if (remaining !== null && personenAnzahl > remaining) {
      setError(`Nur noch ${remaining} Plätze frei`);
      return;
    }
    setSubmitting(true);
    setError("");

    const res = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug,
        eventId: event.id,
        artTitel: event.name,
        nameGruppenleitung: name,
        email,
        datumVon: event.startDate.slice(0, 10),
        datumBis: event.endDate.slice(0, 10),
        personenAnzahl: count,
      }),
    });

    if (res.ok) {
      setDone(true);
    } else {
      const { error: msg } = await res.json().catch(() => ({ error: "Anfrage fehlgeschlagen" }));
      setError(msg);
    }
    setSubmitting(false);
  }

  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)",
      boxShadow: "var(--shadow-card)", overflow: "hidden", display: "flex", flexDirection: "column",
    }}>
      {event.image ? (
        <img src={event.image} alt="" style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover" }} />
      ) : (
        <div style={{ height: "0.5rem", background: event.color || "var(--primary)" }} />
      )}

      <div style={{ padding: "1.1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 600 }}>{event.name}</h3>
        <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
          {fmtDate(event.startDate)} – {fmtDate(event.endDate)}
        </div>
        {event.pricePerPerson > 0 && (
          <div style={{ fontSize: "0.95rem", fontWeight: 600 }}>ab {fmtPrice(event.pricePerPerson)} / Person</div>
        )}

        {soldOut ? (
          <span style={{
            alignSelf: "flex-start", background: "var(--badge-cancelled-bg)", color: "var(--badge-cancelled-text)",
            padding: "0.2rem 0.6rem", borderRadius: "4px", fontSize: "0.78rem", fontWeight: 600,
          }}>
            Ausgebucht
          </span>
        ) : remaining !== null ? (
          <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{remaining} von {event.maxParticipants} Plätzen frei</div>
        ) : null}

        <button
          onClick={onToggle}
          style={{
            marginTop: "0.4rem", alignSelf: "flex-start", background: "none", border: "none",
            color: "var(--primary-text)", fontWeight: 600, fontSize: "0.85rem", cursor: "pointer", padding: 0,
          }}
        >
          {expanded ? "▾ Weniger anzeigen" : "▸ Mehr erfahren"}
        </button>
      </div>

      <div
        style={{ display: "grid", gridTemplateRows: expanded ? "1fr" : "0fr", transition: "grid-template-rows 0.25s ease" }}
        onTransitionEnd={() => { sendResizeMessage(); setTimeout(sendResizeMessage, 200); }}
      >
        <div style={{ overflow: "hidden" }}>
          <div ref={bodyRef} style={{ padding: "0 1.25rem 1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            {event.description && (
              <div
                style={{ margin: 0, fontSize: "0.88rem", color: "var(--text)", lineHeight: 1.5 }}
                dangerouslySetInnerHTML={{ __html: event.description }}
              />
            )}

            {soldOut ? (
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>Dieses Event ist bereits ausgebucht.</p>
            ) : done ? (
              <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--primary-text)", fontWeight: 500 }}>
                Vielen Dank! Deine Anfrage ist eingegangen, wir melden uns in Kürze.
              </p>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div className="ew-field">
                  <input type="text" placeholder=" " value={name} onChange={(e) => setName(e.target.value)} required />
                  <label>Name *</label>
                </div>
                <div className="ew-field">
                  <input type="email" placeholder=" " value={email} onChange={(e) => setEmail(e.target.value)} required />
                  <label>E-Mail *</label>
                </div>
                <div className="ew-field">
                  <input
                    type="number" placeholder=" " min={event.minParticipants} max={remaining ?? undefined}
                    value={count} onChange={(e) => setCount(e.target.value)} required
                  />
                  <label>Personenanzahl *</label>
                </div>
                {error && <p style={{ color: "var(--error)", fontSize: "0.82rem", margin: 0 }}>{error}</p>}
                <button
                  type="submit" disabled={submitting}
                  style={{
                    padding: "0.65rem 1.5rem", background: "var(--primary)", color: "var(--btn-text)",
                    border: "none", borderRadius: "var(--radius-sm)", fontWeight: 600, alignSelf: "flex-start",
                    cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1,
                  }}
                >
                  {submitting ? "Wird gesendet…" : "Jetzt anfragen"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EventsList({ slug }: Props) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/events?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((data) => { setEvents(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [slug]);

  if (loading) return null;

  if (events.length === 0) {
    return <p style={{ textAlign: "center", color: "var(--muted)", fontSize: "0.9rem" }}>Aktuell sind keine Events geplant.</p>;
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(320px, 100%), 1fr))", gap: "1.25rem", alignItems: "start" }}>
      {events.map((ev) => (
        <EventCard
          key={ev.id}
          event={ev}
          slug={slug}
          expanded={expandedId === ev.id}
          onToggle={() => setExpandedId(expandedId === ev.id ? null : ev.id)}
        />
      ))}
    </div>
  );
}
