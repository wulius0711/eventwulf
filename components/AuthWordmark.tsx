// Eventwulf-Wortmarke für die Auth-Seiten (Login/Signup) — Icon + Text statt
// dem alten Logo-PNG mit CSS-Filter, damit das Icon relativ zur Schrift
// skaliert (matcht die Website). Immer weiß: der Hintergrund ist ein Foto,
// nicht das Admin-Theme, --primary passt hier nicht.
export function AuthWordmark({ size = 28 }: { size?: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5em", color: "#fff", fontSize: size, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.02em" }}>
      <svg width="1em" height="1em" viewBox="0 0 44 44" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
        <rect x="1.75" y="1.75" width="40.5" height="40.5" rx="10" stroke="currentColor" strokeWidth="3.5" />
        <path d="M10 16.5H34" stroke="currentColor" strokeWidth="3.5" />
        <rect x="26" y="26" width="6.5" height="6.5" rx="1.5" fill="currentColor" />
      </svg>
      eventwulf
    </span>
  );
}
