# EventWulf

Mandantenfähige Buchungsplattform für Events und Retreats. Organisationen können ein Anfrage-Widget einbetten, eingehende Anfragen im Admin-Bereich verwalten, Angebote erstellen, Räume und terminierte Events verwalten und ihre Konfiguration (Farben, Felder, Fonts, Texte) anpassen.

---

## Tech Stack

| | |
|--|--|
| **Framework** | Next.js 16 (App Router, Turbopack) |
| **Sprache** | TypeScript 5 |
| **Datenbank** | PostgreSQL via Neon (serverless), Zugriff über `@prisma/adapter-pg` |
| **ORM** | Prisma 7 |
| **Auth** | JWT (jose) + httpOnly Cookies |
| **E-Mail** | Resend |
| **Bild-Hosting** | Bunny CDN (Storage Zone + Pull Zone), Optimierung/Resize via `sharp` |
| **Styling** | CSS Custom Properties (kein Tailwind) |
| **State** | Zustand |
| **Hosting** | Vercel (inkl. Vercel Cron) — **Deploy ist manuell** (`vercel --prod`), kein Auto-Deploy bei Push |

---

## Kernfunktionen

- **Öffentliches Anfrage-Widget** – 5-schrittiger Formular-Wizard, per iframe einbettbar
- **Multi-Tenant** – eine Instanz, beliebig viele Organisationen mit eigener Konfiguration
- **Admin-Dashboard** – Anfragen verwalten, Elemente (Formular/Events/Räume/Sperrzeiten) pflegen, Widget konfigurieren
- **Paket-System** – Organisation hat ein Paket (Basis/Pro/Premium), schaltet Features wie Räume frei (siehe unten)
- **Events** – terminierte, buchbare Angebote mit eigenem Mini-Widget, Kapazitätsverwaltung, optional einem Raum zugeordnet
- **Räume** – mehrere Räume pro Kunde mit Kapazität, Bild und echter Verfügbarkeitsprüfung (siehe eigener Abschnitt unten)
- **Angebote** – PDF-Angebote direkt aus Anfragen generieren (ANB-YYYY-XXXX)
- **Kalender** – gesperrte Zeiträume, Events und (pro Raum) Raumbelegung mit Farbmarkierung
- **E-Mail-Benachrichtigungen** – Operator-Mail + Bestätigungs-Mail an Anfragenden
- **Automatischer Ablauf unbeantworteter Buchungen** – Event- und Raum-Anfragen laufen nach 48h automatisch ab (Vercel Cron, stündlich)
- **iCal-Export** – "Zum Kalender hinzufügen" Button in Bestätigungsmail (Google, Apple, Outlook)
- **Stornierung per Link** – Gäste können ohne Login stornieren, Admin wird per Mail informiert
- **Autologin** – externes System (z.B. BookingWulf) kann per HMAC-signiertem Token einloggen
- **Dark/Light Mode** – Theme-Switcher im Sidebar, Präferenz wird in `localStorage` gespeichert

---

## Datenmodell

```
Organization
├── id, name, bookingAppUrl, bookingAppKey
├── plan: "basis" | "pro" | "premium"   — gilt für alle Clients der Organisation
├── → User[]          (Admin-Nutzer)
└── → Client[]        (ein Client = ein Slug = ein Widget/Standort)

Client
├── id, slug (unique), config (JSON)
├── → BlockedDate[]   (Sperrzeiten)
├── → Inquiry[]       (eingehende Anfragen)
├── → Event[]         (terminierte Angebote)
└── → Room[]          (Räume)

User
└── id, email, password (bcrypt)

Room
└── id, clientId → Client, name, description, image, capacity?,
    isActive, sortOrder
    → Inquiry[] (Anfragen für diesen Raum), → Event[] (zugeordnete Events)

Event
└── id, clientId → Client, name, description, image, startDate, endDate,
    color, intern (sperrt allgemeinen Kalender, nur wenn KEIN Raum
    zugeordnet ist — siehe Räume-Abschnitt), pricePerPerson,
    minParticipants, maxParticipants, bookedCount, isActive, sortOrder,
    roomId? → Room

BlockedDate
└── id, clientId → Client, startDate, endDate, label

Inquiry
└── id, clientId → Client, data (JSON von InquiryFormData),
    status: neu | in_pruefung | angebot_versendet | bestaetigt |
    abgelehnt | storniert | abgelaufen,
    eventId? → Event, roomId? → Room, participantCount,
    holdExpiresAt? (Ablauf-Hold für Event-/Raum-Buchungen),
    cancelToken? (unique), cancelledAt?

Invoice
└── id, clientId → Client, inquiryId → Inquiry, number (ANB-YYYY-XXXX),
    status: offen | storniert, lineItems (JSON), taxRate, validUntil,
    issuedAt

InvoiceCounter
└── id (z.B. "angebot-2026"), counter  — atomarer Zähler für Angebotsnummern
```

