# EventWulf

Mandantenfähige Buchungsplattform für Events und Retreats. Organisationen können ein Anfrage-Widget einbetten, eingehende Anfragen im Admin-Bereich verwalten, Angebote erstellen und ihre Konfiguration (Farben, Felder, Fonts, Texte) anpassen.

---

## Tech Stack

| | |
|--|--|
| **Framework** | Next.js 15 (App Router) |
| **Sprache** | TypeScript 5 |
| **Datenbank** | PostgreSQL via Neon (serverless) |
| **ORM** | Prisma |
| **Auth** | JWT (jose) + httpOnly Cookies |
| **E-Mail** | Resend |
| **Styling** | Tailwind CSS 4 + CSS Custom Properties |
| **State** | Zustand |
| **Hosting** | Vercel |

---

## Kernfunktionen

- **Öffentliches Anfrage-Widget** – 5-schrittiger Formular-Wizard, per iframe einbettbar
- **Multi-Tenant** – eine Instanz, beliebig viele Organisationen mit eigener Konfiguration
- **Admin-Dashboard** – Anfragen verwalten, Verfügbarkeit pflegen, Widget konfigurieren
- **Angebote** – PDF-Angebote direkt aus Anfragen generieren (ANB-YYYY-XXXX)
- **Kalender** – gesperrte Daten und Events mit Farbmarkierung
- **E-Mail-Benachrichtigungen** – Operator-Mail + Bestätigungs-Mail an Anfragenden
- **Autologin** – externes System (z.B. BookingWulf) kann per HMAC-signiertem Token einloggen
- **Dark/Light Mode** – Theme-Switcher im Sidebar, Präferenz wird in localStorage gespeichert

---

## Datenmodell

```
Organization
├── id, name, bookingAppUrl, bookingAppKey
├── → User[]          (Admin-Nutzer)
└── → Client[]        (ein Client = ein Slug = eine Konfiguration)

Client
├── id, slug (unique), config (JSON)
├── → BlockedDate[]   (Kalendereinträge)
├── → Inquiry[]       (eingehende Anfragen)
├── → Package[]       (Seminarpakete)
└── → Invoice[]       (Angebote)

User
└── id, email, password (bcrypt)

Inquiry
└── id, data (JSON), status: neu | in_pruefung | angebot_versendet | bestaetigt | abgelehnt
    packageId? → Package, participantCount

Package
└── id, name, description, pricePerPerson, minParticipants, maxParticipants,
    durationDays, isActive, sortOrder

BlockedDate
└── id, startDate, endDate, label, type: blocked | event, color,
    maxCapacity?, bookedCount

Invoice
└── id, number (ANB-YYYY-XXXX), status: offen | storniert,
    issuedAt, validUntil, lineItems (JSON), taxRate,
    recipientName, recipientEmail, eventTitle, notes,
    inquiryId? → Inquiry

Counter
└── key (unique), value  — atomarer Zähler für Angebotsnummern
```

---

## App-Struktur

### Öffentliche Seiten

| Route | Beschreibung |
|-------|-------------|
| `/` | Formular-Widget (Slug per `?slug=` Parameter) |

### Admin-Bereich (`/admin`)

| Seite | Beschreibung |
|-------|-------------|
| `/admin/login` | Login (Dark Mode) |
| `/admin/config` | Einstellungen – Firma, Formularfelder, Abrechnung, Einbetten, Passwort |
| `/admin/inquiries` | Posteingang – Anfragen mit Status-Workflow + Angebots-Panel |
| `/admin/availability` | Kalender – gesperrte Daten und Events |
| `/admin/packages` | Seminarpakete verwalten |
| `/admin/invoices` | Angebots-Archiv mit Filterung |
| `/admin/vorschau` | Live-Vorschau des Widgets mit drag-to-resize iFrame |
| `/admin/clients` | Superadmin: alle Organisationen verwalten |

