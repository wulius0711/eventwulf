"use client";
import { useSearchParams } from "next/navigation";

export default function StornierenContent() {
  const params = useSearchParams();
  const status = params.get("status");

  const content = {
    ok: {
      icon: "✓",
      title: "Anfrage storniert",
      text: "Ihre Anfrage wurde erfolgreich storniert. Wir haben Ihre Absage erhalten.",
      color: "#16a34a",
    },
    already: {
      icon: "ℹ",
      title: "Bereits storniert",
      text: "Diese Anfrage wurde bereits storniert.",
      color: "#6b7280",
    },
    invalid: {
      icon: "✕",
      title: "Link ungültig",
      text: "Dieser Stornierungslink ist ungültig oder abgelaufen.",
      color: "var(--error)",
    },
  }[status ?? "invalid"] ?? {
    icon: "✕",
    title: "Fehler",
    text: "Ein unbekannter Fehler ist aufgetreten.",
    color: "var(--error)",
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "system-ui, sans-serif",
      background: "#f8f9fb",
      padding: "2rem",
    }}>
      <div style={{
        background: "#fff",
        borderRadius: 16,
        padding: "3rem 2.5rem",
        maxWidth: 420,
        width: "100%",
        textAlign: "center",
        boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
      }}>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: `${content.color}18`,
          color: content.color,
          fontSize: "1.75rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 1.25rem",
        }}>
          {content.icon}
        </div>
        <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.3rem", fontWeight: 700, color: "#1a1612" }}>
          {content.title}
        </h1>
        <p style={{ margin: 0, color: "#6b7280", fontSize: "0.95rem", lineHeight: 1.6 }}>
          {content.text}
        </p>
      </div>
    </div>
  );
}
