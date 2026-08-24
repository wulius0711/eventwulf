# EventWulf – Admin-Handbuch

---

## Inhaltsverzeichnis

1. [Login](#1-login)
2. [Navigation & Oberfläche](#2-navigation--oberfläche)
3. [Einstellungen](#3-einstellungen)
4. [Events](#4-events)
5. [Sperrzeiten & Kalender](#5-sperrzeiten--kalender)
6. [Anfragen](#6-anfragen)
7. [Angebote](#7-angebote)
8. [Vorschau](#8-vorschau)
9. [Passwort ändern](#9-passwort-ändern)

---

## 1. Login

Öffne `/admin/login` und melde dich mit E-Mail und Passwort an. Nach dem Login wirst du automatisch zu den Einstellungen weitergeleitet.

Die Session bleibt aktiv bis du dich abmeldest (Button in der Sidebar unten links). Bei Inaktivität läuft die Session nach 7 Tagen ab.

---

## 2. Navigation & Oberfläche

Die Sidebar links enthält alle Bereiche:

| Menüpunkt | Beschreibung |
|-----------|-------------|
| Einstellungen | Firmendaten, Formular, Abrechnung, Einbetten, Passwort |
| Events | Terminierte Angebote mit Preis und Kapazität anlegen und verwalten |
| Sperrzeiten | Kalender mit gesperrten Zeiträumen |
| Anfragen | Eingehende Anfragen bearbeiten |
| Dokumente | Angebots-Archiv |
| Vorschau | Live-Vorschau des Buchungswidgets |

**Dark / Light Mode:** Das Mond- bzw. Sonnen-Icon neben dem Abmelden-Button schaltet zwischen den Modi um. Die Einstellung wird gespeichert.

**Abmelden:** Button unten links in der Sidebar.

---

## 3. Einstellungen

Die Einstellungen sind in fünf Tabs unterteilt.

### Firma

Hier pflegst du die Basisdaten deiner Organisation:

- **Name** – Erscheint im Widget und in E-Mails
- **Tagline** – Kurzer Untertitel unter dem Namen
- **Logo-URL** – Direktlink zu deinem Logo (https://…)
- **Primärfarbe** – Hauptfarbe des Widgets (Hex-Code, z.B. `#4f46e5`)
- **Hintergrundfarbe** – Hintergrund des Widgets
- **E-Mail** – Kontakt-E-Mail, erscheint in der Bestätigungsmail
- **Telefon, Website, Adresse** – Erscheinen in der Bestätigungsmail
- **Benachrichtigungs-E-Mail** – An diese Adresse geht die Operator-Mail bei jeder neuen Anfrage

### Formular

Konfiguriere welche Felder im Buchungsformular angezeigt werden. Die Felder sind nach Schritten gruppiert:

- **Schritt 1 – Veranstaltung:** Uhrzeiten
- **Schritt 2 – Gruppe:** Teilnehmerzahl, Leiter:innen, Telefon, Sprache
- **Schritt 3 – Ausstattung:** Bestuhlung, Tische, Beamer, Soundanlage, Außenbereich, Sonstiges
- **Schritt 4 – Verpflegung:** Verpflegung, Zimmerwunsch
- **Schritt 5 – Abschluss:** Rahmenprogramm, Abrechnung, Anreise, Besondere Bedürfnisse, Budget, Wie gefunden

Deaktivierte Felder werden im Widget nicht angezeigt.

**Dropdown-Optionen:** Unter den Checkboxen kannst du die Auswahloptionen für Verpflegung, Zimmerwunsch und Abrechnung anpassen – Einträge hinzufügen, bearbeiten oder entfernen.

**Schriftarten:** Separate Auswahl für Überschrift und Fließtext.

**Widget-Features:**
- *Kapazitätsanzeige* – Zeigt verfügbare Plätze im Kalender

### Abrechnung

- **Steuersatz (%)** – Wird für Angebote verwendet (Standard: 20 %)
- **Angebot gültig für (Tage)** – Gültigkeitsdauer neuer Angebote (Standard: 30 Tage)

### Einbetten

Hier findest du den fertigen HTML-Code zum Einbetten des Widgets in deine Website. Einfach kopieren und in den `<body>` deiner Seite einfügen.

Es gibt zwei getrennte Embed-Codes: das **Anfrageformular** (für Gäste, die selbst eine Veranstaltung durchführen wollen) und die **Event-Liste** (zeigt deine terminierten Events zum direkten Buchen, siehe [Events](#4-events)). Beide lassen sich unabhängig voneinander einbetten, z.B. auf verschiedenen Seiten.

#### Einbetten in Framer

Framer packt eingefügten HTML-Code standardmäßig in ein eigenes, zusätzliches iFrame — dadurch funktioniert die automatische Höhenanpassung des normalen Embed-Codes dort **nicht**, das Widget wird abgeschnitten oder erzeugt Leerraum.

**Lösung:** Statt des HTML-Embeds eine **Code Component** in Framer anlegen (Assets → Code → + → New Code File) und folgenden Code einfügen:

```tsx
import { useEffect, useRef, useState } from "react"
import { addPropertyControls, ControlType } from "framer"

const BASE_URL = "https://eventwulf.vercel.app"

/**
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight auto
 */
export default function EventwulfWidget(props) {
    const { slug, widget } = props
    const iframeRef = useRef(null)
    const [height, setHeight] = useState(400)

    const path = widget === "events" ? "/events" : "/"
    const src = `${BASE_URL}${path}?kunde=${encodeURIComponent(slug || "default")}`

    useEffect(() => {
        function handleMessage(e) {
            if (!e.data || e.data.type !== "eventwulf-resize") return
            if (e.source !== iframeRef.current?.contentWindow) return
            if (e.data.height) setHeight(e.data.height)
        }
        window.addEventListener("message", handleMessage)
        return () => window.removeEventListener("message", handleMessage)
    }, [])

    return (
        <iframe
            ref={iframeRef}
            src={src}
            width="100%"
            height={height}
            style={{ border: "none", display: "block", width: "100%", height }}
            scrolling="no"
        />
    )
}

addPropertyControls(EventwulfWidget, {
    slug: {
        type: ControlType.String,
        title: "Kunde-Slug",
        defaultValue: "default",
    },
    widget: {
        type: ControlType.Enum,
        title: "Widget",
        options: ["form", "events"],
        optionTitles: ["Anfrageformular", "Events"],
        defaultValue: "form",
    },
})
```

Die Component erscheint danach im Insert-Panel und lässt sich per Drag & Drop auf die Seite ziehen. Slug und Widget-Typ werden über das Eigenschaften-Panel eingestellt, kein manuelles Code-Bearbeiten pro Hotel nötig. Der Stack darum kann auf "Fit" stehen — die Component meldet ihre Höhe automatisch über die `@framerSupportedLayoutHeight auto`-Annotation.

### Passwort

Aktuelles Passwort eingeben und neues Passwort (mind. 8 Zeichen) zweimal bestätigen.

---

## 4. Events

Events sind terminierte, buchbare Angebote deines Hotels — z.B. ein Yoga-Retreat oder eine Seminarwoche mit festem Zeitraum, Preis und Teilnehmerzahl. Sie werden über den eigenen Events-Embed-Code angezeigt (siehe [Einbetten](#einbetten)), getrennt vom normalen Anfrageformular.

### Event anlegen

Unter **Events** klickst du auf **Event anlegen** und füllst die Felder aus:

| Feld | Beschreibung |
|------|-------------|
| Event-Name | Bezeichnung des Events |
| Beschreibung | Ausführlicher Text (erscheint beim Aufklappen der Karte im Widget) |
| Bild | Optional, JPEG/PNG/WebP, max. 5MB |
| Von / Bis | Zeitraum des Events |
| Preis pro Person | In Euro |
| Min. Teilnehmer | Mindestgruppengröße |
| Max. Teilnehmer | Maximale Gruppengröße, leer lassen für unbegrenzt |
| Farbe | Für die Anzeige im Kalender |
| Intern | Sperrt zusätzlich den allgemeinen Kalender für andere Anfragen im selben Zeitraum. Lass das aus, wenn das Event nicht exklusiv ist und normale Buchungen parallel weiterlaufen sollen. |
| Aktiv | Nur aktive Events erscheinen im Buchungswidget |

Das **Startdatum** darf nicht in der Vergangenheit liegen — beim Anlegen eines neuen Events blockiert das System das automatisch. Beim Bearbeiten eines bereits vergangenen Events kannst du weiterhin andere Felder (z.B. den Namen) anpassen, ohne das Datum ändern zu müssen.

### Buchungen & Kapazität

Sobald sich jemand über das Events-Widget anmeldet, wird der Platz sofort reserviert — die Anzeige „X von Y Plätzen frei" aktualisiert sich entsprechend. Lehnst du eine Anfrage ab oder storniert der Gast selbst, wird der Platz automatisch wieder freigegeben. Unbeantwortete Anfragen laufen nach 48 Stunden automatisch ab und geben den Platz ebenfalls frei.

### Liste, Duplizieren & Teilnehmer

Events werden nach **Bevorstehend** und **Vergangen** (einklappbar) gruppiert. Über **Duplizieren** legst du schnell eine Wiederholung eines Events an (z.B. dasselbe Retreat im nächsten Quartal) — alle Felder außer dem Zeitraum werden übernommen. Klick auf den Event-Namen zeigt dir, wer sich mit wie vielen Personen angemeldet hat.

---

## 5. Sperrzeiten & Kalender

### Ansicht

Der Kalender im Anfrageformular zeigt gesperrte Zeiträume sowie deine **internen** Events (siehe [Events](#4-events)) als „nicht verfügbar". **Externe** Events blockieren den Kalender nicht, sie erscheinen nur als informativer, farbiger Banner — Gäste können für denselben Zeitraum trotzdem eine eigene Anfrage stellen.

### Eintrag hinzufügen

Unter **Sperrzeiten** trägst du Zeiträume ein: Datum von/bis und Bezeichnung (z.B. „Betriebsurlaub"). Klicke auf **Zeitraum sperren**, um den Eintrag zu speichern.

Events werden nicht mehr hier, sondern unter **Events** angelegt.

### Eintrag bearbeiten / löschen

Klicke auf einen bestehenden Eintrag in der Liste – er wird im Formular zum Bearbeiten geladen. Mit dem roten ✕-Button löschen.

---

## 6. Anfragen

### Übersicht

Alle eingehenden Anfragen erscheinen hier sortiert nach Eingangsdatum. Jede Anfrage zeigt:

- Status-Badge (farbig)
- Name und Veranstaltungstitel
- Datum und Personenzahl
- Eingangsdatum

Anfragen, die über das Events-Widget eingegangen sind, tragen zusätzlich ein kleines **„Event"-Badge** — so siehst du auf einen Blick, ob es sich um eine Anmeldung zu einem deiner Events oder eine individuelle Veranstaltungsanfrage handelt. In der Detailansicht heißt das Feld entsprechend „Event" statt „Veranstaltung".

### Status-Workflow

| Status | Bedeutung |
|--------|-----------|
| **Neu** | Anfrage ist eingegangen, noch nicht bearbeitet |
| **In Prüfung** | Wird gerade bearbeitet |
| **Angebot versendet** | Ein Angebot wurde erstellt und verschickt |
| **Bestätigt** | Buchung ist bestätigt |
| **Abgelehnt** | Anfrage wurde abgelehnt |
| **Storniert** | Anfrage wurde storniert (durch Gast per Link oder manuell) |
| **Abgelaufen** | Nur bei Event-Buchungen: 48 Stunden unbeantwortet geblieben, Platz wurde automatisch wieder freigegeben (siehe unten) |

Den Status änderst du direkt im Anfragen-Detail über die Status-Buttons. Stornierte Anfragen werden grau dargestellt.

Bei Event-Buchungen wird der Platz bereits beim Absenden der Anfrage reserviert (nicht erst bei „Bestätigt"). Wechselst du den Status auf **Abgelehnt** oder **Storniert**, wird der Platz sofort wieder freigegeben und steht anderen Gästen zur Verfügung.

### Automatische Erinnerungsmail

Wenn eine Anfrage auf **Bestätigt** gesetzt wird, verschickt das System automatisch 24 Stunden vor dem Veranstaltungsdatum eine Erinnerungsmail an deine Benachrichtigungs-E-Mail (aus den Einstellungen). Das passiert täglich um 8:00 Uhr, ohne dass du etwas tun musst.

### Automatischer Ablauf bei Event-Buchungen

Reagierst du 48 Stunden lang nicht auf eine Event-Anfrage (Status bleibt „Neu", „In Prüfung" oder „Angebot versendet"), wird sie automatisch auf **Abgelaufen** gesetzt und der reservierte Platz wieder freigegeben — damit ein beliebtes Event nicht durch unbeantwortete Anfragen dauerhaft blockiert bleibt. Das läuft stündlich im Hintergrund, ohne dass du etwas tun musst. Reagier rechtzeitig, wenn du einen bestimmten Platz sichern willst.

### Stornierung durch den Gast

Jede Bestätigungsmail an den Anfragenden enthält einen **„Anfrage stornieren"**-Link. Klickt der Gast darauf, wird die Anfrage automatisch auf **Storniert** gesetzt und du erhältst eine Benachrichtigungs-E-Mail mit den Veranstaltungsdetails.

### Anfrage öffnen

Klick auf eine Anfrage öffnet die Detailansicht mit allen Formulardaten. Im rechten Bereich findest du das **Angebots-Panel** zum Erstellen von Angeboten direkt aus der Anfrage heraus.

---

## 7. Angebote

### Angebot erstellen

Öffne eine Anfrage und klicke im Angebots-Panel auf **+ Angebot**. Ein neues Angebot wird mit automatischer Nummer (ANB-YYYY-XXXX), den Anfragedaten als Vorbelegung und der konfigurierten Gültigkeitsdauer angelegt.

Du kannst:
- **Positionen** hinzufügen (Bezeichnung, Menge, Einheit, Einzelpreis)
- **Notizen** ergänzen
- **Steuersatz** anpassen

### Angebot als PDF

Klicke auf **Drucken / PDF** im Angebot. Dein Browser öffnet eine Druckvorschau – wähle „Als PDF speichern" als Drucker.

### Angebots-Archiv

Unter **Dokumente** findest du alle Angebote mit Filterung nach Status:

- **Alle** – Gesamtübersicht
- **Offen** – Noch aktive Angebote
- **Storniert** – Stornierte Angebote

### Status

Angebote können nur storniert, nicht gelöscht werden (Aufbewahrungspflicht).

---

## 8. Vorschau

Die Vorschau zeigt dein Buchungswidget in einem eingebetteten iFrame.

**Breite anpassen:** Ziehe die grauen Handles links oder rechts am iFrame, um verschiedene Bildschirmbreiten zu simulieren. Die aktuelle Breite wird in Pixel angezeigt.

**Hinweis:** Die Vorschau zeigt aktuell nur das Anfrageformular. Für die Events-Liste rufst du deinen Events-Embed-Link direkt im Browser auf (`/events?kunde=deinslug`).

---

## 9. Passwort ändern

Unter **Einstellungen → Passwort** kannst du dein Passwort jederzeit ändern. Mindestlänge: 8 Zeichen.

---

## Häufige Fragen

**Das Widget zeigt meine Änderungen nicht an.**
Einstellungen werden erst nach dem Klick auf **Änderungen speichern** übernommen. Danach ggf. den Browser-Cache leeren (Strg+Shift+R).

**Ich bekomme keine E-Mail-Benachrichtigungen.**
Prüfe unter Einstellungen → Firma die **Benachrichtigungs-E-Mail**. Schaue auch im Spam-Ordner nach.

**Eine Anfrage hat den Status „Storniert" – was jetzt?**
Der Gast hat die Anfrage über seinen Stornierungslink selbst storniert. Du hast per E-Mail eine Benachrichtigung erhalten. Den Status kannst du bei Bedarf manuell wieder ändern (z.B. auf „Neu" setzen, falls die Stornierung irrtümlich war).

**Eine Event-Anfrage hat den Status „Abgelaufen" – was jetzt?**
Du hast 48 Stunden nicht auf eine Event-Buchung reagiert, der Platz wurde automatisch wieder freigegeben. Willst du die Buchung doch noch bestätigen, setz den Status manuell zurück (z.B. auf „In Prüfung") — beachte aber, dass der Platz zwischenzeitlich an jemand anderen vergeben worden sein könnte, falls das Event stark nachgefragt ist.

**Wie ändere ich die Farben des Widgets?**
Unter Einstellungen → Firma → Primärfarbe kannst du den Hex-Code der Hauptfarbe eintragen. Das gesamte Farbschema des Widgets passt sich automatisch an.