### API-Endpunkte

| Endpunkt | Zugriff | Beschreibung |
|----------|---------|-------------|
| `POST /api/submit` | öffentlich | Formular-Einreichung |
| `GET /api/availability` | öffentlich | Kalendereinträge inkl. Kapazität für einen Slug |
| `GET /api/packages` | öffentlich | Aktive Seminarpakete für einen Slug |
| `GET /api/autologin` | HMAC-signiert | Autologin von externem System |
| `POST /api/provision` | Secret | Neue Organisation anlegen |
| `GET/POST /api/admin/invoices` | Session | Angebote laden / erstellen |
| `PATCH/DELETE /api/admin/invoices/[id]` | Session | Angebot bearbeiten / stornieren |
| `GET /api/admin/invoices/[id]/html` | Session | Angebot als HTML für PDF |
| `/api/admin/*` | Session | Alle weiteren Admin-Operationen |

---

## Konfigurationssystem

Jeder Client hat eine JSON-Konfiguration (`EventConfig`) die in der Datenbank gespeichert wird:

- **Firma:** Name, Tagline, Logo, E-Mail, Telefon, Website, Adresse
- **Erscheinungsbild:** Primärfarbe, Hintergrundfarbe, Titel-Font, Body-Font
- **Formular:** Welche optionalen Felder angezeigt werden (pro Schritt konfigurierbar)
- **Dropdown-Optionen:** Verpflegung, Zimmerwunsch, Abrechnung
- **Benachrichtigung:** E-Mail-Adresse für neue Anfragen
- **Angebotseinstellungen:** Steuersatz (%), Gültigkeitstage

Ladereihenfolge: DB → `config/clients/{slug}.json` → `config/clients/default.json`

---

## Formular-Wizard

| Schritt | Felder |
|---------|--------|
| 1 – Veranstaltung | Seminarpaket (optional), Art/Titel, Datum von/bis, Uhrzeit (optional) |
| 2 – Gruppe | Name, E-Mail, Personenanzahl, Leiter:innen, Telefon, Sprache |
| 3 – Ausstattung | Bestuhlung, Tische, Beamer, Soundanlage, Außenbereich, Equipment |
| 4 – Verpflegung | Verpflegungswunsch, Zimmerwunsch |
| 5 – Abschluss | Rahmenprogramm, Abrechnung, Anreise, Barrierefreiheit, Budget, Wie gefunden |

Optionale Felder werden per Konfiguration ein- und ausgeblendet. Jeder Schritt hat eine eigene Validierung vor dem Weiterblättern.

---

## Angebotssystem

Angebote werden aus dem Anfragen-Panel oder dem Archiv heraus erstellt:

- **Nummer:** `ANB-YYYY-XXXX` (atomar über `Counter`-Tabelle, race-condition-sicher)
- **Status:** `offen` → `storniert`
- **Positionen:** beliebig viele Zeilen mit Bezeichnung, Menge, Einheit, Einzelpreis
- **Steuersatz:** aus Konfiguration (Standard 20 %)
- **Gültigkeit:** aus Konfiguration in Tagen (Standard 30)
- **HTML-Vorschau:** `/api/admin/invoices/[id]/html` – kann browser-seitig gedruckt/als PDF gespeichert werden

---

## Admin-UI

Das Admin-Interface ist als **Dark/Light Mode** ausgeführt:

- **Dark Mode** (Standard gespeichert): Slate-900 Hintergrund (`#0f172a`), Indigo-Akzent (`#818cf8`)
- **Light Mode**: Slate-50 Hintergrund (`#f1f5f9`), Indigo-Akzent (`#4f46e5`)
- **Theme-Switcher:** Mond/Sonne-Icon neben dem Abmelden-Button in der Sidebar
- **Präferenz** wird in `localStorage` gespeichert, beim Laden per Inline-Script sofort angewendet (kein FOUC)
- **Sidebar:** sticky, 220px breit, kollabiert auf Mobile zu einer Top-Bar
- **Vorschau-iFrame:** drag-to-resize Handles links und rechts, Breitenangabe in px

