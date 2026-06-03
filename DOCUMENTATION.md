# EventWulf – Technische Dokumentation

## Inhaltsverzeichnis

1. [Projektübersicht](#1-projektübersicht)
2. [Tech Stack](#2-tech-stack)
3. [Projektstruktur](#3-projektstruktur)
4. [Datenbankschema](#4-datenbankschema)
5. [Auth & Sessions](#5-auth--sessions)
6. [API-Routen](#6-api-routen)
7. [Konfigurationssystem](#7-konfigurationssystem)
8. [Formular-Wizard](#8-formular-wizard)
9. [Admin-Bereich](#9-admin-bereich)
10. [E-Mail-System](#10-e-mail-system)
11. [Security](#11-security)
12. [Umgebungsvariablen](#12-umgebungsvariablen)
13. [Deployment](#13-deployment)

---

## 1. Projektübersicht

EventWulf ist eine mandantenfähige Buchungsplattform für Events und Retreats. Organisationen können ein White-Label-Anfrage-Widget einbetten, eingehende Anfragen im Admin-Bereich verwalten und ihre Konfiguration (Farben, Felder, Texte) anpassen.

**Kernfunktionen:**
- Öffentliches 5-schrittiges Anfrage-Formular (einbettbar per iframe)
- Multi-Tenant: eine Instanz, beliebig viele Organisationen
- Admin-Dashboard pro Organisation
- Kalender mit gesperrten Daten / Events
- Angebotssystem (PDF-Angebote direkt aus Anfragen, ANB-YYYY-XXXX)
- E-Mail-Benachrichtigungen via Resend
- Automatische Erinnerungsmail 24h vor bestätigtem Event (Vercel Cron)
- iCal-Export: "Zum Kalender hinzufügen"-Button in Bestätigungsmail
- Stornierung per Link: Gäste können ohne Login stornieren, Admin wird per E-Mail informiert
- Dark/Light Mode im Admin mit Theme-Switcher

---

## 2. Tech Stack

| Bereich | Technologie |
|---------|-------------|
| Framework | Next.js 16 (App Router) |
| Sprache | TypeScript 5 |
| Datenbank | PostgreSQL (Neon) |
| ORM | Prisma 7 mit `@prisma/adapter-pg` |
| Auth | JWT via `jose`, Cookies |
| E-Mail | Resend |
| Styling | Tailwind CSS 4 |
| State | Zustand |
| Passwort-Hashing | bcryptjs |

---

## 3. Projektstruktur

```
eventwulf/
├── app/
│   ├── page.tsx                        # Öffentliches Formular
│   ├── layout.tsx
│   ├── storniert/
│   │   ├── page.tsx                    # Server wrapper
│   │   └── StornierenContent.tsx       # Stornierungsbestätigung (ok/already/invalid)
│   ├── admin/
│   │   ├── login/page.tsx
│   │   └── (protected)/
│   │       ├── layout.tsx              # Auth-Guard
│   │       ├── page.tsx                # Dashboard
│   │       ├── config/page.tsx
│   │       ├── inquiries/page.tsx
│   │       ├── availability/page.tsx
│   │       ├── packages/page.tsx
│   │       ├── invoices/page.tsx
│   │       ├── clients/page.tsx
│   │       └── vorschau/page.tsx
│   └── api/
│       ├── submit/route.ts             # Formular-Einreichung (öffentlich)
│       ├── availability/route.ts       # Gesperrte Daten (öffentlich)
│       ├── packages/route.ts           # Aktive Seminarpakete (öffentlich)
│       ├── ical/[id]/route.ts          # iCal-Download für Anfrage (öffentlich)
│       ├── cancel/[token]/route.ts     # Stornierung per Token (öffentlich)
│       ├── autologin/route.ts          # HMAC-basierter Auto-Login
│       ├── provision/route.ts          # Neue Organisation anlegen
│       ├── cron/
│       │   └── reminders/route.ts      # Vercel Cron: 24h-Erinnerungsmails
│       └── admin/
│           ├── login/route.ts
│           ├── logout/route.ts
│           ├── account/route.ts
│           ├── config/route.ts
│           ├── clients/route.ts
│           ├── inquiries/route.ts
│           ├── inquiries/[id]/participants/route.ts
│           ├── availability/route.ts
│           ├── packages/route.ts
│           ├── invoices/route.ts
│           ├── invoices/[id]/route.ts
│           ├── invoices/[id]/html/route.ts
│           ├── slugs/route.ts
│           ├── switch-slug/route.ts
│           └── orgs/[id]/clients/route.ts
├── components/
│   ├── Wizard.tsx
│   ├── Calendar.tsx
│   ├── IframeResizer.tsx
│   ├── steps/
│   │   ├── Step1Veranstaltung.tsx
│   │   ├── Step2Gruppe.tsx
│   │   ├── Step3Ausstattung.tsx
│   │   ├── Step4Verpflegung.tsx
│   │   └── Step5Abschluss.tsx
│   └── admin/
│       ├── AdminShell.tsx
│       ├── ThemeToggle.tsx
│       ├── AvailabilityEditor.tsx
│       ├── ClientsEditor.tsx
│       ├── ConfigEditor.tsx
│       ├── InquiryInbox.tsx
│       ├── InvoicePanel.tsx
│       └── LogoutButton.tsx
├── lib/
│   ├── auth.ts
│   ├── db.ts
│   ├── loadConfig.ts
│   ├── ratelimit.ts
│   ├── theme.ts
│   ├── types.ts
│   └── validate.ts
├── config/
│   └── clients/
│       └── default.json
├── vercel.json                         # Cron-Job-Konfiguration
└── prisma/
    └── schema.prisma
```

---

## 4. Datenbankschema

### Organization
| Feld | Typ | Beschreibung |
|------|-----|--------------|
| id | cuid | Primärschlüssel |
| name | String | Organisationsname |
| bookingAppUrl | String? | URL der Buchungs-App (für Autologin) |
| bookingAppKey | String? | HMAC-Secret für Autologin |
| createdAt | DateTime | |

Relationen: hat viele `Client`, hat viele `User`

### Client
| Feld | Typ | Beschreibung |
|------|-----|--------------|
| id | cuid | Primärschlüssel |
| slug | String (unique) | URL-Identifier, z.B. `openspace` |
| config | String | JSON-serialisiertes `YogaConfig`-Objekt |
| organizationId | String? | FK zu Organization |
| createdAt / updatedAt | DateTime | |

Relationen: hat viele `BlockedDate`, hat viele `Inquiry`

### User
| Feld | Typ | Beschreibung |
|------|-----|--------------|
| id | cuid | Primärschlüssel |
| email | String (unique) | Login-E-Mail |
| password | String | bcrypt-Hash (cost factor 12) |
| organizationId | String? | FK zu Organization |

### BlockedDate
| Feld | Typ | Beschreibung |
|------|-----|--------------|
| id | cuid | |
| clientId | String | FK zu Client |
| startDate / endDate | DateTime | Zeitraum |
| label | String | Anzeigename |
| type | String | `"blocked"` oder `"event"` |
| color | String | Hex-Farbe für Kalender |
| maxCapacity | Int? | Maximale Teilnehmerzahl (nur bei type=event) |
| bookedCount | Int | Bereits gebuchte Plätze (Standard: 0) |

### Inquiry
| Feld | Typ | Beschreibung |
|------|-----|--------------|
| id | cuid | |
| clientId | String | FK zu Client |
| data | String | JSON-serialisiertes `InquiryFormData` |
| status | String | `neu` / `in_pruefung` / `angebot_versendet` / `bestaetigt` / `abgelehnt` / `storniert` |
| participantCount | Int | Teilnehmerzahl (für Kapazitätsverwaltung) |
| packageId | String? | FK zu Package |
| reminderSentAt | DateTime? | Zeitstempel der gesendeten 24h-Erinnerungsmail |
| cancelToken | String? (unique) | Sicherer Token für Stornierung per Link |
| cancelledAt | DateTime? | Zeitstempel der Stornierung durch Gast |
| createdAt | DateTime | |

### Package
| Feld | Typ | Beschreibung |
|------|-----|--------------|
| id | cuid | |
| clientId | String | FK zu Client |
| name | String | Paketname |
| description | String? | Beschreibung |
| pricePerPerson | Float? | Preis pro Person |
| minParticipants | Int? | Mindestteilnehmerzahl |
| maxParticipants | Int? | Maximalteilnehmerzahl |
| durationDays | Int? | Dauer in Tagen |
| isActive | Boolean | Sichtbar im Widget |
| sortOrder | Int | Reihenfolge |

### Invoice
| Feld | Typ | Beschreibung |
|------|-----|--------------|
| id | cuid | |
| clientId | String | FK zu Client |
| number | String | `ANB-YYYY-XXXX` |
| status | String | `offen` / `storniert` |
| issuedAt | DateTime | Ausstellungsdatum |
| validUntil | DateTime | Gültig bis |
| lineItems | String | JSON-Array mit Positionen |
| taxRate | Float | Steuersatz in % |
| recipientName | String | Empfängername |
| recipientEmail | String? | Empfänger-E-Mail |
| eventTitle | String? | Veranstaltungstitel |
| notes | String? | Freitext-Notizen |
| inquiryId | String? | FK zu Inquiry |

### Counter
| Feld | Typ | Beschreibung |
|------|-----|--------------|
| key | String (unique) | Schlüssel (z.B. `invoice`) |
| value | Int | Aktueller Zählerstand |

Atomarer Zähler für Angebotsnummern (race-condition-sicher via `increment`).

---

## 5. Auth & Sessions

### JWT-basierte Session

- **Bibliothek:** `jose`
- **Algorithmus:** HS256
- **Secret:** `JWT_SECRET` (Env-Var, Pflichtfeld — wirft beim Start einen Fehler wenn nicht gesetzt)
- **Ablauf:** 7 Tage
- **Cookie-Name:** `yoga_admin_token`

### Cookie-Konfiguration (`lib/auth.ts → cookieOptions()`)

```typescript
{
  httpOnly: true,
  secure: process.env.NODE_ENV !== "development",  // HTTPS außer lokal
  sameSite: "lax",
  maxAge: 604800,  // 7 Tage
  path: "/",
}
```

### Session-Payload (`AdminSession`)

```typescript
interface AdminSession {
  userId: string;
  organizationId: string;
  clientSlug: string;
  email: string;
}
```

### Autologin (`/api/autologin`)

Externes System (z.B. BookingWulf) kann einen signierten Token erzeugen:
- Parameter: `orgId`, `ts` (Unix-Timestamp in ms), `sig` (HMAC-SHA256 Hex)
- HMAC-Eingabe: `autologin:{orgId}:{ts}`
- Key: `Organization.bookingAppKey`
- TTL: 60 Sekunden
- Comparison: `timingSafeEqual` (verhindert Timing-Angriffe)

---

## 6. API-Routen

### Öffentliche Endpunkte

| Route | Methode | Beschreibung | Rate Limit |
|-------|---------|--------------|------------|
| `/api/submit` | POST | Formular-Einreichung, speichert Inquiry + sendet E-Mails | 5 / 10 Min |
| `/api/availability` | GET | Gesperrte Daten und Events für einen Slug | 30 / Min |
| `/api/packages` | GET | Aktive Seminarpakete für einen Slug | – |
| `/api/ical/[id]` | GET | iCal-Datei (.ics) für eine Anfrage | – |
| `/api/cancel/[token]` | GET | Anfrage per Token stornieren; Redirect zu `/storniert?status=…` | – |
| `/api/autologin` | GET | HMAC-Autologin von externem System | – |
| `/api/provision` | POST | Neue Organisation anlegen (geschützt per `PROVISIONING_SECRET`) | – |

### Cron-Endpunkte

| Route | Methode | Beschreibung |
|-------|---------|--------------|
| `/api/cron/reminders` | GET | Sendet 24h-Erinnerungsmail für bestätigte Events (täglich 8:00 UTC via Vercel Cron) |

Schutz: `x-cron-secret` Header muss `CRON_SECRET` Env-Var entsprechen.

### Admin-Endpunkte (alle erfordern gültige Session)

| Route | Methode | Beschreibung |
|-------|---------|--------------|
| `/api/admin/login` | POST | Login, setzt Cookie (Rate Limit: 5 / 15 Min) |
| `/api/admin/logout` | POST | Löscht Cookie |
| `/api/admin/account` | PUT | Passwort ändern |
| `/api/admin/config` | GET / PUT | Konfiguration lesen/schreiben |
| `/api/admin/inquiries` | GET / PATCH / DELETE | Anfragen verwalten |
| `/api/admin/inquiries/[id]/participants` | GET / POST | Teilnehmer einer Anfrage |
| `/api/admin/participants/[id]` | PATCH / DELETE | Einzelnen Teilnehmer bearbeiten |
| `/api/admin/availability` | GET / POST / DELETE | Gesperrte Daten verwalten |
| `/api/admin/packages` | GET / POST / PATCH / DELETE | Seminarpakete verwalten |
| `/api/admin/invoices` | GET / POST | Angebote laden / erstellen |
| `/api/admin/invoices/[id]` | PATCH / DELETE | Angebot bearbeiten / stornieren |
| `/api/admin/invoices/[id]/html` | GET | Angebot als HTML (für PDF-Druck) |
| `/api/admin/slugs` | GET | Alle Slugs der eigenen Organisation |
| `/api/admin/switch-slug` | POST | Aktiven Client wechseln |
| `/api/admin/clients` | GET / POST / DELETE | Clients verwalten (nur Superadmin) |
| `/api/admin/orgs/[id]/clients` | GET | Clients einer Organisation (Superadmin) |

**Superadmin:** Zugriff nur wenn `session.clientSlug === SUPERADMIN_SLUG` (Standard: `"admin"`)

---

## 7. Konfigurationssystem

Jeder Client hat eine `config`-Spalte mit einem JSON-serialisierten `YogaConfig`-Objekt.

### YogaConfig-Struktur

```typescript
interface YogaConfig {
  company: {
    name: string;         // Firmenname
    tagline: string;
    logo: string;         // URL oder Base64
    email: string;
    phone: string;
    website: string;
    address: string;
    primaryColor: string; // Hex, z.B. "#4f46e5"
  };
  formTitle: string;
  formTitleFont?: string;
  formBgColor?: string;
  verpflegungOptions: string[];
  zimmerwunschOptions: string[];
  abrechnungOptions: string[];
  notifyEmail: string;
  formFields?: FormFields; // Toggles für optionale Felder
}
```

### Ladereihenfolge (`loadConfigFromDB`)

1. DB: `Client.config` für den angegebenen Slug
2. Fallback: `config/clients/{slug}.json`
3. Fallback: `config/clients/default.json`

### Theme-System (`lib/theme.ts`)

Aus `primaryColor` werden CSS Custom Properties generiert:
- `--primary`, `--primary-dark`, `--primary-tint`, `--primary-dim`
- `--btn-text` (schwarz oder weiß, basierend auf Luminanz)
- `--blocked-bg`, `--blocked-text`

---

## 8. Formular-Wizard

5-schrittiger Wizard in `components/Wizard.tsx`, State via Zustand.

| Schritt | Komponente | Felder |
|---------|-----------|--------|
| 1 | Step1Veranstaltung | Art/Titel, Datum von/bis, Uhrzeit (optional) |
| 2 | Step2Gruppe | Name, E-Mail, Personenanzahl, Leiter:innen, Telefon, Sprache |
| 3 | Step3Ausstattung | Bestuhlung, Tische, Beamer, Sound, Außenbereich, Equipment |
| 4 | Step4Verpflegung | Verpflegung (Dropdown), Zimmerwunsch (Dropdown) |
| 5 | Step5Abschluss | Rahmenprogramm, Abrechnung, Anreise, Barrierefreiheit, Budget, Quelle |

Optionale Felder werden über `FormFields` in der Konfiguration ein-/ausgeblendet.

Der aktive Slug wird per URL-Parameter `?slug=` übergeben.

---

## 9. Admin-Bereich

### Zugriffsschutz

`app/admin/(protected)/layout.tsx` liest die Session via `getSession()`. Ohne gültige Session → Redirect zu `/admin/login`.

### Seiten

| Seite | Pfad | Beschreibung |
|-------|------|--------------|
| Dashboard | `/admin` | Übersicht, Kurzlinks |
| Posteingang | `/admin/inquiries` | Anfragen mit Status-Workflow + Angebots-Panel |
| Verfügbarkeit | `/admin/availability` | Gesperrte Daten und Events im Kalender |
| Einstellungen | `/admin/config` | Firmeninfos, Farben, Formularfelder, Angebotseinstellungen |
| Vorschau | `/admin/vorschau` | Live-Vorschau des Widgets (drag-to-resize iFrame) |
| Seminarpakete | `/admin/packages` | Pakete verwalten |
| Angebote | `/admin/invoices` | Angebots-Archiv mit Filterung |
| Clients | `/admin/clients` | Superadmin: alle Organisationen verwalten |

### Status-Workflow (Inquiries)

`neu` → `in_pruefung` → `angebot_versendet` → `bestaetigt` / `abgelehnt` / `storniert`

Erlaubte Statuswerte werden serverseitig validiert. `storniert` kann auch automatisch durch den Gast via Cancel-Link gesetzt werden.

### Dark/Light Mode

- Umschaltbar über `ThemeToggle`-Button in der Sidebar (Mond/Sonne-Icon)
- Präferenz wird in `localStorage` gespeichert
- Theme wird per Inline-Script beim Laden sofort angewendet (kein FOUC)
- Alle Farben über CSS Custom Properties (`.admin-shell` / `.admin-shell[data-theme="dark"]`)

---

## 10. E-Mail-System

**Provider:** Resend (`RESEND_API_KEY`)

### Flows

**Neue Anfrage (`/api/submit`):**
1. Operator-Mail an `notifyEmail` (aus Config oder `NOTIFY_EMAIL` Env-Var)
   - Subject: `Neue Anfrage: {artTitel} – {nameGruppenleitung}`
   - ReplyTo: E-Mail des Anfragenden
   - Body: HTML-Tabelle mit allen Formulardaten
2. Bestätigungs-Mail an Anfragenden (wenn E-Mail angegeben)
   - Subject: `Anfrage bestätigt – {artTitel}`
   - Body: Zusammenfassung der Anfrage + Firmenkontaktdaten
   - Buttons: "📅 Zum Kalender hinzufügen" (`/api/ical/[id]`) + "Anfrage stornieren" (`/api/cancel/[token]`)

**24h-Erinnerung (`/api/cron/reminders`, täglich 8:00 UTC):**
- Findet alle `bestaetigt`-Anfragen, deren `datumVon` = morgen ist und `reminderSentAt` null ist
- Sendet Erinnerungsmail an `notifyEmail`
- Setzt `reminderSentAt` auf aktuellen Zeitstempel

**Stornierung durch Gast (`/api/cancel/[token]`):**
- Setzt Anfrage auf `storniert`, `cancelledAt` auf aktuellen Zeitstempel
- Sendet Admin-Benachrichtigung mit Veranstaltungsdetails
- Redirect zu `/storniert?status=ok|already|invalid`

**Absender:** `{company.name} <noreply@resend.dev>`

Alle user-kontrollierten Felder im Subject werden durch `sanitize()` von Newlines/Tabs bereinigt (verhindert Header-Injection).

---

## 11. Security

### Implementierte Maßnahmen

| Bereich | Maßnahme |
|---------|---------|
| JWT | `JWT_SECRET` Pflichtfeld, kein Fallback |
| Cookies | `httpOnly`, `secure` außer in development, `sameSite=lax` |
| HTTP Headers | CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy |
| Rate Limiting | Login: 5/15 Min; Submit: 5/10 Min; Availability: 30/Min (In-Memory, pro Instanz) |
| Input-Validierung | Pflichtfelder, E-Mail-Format, Datums-Format, Feldlängen |
| Config-Validierung | Schema-Prüfung vor DB-Write |
| Passwort | Min. 8, max. 128 Zeichen; bcrypt cost factor 12 |
| E-Mail-Injection | `sanitize()` entfernt `\r\n\t` aus Subject-Feldern |
| Autologin | `timingSafeEqual` für HMAC-Vergleich |
| SQL-Injection | Prisma ORM mit parametrisierten Queries |
| Slug-Validierung | Regex `/^[a-z0-9-]+$/` |

### Security Headers (`next.config.ts`)

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; ...
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### Offene Punkte (bewusst nicht umgesetzt)

- Rate Limiting ist In-Memory — bei mehreren Instanzen (Vercel) kein globaler Schutz. Für echtes globales Limiting: Upstash Redis.
- Kein Audit-Log für Admin-Aktionen.
- CSRF: durch `sameSite=lax` + `httpOnly` ausreichend abgedeckt für diesen Use Case.

---

## 12. Umgebungsvariablen

| Variable | Pflicht | Beschreibung |
|----------|---------|--------------|
| `JWT_SECRET` | ✅ | JWT-Signing-Secret (min. 32 Zeichen empfohlen) |
| `DATABASE_URL` | ✅ | PostgreSQL Connection String (Neon) |
| `RESEND_API_KEY` | ✅ | API-Key für Resend E-Mail-Service |
| `CRON_SECRET` | – | Schützt `/api/cron/reminders` (Header `x-cron-secret`) |
| `NOTIFY_EMAIL` | – | Fallback-Empfänger für Anfragen |
| `PROVISIONING_SECRET` | – | Secret für `/api/provision` Endpunkt |
| `SUPERADMIN_SLUG` | – | Slug des Superadmins (Standard: `"admin"`) |
| `NODE_ENV` | – | `development` / `production` (von Next.js gesetzt) |
| `SEED_EMAIL` | – | E-Mail für Seed-Script (Standard: `admin@example.com`) |
| `SEED_PASSWORD` | – | Passwort für Seed-Script (Standard: `admin123`) |

---

## 13. Deployment

### Build

```bash
npm run build   # prisma generate + next build
```

### Datenbank

```bash
npx prisma migrate deploy   # Migrationen ausführen
npm run seed                # Initialdaten
```

### Empfohlene Produktionsumgebung

- **Hosting:** Vercel
- **Datenbank:** Neon (serverless PostgreSQL)
- **E-Mail:** Resend (eigene Domain konfigurieren statt `resend.dev`)

### Hinweise

- `JWT_SECRET` muss bei jedem Deployment gesetzt sein — fehlt er, startet die App nicht.
- Die Security Headers in `next.config.ts` enthalten `unsafe-inline` und `unsafe-eval` für Scripts — bei Bedarf für strengeres CSP anpassen.
- Rate Limiting ist In-Memory und gilt pro Serverinstanz.
- Cron Jobs via `vercel.json` laufen nur auf Vercel (nicht lokal). Zum lokalen Testen Endpunkt direkt mit `x-cron-secret` Header aufrufen.

### Cron-Konfiguration (`vercel.json`)

```json
{
  "crons": [{ "path": "/api/cron/reminders", "schedule": "0 7 * * *" }]
}
```

Vercel ruft den Endpunkt täglich um 7:00 UTC auf (entspricht 8:00 MEZ / 9:00 MESZ). Der Endpunkt prüft `x-cron-secret` Header gegen `CRON_SECRET` Env-Var.