---

## Paket-System

Zentral in `lib/plan.ts`. Ein Feature wird über `hasFeature(plan, feature)` freigeschaltet, gegen eine Mindest-Paket-Zuordnung (`FEATURE_MIN_PLAN`). Aktuell nur `rooms` (ab Pro).

Der Superadmin (Bereich "Kunden verwalten", nur für den Betreiber sichtbar) weist jeder Organisation ein Paket per Dropdown zu. Serverseitig durchgesetzt — nicht nur im Admin-UI versteckt, sondern die API selbst blockt (403), wenn das Paket ein Feature nicht enthält.

---

## Räume — vollständige Regelung

Räume sind physische Veranstaltungsräume eines Standorts (z.B. "Großer Saal", "Seminarraum"), die Gäste im Anfrageformular auswählen können, mit **echter, race-sicherer Verfügbarkeitsprüfung**.

### Freischaltung & Limits

| Paket | Räume | Kalender/Doppelbuchungsschutz |
|-------|-------|-------------------------------|
| Basis | Tab gesperrt (🔒), 0 Räume | – |
| Pro | max. 3 Räume pro Kunde | ✅ |
| Premium | unbegrenzt | ✅ |

### Admin-Verwaltung (`Elemente → Räume`)

Volles CRUD: Name, Beschreibung (RichText), Bild (JPEG/PNG/WebP, **max. 4MB** — Vercels Serverless-Body-Limit liegt bei ~4.5MB, das App-Limit ist bewusst darunter, sonst kommt eine nichtssagende generische Fehlermeldung statt einer klaren "Datei zu groß"), Kapazität, Sortierung, Aktiv-Schalter. Bild-Upload nutzt dieselbe generische Route wie Events (`/api/admin/events/upload`), landet auf Bunny CDN, wird zu WebP optimiert.

### Gäste-Formular (Schritt 1 "Veranstaltung")

- Raumauswahl als Karten (Bild, Name, Kapazität) — ausblendbar über einen Formular-Feld-Schalter, auch wenn Räume angelegt sind
- Wählt der Gast **zuerst ein Datum**, werden für diesen Zeitraum bereits belegte Räume **ausgegraut und deaktiviert** (`/api/rooms` akzeptiert optional `datumVon`/`datumBis` und markiert jeden Raum mit `available: boolean`)
- Wählt der Gast **zuerst einen Raum**, zeigt der Kalender danach nur noch die für **diesen** Raum relevanten Sperren:
  - globale Sperrzeiten (`BlockedDate`) — gelten für alle Räume
  - eigene Anfragen für diesen Raum ("Raum belegt")
  - Events, die **diesem** Raum zugeordnet sind (siehe unten) — Events anderer Räume tauchen gar nicht auf, auch nicht informativ
- Wechselt der Gast nachträglich den Raum und die bereits gewählten Daten sind für den neuen Raum ungültig, wird die Auswahl automatisch zurückgesetzt (mit sichtbarem Warnhinweis) — passiert in der Praxis aber kaum noch, weil inkompatible Räume ja schon ausgegraut sind, sobald ein Datum steht
- Schritt 2: Warnhinweis, wenn die eingegebene Teilnehmerzahl die Kapazität des gewählten Raums übersteigt (kein Hard-Block, nur Hinweis)

### Events ↔ Räume

Ein Event kann optional einem Raum zugeordnet werden (Admin-Dropdown im Event-Formular, nur sichtbar wenn Räume existieren). Das schließt eine Lücke, die es vorher gab: Events und Räume waren komplett unabhängig, ein Event konnte denselben physischen Raum belegen wie eine normale Gästeanfrage, ohne dass beide Systeme sich gegenseitig kannten.

- Ist einem Event ein Raum zugeordnet, blockiert es **nur noch diesen einen Raum** für seinen Zeitraum — unabhängig vom "Intern"-Schalter (der wirkt nur noch auf den allgemeinen/raumlosen Kalender, wenn **kein** Raum zugeordnet ist)
- Kein Raum zugeordnet + "Intern" aktiv → blockiert weiterhin (wie bisher) den gesamten allgemeinen Kalender für alle Räume, da unklar ist, welcher physische Raum betroffen ist
- Der Event-Banner im Kalender zeigt den zugeordneten Raum im Tooltip

### Race-sichere Verfügbarkeitsprüfung (`lib/roomAvailability.ts`)

