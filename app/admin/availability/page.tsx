import AvailabilityEditor from "@/components/admin/AvailabilityEditor";

export default function AvailabilityPage() {
  return (
    <div>
      <h1 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "0.5rem" }}>
        Verfügbarkeit verwalten
      </h1>
      <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "1.75rem" }}>
        Markiere Zeiträume als „nicht verfügbar" — sie werden im Kalender angezeigt.
      </p>
      <AvailabilityEditor />
    </div>
  );
}
