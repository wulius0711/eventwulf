import EventsEditor from "@/components/admin/EventsEditor";

export default function EventsPage() {
  return (
    <div>
      <h1 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "0.5rem" }}>
        Events verwalten
      </h1>
      <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "1.75rem" }}>
        Terminierte Angebote mit Preis und Kapazität — werden im Events-Widget angezeigt und können direkt gebucht werden.
      </p>
      <EventsEditor />
    </div>
  );
}
