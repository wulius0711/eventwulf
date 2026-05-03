# Eventwulf – Handbuch

## Login

Öffne `/admin/login` und melde dich mit E-Mail und Passwort an. Nach dem Login wirst du automatisch zu den Einstellungen weitergeleitet.

Die Session bleibt aktiv bis du dich abmeldest (Button in der Sidebar unten links). Bei Inaktivität läuft die Session nach 7 Tagen ab.

---

## Navigation & Oberfläche

Die Sidebar links enthält alle Bereiche:

| Menüpunkt | Beschreibung |
|---|---|
| Einstellungen | Firmendaten, Formular, Abrechnung, Einbetten, Passwort |
| Pakete | Seminarpakete anlegen und verwalten |
| Verfügbarkeit | Kalender mit gesperrten Daten und Events |
| Anfragen | Eingehende Anfragen bearbeiten |
| Dokumente | Angebots-Archiv |
| Vorschau | Live-Vorschau des Buchungswidgets |
| Handbuch | Diese Hilfeseite |

**Dark / Light Mode:** Das Icon neben dem Abmelden-Button schaltet zwischen den Modi um. Die Einstellung wird gespeichert.

---

## Einstellungen

Die Einstellungen sind in fünf Tabs unterteilt.

### Firma

Basisdaten deiner Organisation: Name, Tagline, Logo-URL, Primärfarbe, Hintergrundfarbe, Schriftarten, Kontaktdaten und Benachrichtigungs-E-Mail.

> 💡 Die **Benachrichtigungs-E-Mail** erhält bei jeder neuen Anfrage automatisch eine Benachrichtigung.

### Formular

Hier steuerst du welche Felder und Optionen im Buchungsformular erscheinen. Mehr dazu im Abschnitt *Felder & Optionen*.

### Abrechnung

Steuersatz (%) und Gültigkeitsdauer für neue Angebote in Tagen.

### Einbetten

Fertiger HTML-Code zum Einbetten des Widgets in deine Website. Einfach kopieren und in den `<body>` einfügen. Das Widget passt sich automatisch in der Höhe an.

### Passwort

Aktuelles Passwort eingeben, dann neues Passwort (mind. 8 Zeichen) vergeben.

---

## Felder & Optionen

Unter **Einstellungen → Formular → Felder** steuerst du was im Buchungsformular erscheint. Die Felder sind nach den 5 Schritten des Formulars gruppiert.

### Checkboxen

Jede Checkbox aktiviert oder deaktiviert ein optionales Feld. Deaktivierte Felder werden den Gästen nicht angezeigt.

### Schritt 3 – Ausstattung

In Schritt 3 wählen Gäste benötigte Ausstattung als Checkboxen. Welche Optionen erscheinen, steuerst du über die **Ausstattungs-Optionen** weiter unten im gleichen Tab.

- Optionen hinzufügen: **+ Option hinzufügen** klicken
- Optionen bearbeiten: direkt im Textfeld ändern
- Optionen entfernen: rotes × klicken
- Keine Optionen = Ausstattungs-Abschnitt ausgeblendet

> 💡 Die Checkbox **Sonstiges Equipment (Freitextfeld)** steuert ob ein freies Textfeld für Sonderwünsche erscheint.

### Schritt 4 – Unterkunft

Die zwei Checkboxen **Verpflegung** und **Zimmerwunsch** steuern ob die jeweiligen Dropdowns erscheinen. Die Auswahl-Optionen pflegst du unter **Verpflegung-Optionen** und **Zimmerwunsch-Optionen**.

> 💡 Ist eine Optionsliste leer, wird das Dropdown auch bei aktiver Checkbox nicht angezeigt.

### Schritt 5 – Abschluss

Mehrere Felder sind über Optionslisten konfigurierbar (erkennbar am Hinweis *Optionen unten wählbar*):

| Feld | Optionsliste | Beispiele |
|---|---|---|
| Abrechnung | Abrechnungs-Optionen | Veranstalter, Teilnehmer selbst |
| Zahlung | Zahlungs-Optionen | Banküberweisung, Bar |
| Anreise | Anreise-Optionen | PKW, Bahn, Bus |
| Budgetrahmen | Budget-Optionen | unter 500 €, 500–2.000 € |
| Wie habt ihr uns gefunden? | Quelle-Optionen | Google, Instagram |

### Optionen verwalten

Alle Optionslisten befinden sich im unteren Bereich des Felder-Abschnitts. Einträge hinzufügen, bearbeiten oder löschen und anschließend **Änderungen speichern** klicken.

---

## Anfragen