Beim Absenden einer Anfrage läuft die Überschneidungsprüfung **innerhalb einer Datenbank-Transaktion mit einer Postgres Advisory Lock** pro Raum (`pg_advisory_xact_lock(hashtext(roomId))`). Zwei exakt gleichzeitige Anfragen für denselben Raum/Zeitraum werden dadurch serialisiert — die zweite sieht garantiert die schon gespeicherte erste Anfrage und wird korrekt mit `409` abgelehnt, statt dass beide durchrutschen. Geprüft wird gegen:
1. andere nicht stornierte/abgelehnte/abgelaufene Anfragen für denselben Raum
2. Events, die diesem Raum zugeordnet sind

Getestet mit echter Nebenläufigkeit (zwei parallele Requests), nicht nur sequenziell.

### Automatischer Ablauf (Cron)

Wie bei Events laufen unbeantwortete Raum-Anfragen nach 48h automatisch auf Status "Abgelaufen" (`/api/cron/room-holds`, stündlich via Vercel Cron, `x-cron-secret`-Auth). Anders als bei Events gibt es keine Kapazität zum Freigeben — der Raum wird automatisch wieder verfügbar, weil seine Belegung live aus nicht-abgelaufenen Anfragen berechnet wird, kein gespeicherter Zähler.

### Sicherheit

`roomId` (wie auch `eventId`) wird beim Absenden **zwingend gegen den anfragenden Mandanten gescoped** (`clientId`-Filter) — verhindert, dass jemand über die öffentlich einsehbare Raum-/Event-ID eines fremden Kunden (`/api/rooms?slug=<kunde>`) eine Buchung bei einem anderen Kunden auslöst (Cross-Tenant-IDOR, im Rahmen dieser Session gefunden und gefixt, siehe Security-Doku).

---

## App-Struktur

### Öffentliche Seiten

| Route | Beschreibung |
|-------|-------------|
| `/` | Formular-Widget (Slug per `?kunde=` Parameter) |
| `/events` | Eigenständige Events-Liste zum Direktbuchen (umgeht den 5-Schritt-Wizard) |

### Admin-Bereich (`/admin`)

| Seite | Beschreibung |
|-------|-------------|
| `/admin/login` | Login |
| `/admin/config` | Einstellungen – Firma, Abrechnung, Passwort |
| `/admin/elemente` | Formular / Events / **Räume** / Sperrzeiten — alles, was das öffentliche Widget prägt |
| `/admin/embed` | Embed-Codes für Formular und Events-Widget |
| `/admin/inquiries` | Posteingang – Anfragen mit Status-Workflow + Angebots-Panel |
| `/admin/invoices` | Angebots-Archiv mit Filterung |
| `/admin/vorschau` | Live-Vorschau des Widgets mit drag-to-resize iFrame |
| `/admin/handbuch` | Eingebautes Hilfe-/FAQ-System |
| `/admin/clients` | Superadmin: alle Organisationen verwalten, Paket zuweisen |

### Wichtige API-Endpunkte

| Endpunkt | Zugriff | Beschreibung |
|----------|---------|-------------|
| `POST /api/submit` | öffentlich | Formular-Einreichung (Cross-Tenant-gescoped seit dieser Session) |
| `GET /api/availability` | öffentlich | Kalendereinträge, optional raumspezifisch via `roomId` |
| `GET /api/events` | öffentlich | Aktive Events für einen Slug |
| `GET /api/rooms` | öffentlich | Aktive Räume für einen Slug, optional mit `datumVon`/`datumBis` → `available`-Flag pro Raum |
| `GET /api/cancel/[token]` | öffentlich | Anfrage per Token stornieren |
| `GET /api/ical/[id]` | öffentlich | iCal-Datei für eine Anfrage |
| `GET /api/cron/event-holds` | Cron-Secret | Event-Holds nach 48h ablaufen lassen (stündlich) |
| `GET /api/cron/room-holds` | Cron-Secret | Raum-Holds nach 48h ablaufen lassen (stündlich) |
| `GET /api/cron/reminders` | Cron-Secret | Erinnerungsmail (täglich) |
| `GET /api/autologin` | HMAC-signiert | Autologin von externem System |
| `POST /api/provision` | Secret | Neue Organisation anlegen |
| `/api/admin/rooms` | Session + Paket | Räume-CRUD (403 wenn Paket sie nicht freischaltet) |
| `/api/admin/events` | Session | Events-CRUD, inkl. optionaler Raumzuordnung |
| `/api/admin/clients` | Session (Superadmin) | Organisationen anlegen/löschen, Paket zuweisen (PATCH) |
| `/api/admin/*` | Session | Alle weiteren Admin-Operationen |

---

## Konfigurationssystem

Jeder Client hat eine JSON-Konfiguration (`EventConfig`) in der Datenbank:

