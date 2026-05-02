"use client";
import { useState } from "react";

const sections = [
  { id: "login",          title: "Login" },
  { id: "navigation",     title: "Navigation & Oberfläche" },
  { id: "einstellungen",  title: "Einstellungen" },
  { id: "anfragen",       title: "Anfragen" },
  { id: "angebote",       title: "Angebote" },
  { id: "verfuegbarkeit", title: "Verfügbarkeit" },
  { id: "pakete",         title: "Seminarpakete" },
  { id: "vorschau",       title: "Vorschau" },
  { id: "faq",            title: "Häufige Fragen" },
];

const content: Record<string, React.ReactNode> = {
  login: (
    <>
      <p>Öffne <code>/admin/login</code> und melde dich mit E-Mail und Passwort an. Nach dem Login wirst du automatisch zu den Einstellungen weitergeleitet.</p>
      <p style={{ marginTop: "0.75rem" }}>Die Session bleibt aktiv bis du dich abmeldest (Button in der Sidebar unten links). Bei Inaktivität läuft die Session nach 7 Tagen ab.</p>
    </>
  ),
  navigation: (
    <>
      <p>Die Sidebar links enthält alle Bereiche:</p>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1rem", fontSize: "0.875rem" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            <th style={{ textAlign: "left", padding: "0.5rem 0.75rem", color: "var(--muted)", fontWeight: 600 }}>Menüpunkt</th>
            <th style={{ textAlign: "left", padding: "0.5rem 0.75rem", color: "var(--muted)", fontWeight: 600 }}>Beschreibung</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["Einstellungen", "Firmendaten, Formular, Abrechnung, Einbetten, Passwort"],
            ["Pakete", "Seminarpakete anlegen und verwalten"],
            ["Verfügbarkeit", "Kalender mit gesperrten Daten und Events"],
            ["Anfragen", "Eingehende Anfragen bearbeiten"],
            ["Dokumente", "Angebots-Archiv"],
            ["Vorschau", "Live-Vorschau des Buchungswidgets"],
            ["Handbuch", "Diese Hilfeseite"],
          ].map(([item, desc]) => (
            <tr key={item} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ padding: "0.6rem 0.75rem", fontWeight: 500 }}>{item}</td>
              <td style={{ padding: "0.6rem 0.75rem", color: "var(--muted)" }}>{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ marginTop: "1rem" }}><strong>Dark / Light Mode:</strong> Das Icon neben dem Abmelden-Button schaltet zwischen den Modi um. Die Einstellung wird gespeichert.</p>
    </>
  ),
  einstellungen: (
    <>
      <p>Die Einstellungen sind in fünf Tabs unterteilt.</p>
      <H3>Firma</H3>
      <p>Basisdaten deiner Organisation: Name, Tagline, Logo-URL, Primärfarbe, Hintergrundfarbe, Kontaktdaten und Benachrichtigungs-E-Mail.</p>
      <Callout>Die <strong>Benachrichtigungs-E-Mail</strong> erhält bei jeder neuen Anfrage eine Benachrichtigungsmail.</Callout>
      <H3>Formular</H3>
      <p>Wähle per Checkbox welche optionalen Felder im Buchungsformular angezeigt werden. Die Felder sind nach Schritten gruppiert (Veranstaltung, Gruppe, Ausstattung, Verpflegung, Abschluss).</p>
      <p style={{ marginTop: "0.5rem" }}>Darunter kannst du die Dropdown-Optionen für Verpflegung, Zimmerwunsch und Abrechnung anpassen.</p>
      <H3>Abrechnung</H3>
      <p>Steuersatz (%) und Gültigkeitsdauer für neue Angebote in Tagen.</p>
      <H3>Einbetten</H3>
      <p>Fertiger HTML-Code zum Einbetten des Widgets in deine Website. Einfach kopieren und in den <code>&lt;body&gt;</code> einfügen.</p>
      <H3>Passwort</H3>
      <p>Aktuelles Passwort eingeben und neues Passwort (mind. 8 Zeichen) zweimal bestätigen.</p>
    </>
  ),
  anfragen: (
    <>
      <p>Alle eingehenden Anfragen erscheinen hier sortiert nach Eingangsdatum.</p>
      <H3>Status-Workflow</H3>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "0.75rem", fontSize: "0.875rem" }}>
        <tbody>
          {[
            ["Neu", "#3b82f6", "Anfrage eingegangen, noch nicht bearbeitet"],
            ["In Prüfung", "#f59e0b", "Wird gerade bearbeitet"],
            ["Angebot versendet", "#8b5cf6", "Angebot wurde erstellt und verschickt"],
            ["Bestätigt", "#10b981", "Buchung ist bestätigt"],
            ["Abgelehnt", "#ef4444", "Anfrage wurde abgelehnt"],
          ].map(([status, color, desc]) => (
            <tr key={status as string} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ padding: "0.6rem 0.75rem" }}>
                <span style={{ background: color as string, color: "#fff", padding: "0.15rem 0.5rem", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 600 }}>{status}</span>
              </td>
              <td style={{ padding: "0.6rem 0.75rem", color: "var(--muted)", fontSize: "0.875rem" }}>{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <H3>Anfrage öffnen</H3>
      <p>Klick auf eine Anfrage öffnet die Detailansicht mit allen Formulardaten. Im rechten Bereich befindet sich das Angebots-Panel.</p>
    </>
  ),
  angebote: (
    <>
      <H3>Angebot erstellen</H3>
      <p>Öffne eine Anfrage und klicke im Angebots-Panel auf <strong>+ Angebot</strong>. Die Nummer wird automatisch vergeben (ANB-YYYY-XXXX).</p>
      <p style={{ marginTop: "0.5rem" }}>Du kannst Positionen (Bezeichnung, Menge, Einheit, Preis), Steuersatz und Notizen bearbeiten.</p>
      <H3>Als PDF speichern</H3>
      <p>Klicke auf <strong>Drucken / PDF</strong> im Angebot. Im Browser-Dialog wähle „Als PDF speichern" als Drucker.</p>
      <H3>Archiv</H3>
      <p>Unter <strong>Dokumente</strong> findest du alle Angebote mit Filterung nach Status (Offen / Storniert).</p>
      <Callout>Angebote können storniert, aber nicht gelöscht werden.</Callout>
    </>
  ),
  verfuegbarkeit: (
    <>
      <H3>Kalenderansicht</H3>
      <p>Der Kalender zeigt gesperrte Zeiträume und eingetragene Events. Belegte Tage sind farbig markiert.</p>
      <H3>Eintrag hinzufügen</H3>
      <p>Wähle oben den Typ:</p>
      <ul style={{ marginTop: "0.5rem", paddingLeft: "1.25rem", lineHeight: 1.8 }}>
        <li><strong>Gesperrter Zeitraum</strong> – Datum von/bis und Bezeichnung (z.B. „Betriebsurlaub")</li>
        <li><strong>Event</strong> – Datum, Bezeichnung, Farbe und optional maximale Kapazität</li>
      </ul>
      <H3>Bearbeiten / Löschen</H3>
      <p>Klicke auf einen Eintrag in der rechten Liste — er wird im Formular geladen. Mit dem roten ✕ löschen.</p>
      <H3>Kapazität</H3>
      <p>Bei Events mit Kapazität siehst du wie viele Plätze noch frei sind. Die Kapazitätsanzeige kann im Widget aktiviert werden (Einstellungen → Formular → Widget-Features).</p>
    </>
  ),
  pakete: (
    <>
      <p>Pakete werden in Schritt 1 des Buchungsformulars angezeigt, wenn die Paketauswahl in den Einstellungen aktiviert ist.</p>
      <H3>Paket anlegen</H3>
      <p>Klicke auf <strong>+ Neues Paket</strong> und fülle die Felder aus: Name, Beschreibung, Preis pro Person, Min./Max. Teilnehmer, Dauer und ob das Paket aktiv ist.</p>
      <Callout>Nur aktive Pakete erscheinen im Buchungsformular.</Callout>
    </>
  ),
  vorschau: (
    <>
      <p>Die Vorschau zeigt dein Buchungswidget in einem eingebetteten iFrame — so siehst du sofort wie Änderungen wirken.</p>
      <H3>Breite anpassen</H3>
      <p>Ziehe die grauen Handles links oder rechts am iFrame, um verschiedene Bildschirmbreiten zu simulieren. Die aktuelle Breite wird in Pixel angezeigt.</p>
    </>
  ),
  faq: (
    <>
      {[
        {
          q: "Das Widget zeigt meine Änderungen nicht an.",
          a: "Einstellungen werden erst nach dem Klick auf „Änderungen speichern" übernommen. Danach ggf. den Browser-Cache leeren (Strg+Shift+R / Cmd+Shift+R).",
        },
        {
          q: "Ich bekomme keine E-Mail-Benachrichtigungen.",
          a: "Prüfe unter Einstellungen → Firma die Benachrichtigungs-E-Mail. Schaue auch im Spam-Ordner nach.",
        },
        {
          q: "Wie ändere ich die Farben des Widgets?",
          a: "Unter Einstellungen → Firma → Primärfarbe kannst du den Hex-Code eintragen. Das gesamte Farbschema passt sich automatisch an.",
        },
        {
          q: "Wie bettet man das Widget auf der Website ein?",
          a: "Den fertigen Code findest du unter Einstellungen → Einbetten. Einfach kopieren und in den <body> deiner Website einfügen.",
        },
      ].map(({ q, a }) => (
        <div key={q} style={{ marginBottom: "1.25rem", paddingBottom: "1.25rem", borderBottom: "1px solid var(--border)" }}>
          <p style={{ fontWeight: 600, marginBottom: "0.35rem" }}>{q}</p>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>{a}</p>
        </div>
      ))}
    </>
  ),
};

function H3({ children }: { children: React.ReactNode }) {
  return <h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: "1.25rem 0 0.5rem", color: "var(--text)" }}>{children}</h3>;
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--primary-tint)", border: "1px solid var(--primary-dim)", borderRadius: "var(--radius-sm)", padding: "0.6rem 0.875rem", marginTop: "0.75rem", fontSize: "0.875rem", color: "var(--text)" }}>
      {children}
    </div>
  );
}

export default function HanbbuchPage() {
  const [active, setActive] = useState("login");
  const current = sections.find((s) => s.id === active)!;

  return (
    <div>
      <h1 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "1.5rem" }}>Handbuch</h1>
      <div style={{ display: "flex", gap: "2rem", alignItems: "flex-start" }}>
        {/* Section nav */}
        <div style={{ width: "200px", flexShrink: 0, display: "flex", flexDirection: "column", gap: "0.125rem", position: "sticky", top: "1rem" }}>
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              style={{
                textAlign: "left",
                padding: "0.45rem 0.75rem",
                borderRadius: "6px",
                border: "none",
                background: active === s.id ? "var(--primary-tint)" : "none",
                color: active === s.id ? "var(--primary)" : "var(--muted)",
                fontWeight: active === s.id ? 600 : 400,
                fontSize: "0.875rem",
                cursor: "pointer",
                transition: "background 0.12s, color 0.12s",
              }}
            >
              {s.title}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1.75rem 2rem", lineHeight: 1.7, fontSize: "0.9rem", color: "var(--text)", minHeight: "400px" }}>
          <h2 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "1rem", color: "var(--text)" }}>{current.title}</h2>
          {content[active]}
        </div>
      </div>
    </div>
  );
}