Alle eingehenden Anfragen erscheinen hier sortiert nach Eingangsdatum.

### Status-Workflow

| Status | Bedeutung |
|---|---|
| 🔵 Neu | Anfrage eingegangen, noch nicht bearbeitet |
| 🟡 In Prüfung | Wird gerade bearbeitet |
| 🟣 Angebot versendet | Angebot wurde erstellt und verschickt |
| 🟢 Bestätigt | Buchung ist bestätigt |
| 🔴 Abgelehnt | Anfrage wurde abgelehnt |

### Anfrage öffnen

Klick auf eine Anfrage öffnet die Detailansicht mit allen Formulardaten. Im rechten Bereich befindet sich das Angebots-Panel.

---

## Angebote

### Angebot erstellen

Öffne eine Anfrage und klicke im Angebots-Panel auf **+ Angebot**. Die Nummer wird automatisch vergeben (ANB-YYYY-XXXX).

Du kannst Positionen (Bezeichnung, Menge, Einheit, Preis), Steuersatz und Notizen bearbeiten.

### Als PDF speichern

Klicke auf **Drucken / PDF** im Angebot. Im Browser-Dialog wähle „Als PDF speichern" als Drucker.

### Archiv

Unter **Dokumente** findest du alle Angebote mit Filterung nach Status (Offen / Storniert).

> 💡 Angebote können storniert, aber nicht gelöscht werden.

---

## Verfügbarkeit

### Kalenderansicht

Der Kalender zeigt gesperrte Zeiträume und eingetragene Events. Belegte Tage sind farbig markiert und im Buchungsformular nicht wählbar.

### Eintrag hinzufügen

Wähle oben den Typ:

- **Gesperrter Zeitraum** – Datum von/bis und Bezeichnung (z.B. „Betriebsurlaub")
- **Event** – Datum, Bezeichnung, Farbe und optional maximale Kapazität

### Bearbeiten / Löschen

Klicke auf einen Eintrag in der rechten Liste — er wird im Formular geladen. Mit dem roten ✕ löschen.

### Kapazität

Bei Events mit Kapazität siehst du wie viele Plätze noch frei sind. Die Kapazitätsanzeige im Widget aktivierst du unter Einstellungen → Formular → Widget-Features.

---

## Seminarpakete

Pakete werden in Schritt 1 des Buchungsformulars angezeigt, wenn die Paketauswahl in den Einstellungen aktiviert ist.

### Paket anlegen

Klicke auf **+ Neues Paket** und fülle die Felder aus: Name, Beschreibung, Preis pro Person, Min./Max. Teilnehmer, Dauer und ob das Paket aktiv ist.

> 💡 Nur aktive Pakete erscheinen im Buchungsformular.

---

## Vorschau

Die Vorschau zeigt dein Buchungswidget in einem eingebetteten iFrame — so siehst du sofort wie Änderungen wirken.

### Breite anpassen

Ziehe die grauen Handles links oder rechts am iFrame, um verschiedene Bildschirmbreiten zu simulieren. Die aktuelle Breite wird in Pixel angezeigt.

> 💡 Tipp: Ziehe auf ~390 px um eine iPhone-Ansicht zu simulieren.

---

## Häufige Fragen

**Das Widget zeigt meine Änderungen nicht an.**
Einstellungen werden erst nach dem Klick auf „Änderungen speichern" übernommen. Danach ggf. den Browser-Cache leeren (Strg+Shift+R / Cmd+Shift+R).

**Ein Dropdown erscheint nicht, obwohl die Checkbox aktiv ist.**
Prüfe ob die zugehörige Optionsliste mindestens einen Eintrag enthält. Eine leere Liste blendet das Feld automatisch aus.

**Ich bekomme keine E-Mail-Benachrichtigungen.**
Prüfe unter Einstellungen → Firma die Benachrichtigungs-E-Mail. Schaue auch im Spam-Ordner nach.

**Wie ändere ich die Farben des Widgets?**
Unter Einstellungen → Formular → Primärfarbe kannst du den Hex-Code eintragen. Das gesamte Farbschema passt sich automatisch an.

**Wie bettet man das Widget auf der Website ein?**
Den fertigen Code findest du unter Einstellungen → Einbetten. Einfach kopieren und in den `<body>` deiner Website einfügen.

**Kann ich die Ausstattungs-Optionen individuell anpassen?**
Ja. Unter Einstellungen → Formular → Ausstattungs-Optionen kannst du beliebige Optionen hinzufügen, umbenennen oder entfernen. Was dort steht, erscheint als Checkbox im Formular.