- **Firma:** Name, Tagline, Logo, E-Mail, Telefon, Website, Adresse
- **Erscheinungsbild:** Primärfarbe, Hintergrundfarbe, Titel-Font, Body-Font
- **Formular:** Welche optionalen Felder angezeigt werden (pro Schritt konfigurierbar, inkl. Raumwahl)
- **Dropdown-Optionen:** Verpflegung, Zimmerwunsch, Abrechnung, Ausstattung, Anreise, Zahlung, Budget, Quelle
- **Benachrichtigung:** E-Mail-Adresse für neue Anfragen
- **Angebotseinstellungen:** Steuersatz (%), Gültigkeitstage

Ladereihenfolge: DB → `config/clients/{slug}.json` → `config/clients/default.json`

---

## Umgebungsvariablen

| Variable | Pflicht | Beschreibung |
|----------|:-------:|-------------|
| `JWT_SECRET` | ✅ | JWT-Signing-Secret |
| `DATABASE_URL` | ✅ | PostgreSQL Connection String (Neon) |
| `RESEND_API_KEY` | ✅ | Resend API-Key |
| `BUNNY_STORAGE_ZONE` / `BUNNY_STORAGE_KEY` / `BUNNY_CDN_HOST` | ✅ (für Bild-Upload) | Bunny CDN — **in Vercel-Produktion separat prüfen**, nicht identisch mit lokaler `.env.local` garantiert |
| `CRON_SECRET` | ✅ (für Cron-Jobs) | Auth-Header für `/api/cron/*` — **in Vercel-Produktion separat prüfen** |
| `NOTIFY_EMAIL` | – | Fallback-Empfänger für Anfragen |
| `PROVISIONING_SECRET` | – | Schutz für den Provision-Endpunkt |
| `SUPERADMIN_SLUG` | – | Slug des Superadmins (Standard: `admin`) |

---

## Deploy

**Kein Auto-Deploy bei Git-Push.** Der Betreiber deployt manuell über `vercel --prod` (CLI-Login nötig, `vercel login`). Das Vercel-Projekt heißt intern (URL-Slug) "eventwulf-app", der öffentliche Alias ist weiterhin `eventwulf.vercel.app` — keine zwei getrennten Projekte, nur ein abweichender interner Slug-Name.

**Migrationen laufen automatisch mit jedem Build** (`npm run build` → `prisma generate && node scripts/migrate-deploy-unpooled.js && next build`) — kein separater manueller `prisma migrate deploy`-Schritt vor `vercel --prod` mehr nötig. Ein fehlgeschlagener Migrationsversuch lässt den Build (und damit den Deploy) fehlschlagen, statt stillschweigend gegen ein veraltetes Schema zu deployen.

---

## Changelog

### Räume-Feature + Security-Fixes — September 2026

**Umfang:** Neues Multi-Room-Feature mit Paket-Gating, Event-Raum-Zuordnung, race-sichere Verfügbarkeitsprüfung, mehrere im Live-Betrieb entdeckte Kalender-Bugs, ein Security-Review mit einem behobenen High-Severity-Fund. 9 Commits.

**Hauptpunkte:**
- Neues `Room`-Modell + Admin-CRUD, `Organization.plan` (Basis/Pro/Premium) als zentrales Freischaltungssystem
- Raumwahl im Anfrageformular, raumspezifischer Kalender, Ausgrauen nicht verfügbarer Räume bei Datumswahl
- Race-sichere Buchung via Postgres Advisory Lock (getestet mit echter Nebenläufigkeit)
- `Event.roomId` — Events können Räume belegen, inkl. Fix für einen Live-Bug (intern-Events blockierten fälschlich fremde Räume)
- Automatischer 48h-Ablauf für Raum-Anfragen (neuer Cron-Job)
- Bild-Upload-Fix: Vercels ~4.5MB-Body-Limit unterlief die eigene 5MB-Prüfung, Limit auf 4MB gesenkt + Client-seitige Vorprüfung
- **Security-Review (Diff-Scope):** Cross-Tenant-IDOR gefunden und behoben — `roomId`/`eventId` in `/api/submit` waren nicht auf den anfragenden Mandanten gescoped, ermöglichte Buchungen gegen fremde Räume/Events samt Paket-Umgehung. Verifiziert mit echten Exploit-Versuchen gegen Testmandanten.
- Vorbestehender Absturz bei ungültiger Session (gelöschter Client, Cookie noch gültig) auf drei Admin-Seiten behoben

**Bewusst nicht umgesetzt:** Vollständiger Codebase-Security-Audit (der durchgeführte Review deckte nur den Diff dieser Session ab, nicht die restliche, ältere Codebasis).
