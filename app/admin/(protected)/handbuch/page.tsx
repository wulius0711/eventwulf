"use client";
import { useState, useRef } from "react";

const sections = [
  { id: "login",          title: "Login" },
  { id: "navigation",     title: "Navigation & Oberfläche" },
  { id: "einstellungen",  title: "Einstellungen" },
  { id: "elemente",       title: "Elemente" },
  { id: "einbetten",      title: "Embed-Codes" },
  { id: "anfragen",       title: "Anfragen" },
  { id: "angebote",       title: "Angebote" },
  { id: "vorschau",       title: "Vorschau" },
  { id: "faq",            title: "Häufige Fragen" },
];

function H2({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "2rem 0 0.75rem", paddingTop: "1.5rem", borderTop: "1px solid var(--border)", color: "var(--text)" }}>{children}</h2>;
}

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
            ["Einstellungen", "Firmendaten, Abrechnung, Passwort — Konto-/Backend-Konfiguration"],
            ["Elemente", "Formular-Felder, Events und Sperrzeiten — alles, was das öffentliche Widget prägt"],
            ["Embed-Codes", "Widget-Codes für Website und Framer"],
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
      <p>Konto-/Backend-Konfiguration, in drei Tabs unterteilt. Alles, was das öffentliche Widget selbst prägt (Formular, Events, Sperrzeiten), findest du unter <em>Elemente</em>.</p>
      <H3>Firma</H3>
      <p>Basisdaten deiner Organisation: Name, Tagline, Logo-URL, Primärfarbe, Hintergrundfarbe, Schriftarten, Kontaktdaten und Benachrichtigungs-E-Mail.</p>
      <Callout>Die <strong>Benachrichtigungs-E-Mail</strong> erhält bei jeder neuen Anfrage automatisch eine Benachrichtigung.</Callout>
      <H3>Abrechnung</H3>
      <p>Steuersatz (%) und Gültigkeitsdauer für neue Angebote in Tagen.</p>
      <H3>Passwort</H3>
      <p>Aktuelles Passwort eingeben, dann neues Passwort (mind. 8 Zeichen) vergeben.</p>
    </>
  ),
  elemente: (
    <>
      <p>Alles, was das öffentliche Widget/die Website prägt, gebündelt in drei Tabs: <strong>Formular</strong>, <strong>Events</strong> und <strong>Sperrzeiten</strong>.</p>

      <H2>Formular</H2>
      <p>Steuert Titel, Farben, Schriftarten und welche Felder im Buchungsformular erscheinen. Die Felder sind nach den 5 Schritten des Formulars gruppiert.</p>

      <H3>Checkboxen</H3>
      <p>Jede Checkbox aktiviert oder deaktiviert ein optionales Feld. Deaktivierte Felder werden den Gästen nicht angezeigt.</p>

      <H3>Schritt 1 – Veranstaltung</H3>
      <p>Nur eine Checkbox: <strong>Uhrzeiten</strong> — blendet die Felder für Beginn- und Endzeit im ersten Schritt ein oder aus. Titel, Zeitraum (Kalender) und ggf. Event-Auswahl erscheinen immer.</p>

      <H3>Schritt 2 – Gruppe</H3>
      <p>Vier Checkboxen: <strong>Teilnehmerzahl</strong>, <strong>Leiter:innen</strong>, <strong>Telefon</strong> und <strong>Sprache</strong>. Jede blendet das jeweilige Feld ein oder aus, keine weiteren Optionslisten nötig.</p>

      <H3>Schritt 3 – Ausstattung</H3>
      <p>In Schritt 3 wählen Gäste benötigte Ausstattung als Checkboxen. Welche Optionen erscheinen, steuerst du über die <strong>Ausstattungs-Optionen</strong> unten im gleichen Tab.</p>
      <ul style={{ marginTop: "0.5rem", paddingLeft: "1.25rem", lineHeight: 1.9 }}>
        <li>Optionen hinzufügen: <strong>+ Option hinzufügen</strong> klicken</li>
        <li>Optionen bearbeiten: direkt im Textfeld ändern</li>
        <li>Optionen entfernen: rotes × klicken</li>
        <li>Keine Optionen = Ausstattungs-Abschnitt ausgeblendet</li>
      </ul>
      <Callout>Die Checkbox <strong>Sonstiges Equipment (Freitextfeld)</strong> steuert zusätzlich ob ein freies Textfeld für Sonderwünsche erscheint.</Callout>

      <H3>Schritt 4 – Unterkunft</H3>
      <p>Die zwei Checkboxen <strong>Verpflegung</strong> und <strong>Zimmerwunsch</strong> steuern ob die jeweiligen Dropdowns erscheinen. Die Auswahl-Optionen dafür pflegst du unter <strong>Verpflegung-Optionen</strong> und <strong>Zimmerwunsch-Optionen</strong>.</p>
      <Callout>Ist eine Optionsliste leer, wird das Dropdown auch bei aktiver Checkbox nicht angezeigt.</Callout>

      <H3>Schritt 5 – Abschluss</H3>
      <p>Mehrere Felder sind über Optionslisten konfigurierbar (erkennbar am Hinweis <em>Optionen unten wählbar</em>):</p>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "0.75rem", fontSize: "0.875rem" }}>
        <tbody>
          {[
            ["Abrechnung", "Abrechnungs-Optionen", "Wer zahlt? z.B. Veranstalter, Teilnehmer selbst"],
            ["Zahlung", "Zahlungs-Optionen", "Zahlungsarten, z.B. Banküberweisung, Bar"],
            ["Anreise", "Anreise-Optionen", "Anreiseart, z.B. PKW, Bahn, Bus"],
            ["Budgetrahmen", "Budget-Optionen", "Budgetkategorien, z.B. unter 500 €, 500–2.000 €"],
            ["Wie habt ihr uns gefunden?", "Quelle-Optionen", "Herkunftskanäle, z.B. Google, Instagram"],
          ].map(([feld, option, bsp]) => (
            <tr key={feld as string} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ padding: "0.6rem 0.75rem", fontWeight: 500, whiteSpace: "nowrap" }}>{feld}</td>
              <td style={{ padding: "0.6rem 0.75rem", color: "var(--primary)", fontSize: "0.82rem" }}>{option}</td>
              <td style={{ padding: "0.6rem 0.75rem", color: "var(--muted)" }}>{bsp}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <H3>Optionen verwalten</H3>
      <p>Alle Optionslisten befinden sich im unteren Bereich des Felder-Abschnitts. Einfach Einträge hinzufügen, bearbeiten oder löschen und anschließend <strong>Änderungen speichern</strong> klicken.</p>

      <H2>Events</H2>
      <p>Events sind terminierte, buchbare Angebote deines Hotels — z.B. ein Yoga-Retreat oder eine Seminarwoche mit festem Zeitraum, Preis und Teilnehmerzahl. Sie werden über den eigenen Events-Embed-Code angezeigt (siehe Embed-Codes), getrennt vom normalen Anfrageformular.</p>
      <H3>Event anlegen</H3>
      <p>Klicke auf <strong>Event anlegen</strong> und fülle die Felder aus:</p>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "0.75rem", fontSize: "0.875rem" }}>
        <tbody>
          {[
            ["Event-Name", "Bezeichnung des Events"],
            ["Beschreibung", "Ausführlicher Text, erscheint beim Aufklappen der Karte"],
            ["Bild", "Optional, JPEG/PNG/WebP, max. 5MB"],
            ["Von / Bis", "Zeitraum des Events"],
            ["Preis pro Person", "In Euro"],
            ["Min./Max. Teilnehmer", "Max. leer lassen für unbegrenzt"],
            ["Farbe", "Für die Anzeige im Kalender"],
            ["Intern", "Sperrt zusätzlich den Zeitraum im allgemeinen Kalender für andere Anfragen"],
            ["Aktiv", "Nur aktive Events erscheinen im Buchungswidget"],
          ].map(([feld, desc]) => (
            <tr key={feld as string} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ padding: "0.6rem 0.75rem", fontWeight: 500, whiteSpace: "nowrap" }}>{feld}</td>
              <td style={{ padding: "0.6rem 0.75rem", color: "var(--muted)" }}>{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Callout>Das Startdatum darf nicht in der Vergangenheit liegen. Beim Bearbeiten eines bereits vergangenen Events kannst du trotzdem andere Felder anpassen, ohne das Datum ändern zu müssen.</Callout>
      <H3>Buchungen & Kapazität</H3>
      <p>Meldet sich jemand über das Events-Widget an, wird der Platz sofort reserviert. Lehnst du ab oder storniert der Gast, wird er automatisch wieder freigegeben. Unbeantwortete Anfragen laufen nach 48 Stunden automatisch ab.</p>
      <H3>Liste, Duplizieren & Teilnehmer</H3>
      <p>Events werden nach <strong>Bevorstehend</strong> und <strong>Vergangen</strong> (einklappbar) gruppiert. Über <strong>Duplizieren</strong> legst du schnell eine Wiederholung an. Klick auf den Event-Namen zeigt dir, wer sich mit wie vielen Personen angemeldet hat.</p>

      <H2>Sperrzeiten</H2>
      <H3>Kalenderansicht</H3>
      <p>Der Kalender im Anfrageformular zeigt gesperrte Zeiträume sowie deine <strong>internen</strong> Events als „nicht verfügbar". <strong>Externe</strong> Events blockieren den Kalender nicht — sie erscheinen nur als informativer, farbiger Banner, Gäste können für denselben Zeitraum trotzdem eine eigene Anfrage stellen.</p>
      <H3>Eintrag hinzufügen</H3>
      <p>Hier trägst du reine Sperrzeiten ein: Datum von/bis und Bezeichnung (z.B. „Betriebsurlaub"). Klicke auf <strong>Zeitraum sperren</strong>.</p>
      <Callout>Events werden nicht hier, sondern im Tab „Events" angelegt.</Callout>
      <H3>Bearbeiten / Löschen</H3>
      <p>Klicke auf einen Eintrag in der Liste — er wird im Formular geladen. Mit dem roten ✕ löschen.</p>
    </>
  ),
  anfragen: (
    <>
      <p>Alle eingehenden Anfragen erscheinen hier sortiert nach Eingangsdatum. Anfragen aus dem Events-Widget tragen zusätzlich ein kleines <strong>„Event"-Badge</strong>, damit du sie auf einen Blick von individuellen Veranstaltungsanfragen unterscheiden kannst.</p>
      <H3>Status-Workflow</H3>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "0.75rem", fontSize: "0.875rem" }}>
        <tbody>
          {[
            ["Neu", "#3b82f6", "Anfrage eingegangen, noch nicht bearbeitet"],
            ["In Prüfung", "#f59e0b", "Wird gerade bearbeitet"],
            ["Angebot versendet", "#8b5cf6", "Angebot wurde erstellt und verschickt"],
            ["Bestätigt", "#10b981", "Buchung ist bestätigt"],
            ["Abgelehnt", "#ef4444", "Anfrage wurde abgelehnt"],
            ["Storniert", "#6b7280", "Anfrage wurde storniert (durch Gast per Link oder manuell)"],
            ["Abgelaufen", "#6b7280", "Nur bei Events: 48h unbeantwortet, Platz automatisch wieder freigegeben"],
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
      <Callout>Bei Event-Buchungen wird der Platz schon beim Absenden reserviert, nicht erst bei „Bestätigt". Setzt du eine Anfrage auf „Abgelehnt" oder „Storniert", wird der Platz sofort wieder frei.</Callout>
      <H3>Automatischer Ablauf bei Event-Buchungen</H3>
      <p>Reagierst du 48 Stunden nicht auf eine Event-Anfrage, wird sie automatisch auf „Abgelaufen" gesetzt und der Platz freigegeben — läuft stündlich im Hintergrund, ohne dass du etwas tun musst.</p>
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
  einbetten: (
    <>
      <p>Zwei getrennte HTML-Codes zum Einbetten: das <strong>Anfrageformular</strong> (für Gäste, die selbst eine Veranstaltung durchführen wollen) und die <strong>Events</strong>-Liste (deine terminierten Events zum direkten Buchen). Einfach kopieren und in den <code>&lt;body&gt;</code> deiner Website einfügen — beide passen sich automatisch in der Höhe an und lassen sich unabhängig voneinander einbetten.</p>
      <Callout>Bei <strong>Framer</strong> funktioniert die automatische Höhenanpassung über den normalen HTML-Code nicht (Framer verpackt ihn in ein eigenes iFrame). Nutze stattdessen eine Code Component — den fertigen Code dafür findest du direkt weiter unten auf dieser Seite unter „Einbetten in Framer".</Callout>
    </>
  ),
  vorschau: (
    <>
      <p>Die Vorschau zeigt dein Buchungswidget in einem eingebetteten iFrame — so siehst du sofort wie Änderungen wirken.</p>
      <H3>Breite anpassen</H3>
      <p>Ziehe die grauen Handles links oder rechts am iFrame, um verschiedene Bildschirmbreiten zu simulieren. Die aktuelle Breite wird in Pixel angezeigt.</p>
      <Callout>Tipp: Ziehe auf ~390 px um eine iPhone-Ansicht zu simulieren.</Callout>
      <Callout>Die Vorschau zeigt aktuell nur das Anfrageformular. Für die Events-Liste rufst du deinen Events-Embed-Link direkt im Browser auf.</Callout>
    </>
  ),
  faq: (
    <>
      {[
        {
          q: "Das Widget zeigt meine Änderungen nicht an.",
          a: 'Einstellungen werden erst nach dem Klick auf „Änderungen speichern" übernommen. Danach ggf. den Browser-Cache leeren (Strg+Shift+R / Cmd+Shift+R).',
        },
        {
          q: "Ein Dropdown erscheint nicht, obwohl die Checkbox aktiv ist.",
          a: "Prüfe ob die zugehörige Optionsliste mindestens einen Eintrag enthält. Eine leere Liste blendet das Feld automatisch aus.",
        },
        {
          q: "Ich bekomme keine E-Mail-Benachrichtigungen.",
          a: "Prüfe unter Einstellungen → Firma die Benachrichtigungs-E-Mail. Schaue auch im Spam-Ordner nach.",
        },
        {
          q: "Wie ändere ich die Farben des Widgets?",
          a: "Unter Elemente → Formular → Primärfarbe kannst du den Hex-Code eintragen. Das gesamte Farbschema passt sich automatisch an.",
        },
        {
          q: "Wie bettet man das Widget auf der Website ein?",
          a: "Den fertigen Code findest du unter Embed-Codes. Einfach kopieren und in den <body> deiner Website einfügen. Das Widget passt seine Höhe automatisch an.",
        },
        {
          q: "Kann ich die Ausstattungs-Optionen individuell anpassen?",
          a: "Ja. Unter Elemente → Formular → Ausstattungs-Optionen kannst du beliebige Optionen hinzufügen, umbenennen oder entfernen. Was dort steht, erscheint als Checkbox im Formular.",
        },
        {
          q: "Eine Event-Anfrage hat den Status „Abgelaufen“ – was jetzt?",
          a: "48 Stunden ohne Reaktion, der Platz wurde automatisch wieder freigegeben. Willst du trotzdem noch bestätigen, setz den Status manuell zurück — der Platz könnte inzwischen aber an jemand anderen vergeben worden sein.",
        },
        {
          q: "Das Widget wird auf meiner Framer-Website nicht richtig hoch angezeigt.",
          a: "Framer verpackt eingefügten HTML-Code in ein eigenes iFrame, wodurch die automatische Höhenanpassung nicht funktioniert. Nutze stattdessen die Code Component unter Embed-Codes → Einbetten in Framer.",
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

export default function HanbbuchPage() {
  const [active, setActive] = useState("login");
  const contentRef = useRef<HTMLDivElement>(null);
  const mobileNavRef = useRef<HTMLDivElement>(null);
  const current = sections.find((s) => s.id === active)!;

  function navigate(id: string) {
    setActive(id);
    setTimeout(() => {
      const target = mobileNavRef.current ?? contentRef.current;
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "1.25rem" }}>Handbuch</h1>

      {/* Mobile: horizontal scrollable pill nav */}
      <div className="ew-help-mobile-nav" ref={mobileNavRef}>
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => navigate(s.id)}
            style={{
              flexShrink: 0,
              padding: "6px 14px",
              borderRadius: 999,
              border: `1px solid ${active === s.id ? "var(--primary)" : "var(--border)"}`,
              background: active === s.id ? "var(--primary)" : "var(--surface)",
              color: active === s.id ? "var(--btn-text)" : "var(--muted)",
              fontWeight: active === s.id ? 600 : 400,
              fontSize: "0.82rem",
              cursor: "pointer",
              whiteSpace: "nowrap",
              fontFamily: "inherit",
            }}
          >
            {s.title}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: "2rem", alignItems: "flex-start" }}>
        {/* Desktop: sidebar nav */}
        <nav className="ew-help-sidebar">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => navigate(s.id)}
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
                display: "block",
                width: "100%",
                fontFamily: "inherit",
              }}
            >
              {s.title}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div ref={contentRef} style={{ flex: 1, minWidth: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1.75rem 2rem", lineHeight: 1.7, fontSize: "0.9rem", color: "var(--text)", minHeight: "400px" }}>
          <h2 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "1rem", color: "var(--text)" }}>{current.title}</h2>
          {content[active]}
        </div>
      </div>
    </div>
  );
}
