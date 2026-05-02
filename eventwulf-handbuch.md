# EventWulf – Admin-Handbuch

---

## Inhaltsverzeichnis

1. [Login](#1-login)
2. [Navigation & Oberfläche](#2-navigation--oberfläche)
3. [Einstellungen](#3-einstellungen)
4. [Anfragen](#4-anfragen)
5. [Angebote](#5-angebote)
6. [Verfügbarkeit & Kalender](#6-verfügbarkeit--kalender)
7. [Seminarpakete](#7-seminarpakete)
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
| Pakete | Seminarpakete anlegen und verwalten |
| Verfügbarkeit | Kalender mit gesperrten Daten und Events |
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
- *Paketauswahl anzeigen* – Zeigt eine Paketauswahl in Schritt 1 (nur wenn Pakete angelegt sind)
- *Kapazitätsanzeige* – Zeigt verfügbare Plätze im Kalender

### Abrechnung

- **Steuersatz (%)** – Wird für Angebote verwendet (Standard: 20 %)
- **Angebot gültig für (Tage)** – Gültigkeitsdauer neuer Angebote (Standard: 30 Tage)

### Einbetten

Hier findest du den fertigen HTML-Code zum Einbetten des Widgets in deine Website. Einfach kopieren und in den `<body>` deiner Seite einfügen.

### Passwort

Aktuelles Passwort eingeben und neues Passwort (mind. 8 Zeichen) zweimal bestätigen.

---

## 4. Anfragen

### Übersicht

Alle eingehenden Anfragen erscheinen hier sortiert nach Eingangsdatum. Jede Anfrage zeigt:

- Status-Badge (farbig)
- Name und Veranstaltungstitel
- Datum und Personenzahl
- Eingangsdatum

### Status-Workflow

| Status | Bedeutung |
|--------|-----------|
| **Neu** | Anfrage ist eingegangen, noch nicht bearbeitet |
| **In Prüfung** | Wird gerade bearbeitet |
| **Angebot versendet** | Ein Angebot wurde erstellt und verschickt |
| **Bestätigt** | Buchung ist bestätigt |
| **Abgelehnt** | Anfrage wurde abgelehnt |

Den Status änderst du direkt im Anfragen-Detail über das Dropdown.

### Anfrage öffnen

Klick auf eine Anfrage öffnet die Detailansicht mit allen Formulardaten. Im rechten Bereich findest du das **Angebots-Panel** zum Erstellen von Angeboten direkt aus der Anfrage heraus.

---

## 5. Angebote

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

## 6. Verfügbarkeit & Kalender

### Ansicht

Der Kalender zeigt gesperrte Zeiträume und eingetragene Events. Belegte Tage sind farbig markiert.

### Eintrag hinzufügen

Oben links wähle den Typ:

- **Gesperrter Zeitraum** – Datum von/bis und Bezeichnung (z.B. „Betriebsurlaub")
- **Event** – Datum, Bezeichnung, Farbe und optional maximale Kapazität

Klicke auf **Eintragen**, um den Eintrag zu speichern.

### Eintrag bearbeiten / löschen

Klicke auf einen bestehenden Eintrag in der Liste rechts – er wird im Formular zum Bearbeiten geladen. Mit dem roten ✕-Button löschen.

### Kapazität

Bei Events mit Kapazität siehst du in der Liste wie viele Plätze noch frei sind. Die Kapazitätsanzeige kann im Widget aktiviert werden (Einstellungen → Formular → Widget-Features).

---

## 7. Seminarpakete

Pakete werden in Schritt 1 des Buchungsformulars angezeigt (wenn die Paketauswahl in den Einstellungen aktiviert ist).

### Paket anlegen

Klicke auf **+ Neues Paket** und fülle die Felder aus:

| Feld | Beschreibung |
|------|-------------|
| Name | Bezeichnung des Pakets |
| Beschreibung | Kurzbeschreibung (wird im Widget angezeigt) |
| Preis pro Person | In Euro |
| Min. Teilnehmer | Mindestgruppengröße |
| Max. Teilnehmer | Maximale Gruppengröße |
| Dauer (Tage) | Anzahl Tage |
| Aktiv | Nur aktive Pakete erscheinen im Widget |

### Reihenfolge

Die Reihenfolge der Pakete im Widget entspricht der Sortierreihenfolge (Feld „Reihenfolge").

---

## 8. Vorschau

Die Vorschau zeigt dein Buchungswidget in einem eingebetteten iFrame.

**Breite anpassen:** Ziehe die grauen Handles links oder rechts am iFrame, um verschiedene Bildschirmbreiten zu simulieren. Die aktuelle Breite wird in Pixel angezeigt.

---

## 9. Passwort ändern

Unter **Einstellungen → Passwort** kannst du dein Passwort jederzeit ändern. Mindestlänge: 8 Zeichen.

---

## Häufige Fragen

**Das Widget zeigt meine Änderungen nicht an.**
Einstellungen werden erst nach dem Klick auf **Änderungen speichern** übernommen. Danach ggf. den Browser-Cache leeren (Strg+Shift+R).

**Ich bekomme keine E-Mail-Benachrichtigungen.**
Prüfe unter Einstellungen → Firma die **Benachrichtigungs-E-Mail**. Schaue auch im Spam-Ordner nach.

**Eine Anfrage kann ich nicht mehr bearbeiten.**
Bestätigte oder abgelehnte Anfragen können noch eingesehen, aber nicht mehr statusmäßig zurückgesetzt werden. Wende dich an den Support.

**Wie ändere ich die Farben des Widgets?**
Unter Einstellungen → Firma → Primärfarbe kannst du den Hex-Code der Hauptfarbe eintragen. Das gesamte Farbschema des Widgets passt sich automatisch an.