Alle Farben laufen über CSS Custom Properties (`.admin-shell` und `.admin-shell[data-theme="dark"]`), sodass der Theme-Switch ohne JavaScript-Neurendering funktioniert.

---

## E-Mail-Flow

Bei jeder Anfrage werden zwei Mails verschickt:

1. **Operator-Mail** → an `notifyEmail` aus der Config
   - Betreff: `Neue Anfrage: {Titel} – {Name}`
   - Inhalt: alle Formulardaten als HTML-Tabelle
   - Reply-To: E-Mail des Anfragenden

2. **Bestätigungs-Mail** → an den Anfragenden (wenn E-Mail angegeben)
   - Betreff: `Anfrage bestätigt – {Titel}`
   - Inhalt: Zusammenfassung + Firmenkontaktdaten

---

## Security

- JWT-Secret als Pflicht-Env-Var (kein Fallback)
- HTTP Security Headers (CSP, HSTS, X-Frame-Options, …)
- `frame-ancestors *` nur für `/` (Widget), `frame-ancestors 'none'` für Admin/API
- Rate Limiting auf Login, Submit und Availability
- Input-Validierung auf allen öffentlichen Endpunkten
- E-Mail-Header-Injection verhindert
- `secure`-Flag auf Cookies in allen Nicht-Dev-Umgebungen
- Passwort-Mindestlänge 8 Zeichen (bcrypt, cost 12)
- HMAC-Autologin mit Timing-Safe-Vergleich

---

## Umgebungsvariablen

| Variable | Pflicht | Beschreibung |
|----------|:-------:|-------------|
| `JWT_SECRET` | ✅ | JWT-Signing-Secret |
| `DATABASE_URL` | ✅ | PostgreSQL Connection String (Neon, `sslmode=verify-full`) |
| `RESEND_API_KEY` | ✅ | Resend API-Key |
| `NOTIFY_EMAIL` | – | Fallback-Empfänger für Anfragen |
| `PROVISIONING_SECRET` | – | Schutz für den Provision-Endpunkt |
| `SUPERADMIN_SLUG` | – | Slug des Superadmins (Standard: `admin`) |
| `NODE_ENV` | – | Von Next.js gesetzt |

---

## Geplant: Phase 3 – Teilnehmerverwaltung

Einzelne Teilnehmer hinter einer Anfrage erfassen und verwalten. Sinnvoll für Seminarbetriebe, die Zimmerzuweisung, Namenslisten und Essensplanung direkt im System abwickeln wollen.

### Datenmodell

```
Participant
└── id, inquiryId → Inquiry, firstName, lastName, email, phone,
    dietaryReq, notes, status: angemeldet | bestaetigt | abgesagt
```

### Admin

- Im Anfragen-Panel kommt unter den bestehenden Feldern eine ausklappbare **Teilnehmerliste**
- Admin kann Teilnehmer manuell hinzufügen und deren Status einzeln setzen
- **CSV-Export** der Teilnehmerliste pro Anfrage (clientseitig, keine neue Route nötig)

### Neue API-Routes

| Endpunkt | Methode | Beschreibung |
|----------|---------|-------------|
| `/api/admin/inquiries/[id]/participants` | GET, POST | Teilnehmer einer Anfrage laden / hinzufügen |
| `/api/admin/participants/[id]` | PATCH, DELETE | Einzelnen Teilnehmer bearbeiten / entfernen |

### Buchungsformular (optional)

- Neuer ausklappbarer Block in Schritt 2 – standardmäßig minimiert
- Gruppenleitung kann Teilnehmer direkt beim Einreichen erfassen
- Werden nach dem `prisma.inquiry.create()` per `createMany` gespeichert
