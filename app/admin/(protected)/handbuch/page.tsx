"use client";
import { useState, useRef } from "react";
import PageTransition from "@/components/admin/PageTransition";

const sections = [
  { id: "login",          title: "Login" },
  { id: "dashboard",      title: "Dashboard" },
  { id: "navigation",     title: "Navigation & Oberfläche" },
  { id: "einstellungen",  title: "Einstellungen" },
  { id: "elemente",       title: "Elemente" },
  { id: "einbetten",      title: "Embed-Codes" },
  { id: "anfragen",       title: "Anfragen" },
  { id: "angebote",       title: "Angebote" },
  { id: "vorschau",       title: "Vorschau" },
  { id: "sicherheit",     title: "Passwort & Sicherheit" },
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
      <p>Öffne <code>/admin/login</code> und melde dich mit E-Mail und Passwort an. Nach dem Login landest du im <strong>Dashboard</strong>.</p>
      <p style={{ marginTop: "0.75rem" }}>Die Anmeldung gilt 7 Tage, oder bis du dich abmeldest (Button in der Sidebar unten links). Danach meldest du dich einfach neu an.</p>
      <p style={{ marginTop: "0.75rem" }}>Passwort vergessen? Klicke auf dem Login auf <strong>„Passwort vergessen?“</strong> — mehr dazu unter <em>Passwort &amp; Sicherheit</em>. Noch kein Konto? Unter dem Anmelde-Button führt <strong>„Kostenlos testen“</strong> zur Registrierung.</p>
    </>
  ),
  dashboard: (
    <>
      <p>Das Dashboard ist deine Startseite nach dem Login: ein schneller Überblick, was gerade ansteht. Jede der drei Karten ist anklickbar und führt direkt zum passenden Bereich.</p>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1rem", fontSize: "0.875rem" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            <th style={{ textAlign: "left", padding: "0.5rem 0.75rem", color: "var(--muted)", fontWeight: 600 }}>Karte</th>
            <th style={{ textAlign: "left", padding: "0.5rem 0.75rem", color: "var(--muted)", fontWeight: 600 }}>Was gezählt wird</th>
            <th style={{ textAlign: "left", padding: "0.5rem 0.75rem", color: "var(--muted)", fontWeight: 600 }}>Klick führt zu</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["Offene Anfragen", "Anfragen mit dem Status „Neu“", "Anfragen"],
            ["Anstehende Events", "Aktive Events, die noch nicht begonnen haben", "Elemente → Tab „Events“"],
            ["Offene Angebote", "Angebote mit dem Status „Offen“", "Angebote"],
          ].map(([karte, zaehlt, ziel]) => (
            <tr key={karte} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ padding: "0.6rem 0.75rem", fontWeight: 500 }}>{karte}</td>
              <td style={{ padding: "0.6rem 0.75rem", color: "var(--muted)" }}>{zaehlt}</td>
              <td style={{ padding: "0.6rem 0.75rem", color: "var(--muted)" }}>{ziel}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ marginTop: "1rem" }}>Darunter siehst du unter <strong>Neueste Anfragen</strong> die letzten fünf neuen Anfragen mit Name und Veranstaltung. Ist keine Anfrage offen, steht dort „Keine offenen Anfragen“.</p>
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
            ["Dashboard", "Startseite mit Überblick: offene Anfragen, anstehende Events, offene Angebote"],
            ["Einstellungen", "Firma, Team, Passwort und Abrechnung — Konto-/Backend-Konfiguration"],
            ["Elemente", "Formular, Räume, Events und Sperrzeiten — alles, was das öffentliche Widget prägt"],
            ["Embed-Codes", "Widget-Codes für Website und Framer"],
            ["Anfragen", "Eingehende Anfragen bearbeiten (die Zahl zeigt neue Anfragen)"],
            ["Angebote", "Angebots-Archiv (die Zahl zeigt offene Angebote)"],
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
      <p style={{ marginTop: "0.75rem" }}><strong>Info-Symbole:</strong> Neben einigen Feldern steht ein kleines „i“. Fahre mit der Maus darüber oder tippe darauf (am Handy), um eine kurze Erklärung zu sehen. Ein Tipp daneben schließt sie wieder.</p>
    </>
  ),
  einstellungen: (
    <>
      <p>Konto-/Backend-Konfiguration, in vier Tabs unterteilt. Alles, was das öffentliche Widget selbst prägt (Formular, Räume, Events, Sperrzeiten), findest du unter <em>Elemente</em>.</p>
      <H3>Firma</H3>
      <p>Basisdaten deiner Organisation: Name, Tagline, Logo-URL, Primärfarbe, Hintergrundfarbe, Schriftarten, Kontaktdaten und Benachrichtigungs-E-Mail.</p>
      <Callout>Die <strong>Benachrichtigungs-E-Mail</strong> erhält bei jeder neuen Anfrage automatisch eine Benachrichtigung. Sie ist ein Pflichtfeld: Ohne sie kannst du keine Anfragen empfangen. Fehlt sie, zeigt dir dieser Tab eine Warnung.</Callout>
      <H3>Abrechnung</H3>
      <p>Zeigt oben deinen aktuellen Plan (Basis/Pro/Premium). Darunter Steuersatz (%) und Gültigkeitsdauer für neue Angebote in Tagen.</p>
      <H3>Plan upgraden</H3>
      <p>Im Basis-Paket erscheint der Button <strong>„Auf Pro upgraden"</strong> (monatlich) sowie eine kleinere Option <strong>„oder jährlich (~10% sparen)"</strong> — beides führt direkt zur Stripe-Kasse, das Upgrade ist sofort aktiv. Im Pro-Paket zeigt derselbe Bereich stattdessen <strong>„Für Premium Kontakt aufnehmen"</strong>, da Premium individuell bepreist wird und kein Self-Checkout hat.</p>
      <H3>Team</H3>
      <p>Lade weitere Personen mit E-Mail-Adresse ein — sie erhalten einen Link, um selbst ein Passwort zu setzen und sich anzumelden. Alle Mitglieder haben dieselben Rechte wie du (kein Rollensystem). Du kannst dich nicht selbst aus dem Team entfernen; beim Entfernen anderer Mitglieder kommt vorher eine Sicherheitsabfrage.</p>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "0.75rem", fontSize: "0.875rem" }}>
        <tbody>
          {[
            ["Basis", "1 Mitglied (nur du selbst — Einladen ist gesperrt)"],
            ["Pro", "2 Mitglieder"],
            ["Premium", "Unbegrenzt"],
          ].map(([plan, limit]) => (
            <tr key={plan as string} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ padding: "0.6rem 0.75rem", fontWeight: 500, whiteSpace: "nowrap" }}>{plan}</td>
              <td style={{ padding: "0.6rem 0.75rem", color: "var(--muted)" }}>{limit}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Callout>Die Einladung ist 7 Tage gültig. Bestehende Mitglieder bleiben bei einem Downgrade erhalten — es lassen sich nur keine neuen mehr einladen, solange das Limit erreicht ist.</Callout>
      <H3>Passwort</H3>
      <p>Aktuelles Passwort eingeben, dann ein neues Passwort vergeben (mindestens 8 Zeichen). Welche Passwörter abgelehnt werden, steht unter <em>Passwort &amp; Sicherheit</em>.</p>
    </>
  ),
  elemente: (
    <>
      <p>Alles, was das öffentliche Widget/die Website prägt, gebündelt in vier Tabs: <strong>Formular</strong>, <strong>Räume</strong>, <strong>Events</strong> und <strong>Sperrzeiten</strong>.</p>

      <H2>Formular</H2>
      <p>Steuert Titel, Farben, Schriftarten und welche Felder im Buchungsformular erscheinen. Die Felder sind nach den 5 Schritten des Formulars gruppiert.</p>

      <H3>Checkboxen</H3>
      <p>Jede Checkbox aktiviert oder deaktiviert ein optionales Feld. Deaktivierte Felder werden den Gästen nicht angezeigt.</p>

      <H3>Schritt 1 – Veranstaltung</H3>
      <p>Nur eine Checkbox: <strong>Uhrzeiten</strong> — blendet die Felder für Beginn- und Endzeit im ersten Schritt ein oder aus. Titel, Zeitraum (Kalender) und ggf. Event-Auswahl erscheinen immer.</p>
      <Callout>Die zweite Checkbox <strong>Raum-Auswahl</strong> ist erst ab dem <strong>Pro-Paket</strong> nutzbar — im Basis-Paket ausgegraut, da dort ohnehin keine Räume angelegt werden können.</Callout>

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
            ["Bild", "Optional, JPEG/PNG/WebP, max. 4 MB — wird automatisch optimiert"],
            ["Von / Bis", "Zeitraum des Events"],
            ["Preis pro Person", "In Euro"],
            ["Min. Teilnehmer", "Kleinste Personenzahl pro einzelner Anfrage"],
            ["Max. Teilnehmer", "Gesamtkapazität des Events über alle Anfragen zusammen, nicht pro Anfrage — leer lassen für unbegrenzt"],
            ["Farbe", "Erscheint als farbiger Balken im Kalender und als Streifen oben auf der Karte in der Events-Übersicht"],
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
      <H3>Wie viele Events sind erlaubt?</H3>
      <p>Im <strong>Basis-Paket</strong> können bis zu 3 Events gleichzeitig aktiv sein, im <strong>Pro-</strong> und <strong>Premium-Paket</strong> unbegrenzt viele. Über dem Formular siehst du, wie viele aktive Events du gerade hast. Bei einem Paket-Wechsel bleiben bestehende Events nutzbar — es lassen sich nur keine weiteren anlegen, solange das Limit überschritten ist. Vergangene und inaktive Events zählen nicht mit.</p>
      <H3>Liste, Duplizieren & Teilnehmer</H3>
      <p>Events werden nach <strong>Bevorstehend</strong> und <strong>Vergangen</strong> (einklappbar) gruppiert. Über <strong>Duplizieren</strong> legst du schnell eine Wiederholung an. Klick auf den Event-Namen zeigt dir, wer sich mit wie vielen Personen angemeldet hat.</p>

      <H2>Räume</H2>
      <Callout>Räume sind ab dem <strong>Pro-Paket</strong> verfügbar. Im Basis-Paket ist der Tab gesperrt.</Callout>
      <p>Hinterlege einen oder mehrere physische Räume deines Standorts (z.B. „Großer Saal", „Seminarraum") mit Name, Beschreibung, Bild und Kapazität. Gäste wählen im ersten Schritt des Anfrageformulars einen Raum aus, bevor sie den Zeitraum festlegen — der Kalender zeigt dann automatisch nur die für diesen Raum bereits belegten Zeiträume.</p>
      <H3>Raum anlegen</H3>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "0.75rem", fontSize: "0.875rem" }}>
        <tbody>
          {[
            ["Raum-Name", "Bezeichnung, erscheint als Karte im Formular"],
            ["Beschreibung", "Optional, ausführlicher Text"],
            ["Bild", "Optional, JPEG/PNG/WebP, max. 4 MB — wird automatisch optimiert"],
            ["Kapazität", "Max. Personenanzahl, leer lassen für unbegrenzt"],
            ["Sortierung", "Reihenfolge der Raum-Karten im Formular"],
            ["Aktiv", "Nur aktive Räume erscheinen im Buchungsformular"],
          ].map(([feld, desc]) => (
            <tr key={feld as string} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ padding: "0.6rem 0.75rem", fontWeight: 500, whiteSpace: "nowrap" }}>{feld}</td>
              <td style={{ padding: "0.6rem 0.75rem", color: "var(--muted)" }}>{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <H3>Wie viele Räume sind erlaubt?</H3>
      <p>Im <strong>Pro-Paket</strong> können bis zu 3 Räume angelegt werden, im <strong>Premium-Paket</strong> unbegrenzt viele.</p>
      <H3>Doppelbuchungen & Ablauf</H3>
      <p>Ein Raum blockiert für andere Gäste erst, sobald eine Anfrage dafür <strong>bestätigt</strong> ist — bis dahin können mehrere Gäste unabhängig voneinander für denselben Raum/Zeitraum anfragen, du entscheidest dann, welche Anfrage du bestätigst. Versuchst du, eine Anfrage zu bestätigen, während der Raum für diesen Zeitraum bereits durch eine andere bestätigte Anfrage belegt ist, wird das abgelehnt. Unbeantwortete Raum-Anfragen laufen nach 48 Stunden automatisch ab. Das Formularfeld „Raum-Auswahl" (unter Elemente → Formular → Felder) kann bei Bedarf ausgeblendet werden, auch wenn Räume angelegt sind.</p>

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
      <p>Alle eingehenden Anfragen erscheinen hier sortiert nach Eingangsdatum. Anfragen aus dem Events-Widget tragen zusätzlich ein kleines <strong>„Inhouse"-Badge</strong>, damit du sie auf einen Blick von individuellen Veranstaltungsanfragen unterscheiden kannst. Wurde ein Raum gewählt, siehst du ihn in der Detailansicht unter „Raum".</p>
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
            ["Abgelaufen", "#6b7280", "Nur bei Event- oder Raum-Anfragen: 48h unbeantwortet, Platz/Raum automatisch wieder freigegeben"],
          ].map(([status, color, desc]) => (
            <tr key={status as string} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ padding: "0.6rem 0.75rem" }}>
                <span style={{ background: color as string, color: "#fff", padding: "0.15rem 0.5rem", borderRadius: "999px", fontSize: "0.75rem", fontWeight: 600 }}>{status}</span>
              </td>
              <td style={{ padding: "0.6rem 0.75rem", color: "var(--muted)", fontSize: "0.875rem" }}>{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Callout>Event- und Raum-Anfragen verhalten sich unterschiedlich: Bei <strong>Events</strong> wird der Platz schon beim Absenden reserviert (Status „Neu") — die angezeigte Restkapazität sinkt also sofort mit jeder eingehenden Anfrage. Bei <strong>Räumen</strong> passiert das erst bei „Bestätigt" — mehrere Gäste können parallel für denselben Raum/Zeitraum anfragen, du wählst dann aus. Setzt du eine Anfrage auf „Abgelehnt" oder „Storniert", wird ein reservierter Event-Platz sofort wieder frei.</Callout>
      <H3>Automatischer Ablauf bei Event- und Raum-Buchungen</H3>
      <p>Reagierst du 48 Stunden nicht auf eine Event- oder Raum-Anfrage, wird sie automatisch auf „Abgelaufen" gesetzt. Bei Events wird dabei der reservierte Platz wieder freigegeben — läuft stündlich im Hintergrund, ohne dass du etwas tun musst.</p>
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
      <p>Unter <strong>Angebote</strong> findest du alle Angebote mit Filterung nach Status (Offen / Storniert).</p>
      <Callout>Angebote können storniert, aber nicht gelöscht werden.</Callout>
    </>
  ),
  einbetten: (
    <>
      <p>Klicke auf einen Eintrag, um ihn aufzuklappen. Zwei getrennte HTML-Codes zum Einbetten: das <strong>Anfrageformular</strong> (für Gäste, die selbst eine Veranstaltung durchführen wollen) und die <strong>Events</strong>-Liste (deine terminierten Events zum direkten Anfragen). Einfach kopieren und in den <code>&lt;body&gt;</code> deiner Website einfügen — beide passen sich automatisch in der Höhe an und lassen sich unabhängig voneinander einbetten.</p>
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
  sicherheit: (
    <>
      <H3>Passwort vergessen</H3>
      <ol style={{ paddingLeft: "1.5rem", margin: "0.5rem 0", listStyleType: "decimal", listStylePosition: "outside" }}>
        <li style={{ marginBottom: "0.35rem" }}>Klicke auf dem Login neben dem Passwort-Feld auf <strong>„Passwort vergessen?“</strong>.</li>
        <li style={{ marginBottom: "0.35rem" }}>Gib deine E-Mail-Adresse ein und klicke auf <strong>Link senden</strong>.</li>
        <li style={{ marginBottom: "0.35rem" }}>Öffne die E-Mail und klicke auf den Link. Er ist <strong>1 Stunde</strong> gültig und lässt sich nur einmal verwenden.</li>
        <li style={{ marginBottom: "0.35rem" }}>Lege ein neues Passwort fest — danach bist du direkt angemeldet.</li>
      </ol>
      <Callout>Aus Sicherheitsgründen bekommst du immer dieselbe Bestätigung, auch wenn die Adresse bei uns nicht bekannt ist. Kommt keine E-Mail an, prüfe den Spam-Ordner und ob du die richtige Adresse verwendet hast. Ein neu angeforderter Link ersetzt den vorherigen. Nach dem Zurücksetzen werden alle anderen Anmeldungen (z.B. auf anderen Geräten) beendet.</Callout>
      <H3>Welche Passwörter sind erlaubt?</H3>
      <ul style={{ paddingLeft: "1.5rem", margin: "0.5rem 0", listStyleType: "disc", listStylePosition: "outside" }}>
        <li style={{ marginBottom: "0.35rem" }}>Mindestens <strong>8</strong>, höchstens <strong>128 Zeichen</strong>.</li>
        <li style={{ marginBottom: "0.35rem" }}>Zu leicht zu erratende Passwörter werden abgelehnt, z.B. nur Zahlen, „Passwort1“ oder „Sommer2024!“.</li>
        <li style={{ marginBottom: "0.35rem" }}>Passwörter, die schon einmal in einem Datenleck aufgetaucht sind, werden ebenfalls abgelehnt. Dafür wird ein Prüfwert bei einem Sicherheitsdienst nachgefragt — dein Passwort selbst verlässt unsere Server dabei nicht.</li>
      </ul>
      <p style={{ marginTop: "0.75rem" }}>Tipp: Ein langer Satz aus mehreren Wörtern ist sicherer und leichter zu merken als ein kurzes Passwort mit Sonderzeichen. Diese Regeln gelten überall, wo du ein Passwort festlegst: beim Zurücksetzen, unter Einstellungen → Passwort und beim Einladungs-Link.</p>
      <H3>Links und Fristen</H3>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "0.5rem", fontSize: "0.875rem" }}>
        <tbody>
          {[
            ["Link „Passwort vergessen“", "1 Stunde, einmal verwendbar"],
            ["Einladung ins Team / Willkommens-Link", "7 Tage"],
            ["Anmeldung", "7 Tage, danach neu anmelden"],
          ].map(([was, frist]) => (
            <tr key={was} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ padding: "0.6rem 0.75rem", fontWeight: 500 }}>{was}</td>
              <td style={{ padding: "0.6rem 0.75rem", color: "var(--muted)" }}>{frist}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <H3>Zu viele Versuche</H3>
      <p>Login und „Passwort vergessen“ sind gegen Ausprobieren geschützt: Nach 5 Versuchen in 15 Minuten kommt die Meldung „Zu viele Versuche“. Warte dann kurz und versuche es erneut.</p>
    </>
  ),
  faq: (
    <>
      {[
        {
          q: "Ich habe mein Passwort vergessen.",
          a: "Klicke auf dem Login auf „Passwort vergessen?“, gib deine E-Mail ein und folge dem Link in der E-Mail (1 Stunde gültig). Details unter Passwort & Sicherheit.",
        },
        {
          q: "Mein neues Passwort wird abgelehnt.",
          a: "Es ist entweder zu leicht zu erraten (z.B. „Passwort1“, nur Zahlen) oder in einem bekannten Datenleck aufgetaucht. Wähle ein anderes, am besten einen längeren Satz aus mehreren Wörtern.",
        },
        {
          q: "Wie öffne ich die Erklärung zu einem Feld?",
          a: "Neben manchen Feldern steht ein kleines „i“. Mit der Maus darüberfahren oder am Handy antippen — ein Tipp daneben schließt die Erklärung wieder.",
        },
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
          q: "Der Tab „Räume“ zeigt nur ein Schloss-Symbol an.",
          a: "Räume sind ab dem Pro-Paket freigeschaltet. Upgrade direkt unter Einstellungen → Abrechnung über den Button „Auf Pro upgraden“.",
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
    <PageTransition>
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
    </PageTransition>
  );
}
