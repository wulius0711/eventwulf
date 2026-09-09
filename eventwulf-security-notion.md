# EventWulf – Security Hardening

## Überblick

Im Rahmen eines Security-Audits wurden alle kritischen und hohen Schwachstellen in EventWulf identifiziert und behoben. Dieser Bericht dokumentiert die durchgeführten Maßnahmen.

---

## Durchgeführte Maßnahmen

### 1. Fallback-JWT-Secret entfernt

**Problem:** Der Code enthielt ein hardcodiertes Fallback-Secret (`"fallback-secret"`), das beim Fehlen der Umgebungsvariable verwendet wurde. Damit wäre es möglich gewesen, beliebige gültige JWT-Tokens zu fälschen.

**Fix:** Die App wirft beim Start jetzt einen expliziten Fehler, wenn `JWT_SECRET` nicht gesetzt ist. Kein Fallback möglich.

---

### 2. HTTP Security Headers

**Problem:** `next.config.ts` war leer — keine Security Headers.

**Fix:** Folgende Headers werden jetzt für alle Routen gesetzt:

| Header | Wert |
|--------|------|
| Content-Security-Policy | `default-src 'self'; ...` |
| Strict-Transport-Security | `max-age=63072000; includeSubDomains; preload` |
| X-Frame-Options | `DENY` |
| X-Content-Type-Options | `nosniff` |
| X-XSS-Protection | `1; mode=block` |
| Referrer-Policy | `strict-origin-when-cross-origin` |
| Permissions-Policy | `camera=(), microphone=(), geolocation=()` |

---

### 3. E-Mail-Header-Injection verhindert

**Problem:** Nutzereingaben (`artTitel`, `nameGruppenleitung`) wurden ungefiltert in E-Mail-Subjects eingebaut. Über Zeilenumbrüche (`\r\n`) hätten Angreifer zusätzliche E-Mail-Header (z.B. BCC) injizieren können.

**Fix:** Neue `sanitize()`-Funktion entfernt alle `\r`, `\n` und `\t` Zeichen aus sämtlichen user-kontrollierten Feldern vor dem E-Mail-Versand.

---

### 4. Rate Limiting

**Problem:** Keine Begrenzung von Anfragen auf öffentlichen Endpunkten — anfällig für Brute Force und Spam.

**Fix:** In-Memory Sliding-Window Rate Limiter (`lib/ratelimit.ts`) ohne externe Abhängigkeit:

| Endpunkt | Limit |
|----------|-------|
| `POST /api/admin/login` | 5 Versuche / 15 Minuten |
| `POST /api/submit` | 5 Anfragen / 10 Minuten |
| `GET /api/availability` | 30 Anfragen / Minute |

Bei Überschreitung: HTTP 429.

---

### 5. Input-Validierung

**Problem:** Öffentliche und Admin-Endpunkte akzeptierten beliebige Daten ohne Prüfung.

**Fix:** Neue `lib/validate.ts` mit Validierungsfunktionen für alle kritischen Endpunkte:

- **`/api/submit`:** Pflichtfelder (`artTitel`, `nameGruppenleitung`, `datumVon`, `datumBis`), E-Mail-Format, ISO-Datumsformat, Feldlängen
- **`/api/admin/config` PUT:** Schema-Prüfung gegen `YogaConfig`-Struktur vor DB-Write

---

### 6. Cookie `secure`-Flag korrigiert

**Problem:** Das `secure`-Flag auf Session-Cookies war nur in `NODE_ENV === "production"` aktiv. Staging- und UAT-Umgebungen sendeten Cookies über unverschlüsseltes HTTP.

**Fix:** Cookie-Konfiguration in `cookieOptions()` zentralisiert (`lib/auth.ts`). `secure` ist jetzt in allen Umgebungen außer `development` aktiv. Login, Switch-Slug und Autologin nutzen alle dieselbe Funktion.

---

### 7. Passwort-Mindestlänge

**Problem:** Bei Passwort-Änderung und Neuanlage von Accounts gab es keine Validierung der Passwort-Stärke.

**Fix:** `validatePassword()` erzwingt min. 8 und max. 128 Zeichen. Gilt für:
- Passwort-Änderung im Admin-Account
- Anlage neuer Clients/Organisationen (Superadmin)

---

## Geänderte Dateien

| Datei | Änderung |
|-------|----------|
| `lib/auth.ts` | Fallback-Secret entfernt; `cookieOptions()` hinzugefügt |
| `lib/ratelimit.ts` | **Neu** – In-Memory Rate Limiter |
| `lib/validate.ts` | **Neu** – Validierungsfunktionen |
| `next.config.ts` | Security Headers für alle Routen |
| `app/api/submit/route.ts` | Rate Limit + Input-Validierung + `sanitize()` |
| `app/api/admin/login/route.ts` | Rate Limit + `cookieOptions()` |
| `app/api/admin/switch-slug/route.ts` | `cookieOptions()` |
| `app/api/admin/account/route.ts` | Passwort-Validierung |
| `app/api/admin/clients/route.ts` | Passwort-Validierung |
| `app/api/admin/config/route.ts` | Config-Schema-Validierung |
| `app/api/autologin/route.ts` | `cookieOptions()` |
| `app/api/availability/route.ts` | Rate Limit |

---

## Bewusst nicht umgesetzt

| Punkt | Begründung |
|-------|-----------|
| Globales Rate Limiting | In-Memory reicht als erste Schutzschicht; für Multi-Instanz-Schutz wäre Upstash Redis nötig |
| CSRF-Tokens | Durch `sameSite=lax` + `httpOnly` Cookies ausreichend abgedeckt |
| Audit-Log | Nice-to-have, kein akutes Sicherheitsrisiko |

---

## Nachtrag — September 2026 (Räume-Feature-Review)

Fokussierter Security-Review über den Diff der Räume-Feature-Session (nicht die gesamte Codebasis) — Vorgehen: Identifikations-Agent findet Kandidaten, je ein zweiter Agent verifiziert unabhängig gegen den echten Code inkl. Confidence-Score, nur Funde ≥8/10 übernommen.

### 8. Cross-Tenant IDOR bei eventId/roomId in `/api/submit`

**Problem:** Die öffentliche Anfrage-Route löste `body.eventId`/`body.roomId` per `findUnique`/`findFirst` ohne `clientId`-Filter auf. Der `clientId` der erzeugten Anfrage kam ausschließlich aus `body.slug` — unabhängig davon, welchem Mandanten das referenzierte Event/der Raum tatsächlich gehörte. Raum- und Event-IDs sind über öffentliche Endpunkte (`/api/rooms?slug=`, sowie länger schon für Events) pro Mandant einsehbar.

**Exploit:** Eine Anfrage an Mandant A mit der `roomId`/`eventId` von Mandant B führte dazu, dass Mandant B eine Anfrage mit dem Namen seines eigenen Raums/Events bekam, der Raum für den Zeitraum fälschlich als belegt markiert wurde, und die Paket-Freischaltung (Räume ab Pro) umgangen werden konnte (auch Mandanten im Basis-Paket konnten so Buchungen gegen fremde Räume auslösen).

**Fix:** Der anfragende Client wird jetzt einmal zu Beginn der Route aus dem `slug` aufgelöst; Event- und Raum-Lookup sind zwingend auf dessen `clientId` gescoped (`findFirst` statt `findUnique`). Verifiziert mit zwei realen Cross-Tenant-Exploit-Versuchen gegen frisch angelegte Testmandanten (beide korrekt `400`, legitime Same-Tenant-Buchungen weiterhin `200`).

**Geprüft, kein Fund:** Ein zweiter Kandidat (Räume bleiben nach einem Paket-Downgrade weiter über das eigene Widget des Kunden buchbar) wurde als reine Abrechnungs-/Entitlement-Frage eingestuft, keine Sicherheitslücke — es gibt keinen Zugriff auf fremde Mandantendaten, nur auf zuvor selbst konfigurierte eigene Inhalte (Confidence 2/10, verworfen).

**Bekannte Einschränkung:** Dieser Review deckte nur den Diff dieser Session ab. Ein vollständiger Codebase-Audit (analog zum ursprünglichen Security-Hardening-Audit oben) steht für die restliche, ältere Codebasis noch aus.

---

## Nachtrag — Launch-Readiness-Audit (September 2026), Phase 1

Der oben erwähnte vollständige Codebase-Audit wurde als 3-Durchgänge-Review über die gesamte Codebasis durchgeführt (Track A: Multi-Tenancy, Concurrency, Business Logic, Auth, Input-Validierung, Dependencies, E-Mail, Cron, Config, Frontend, Deploy, Tests, Edge Cases) und ergab 12 Launch-Blocker plus Medium-/Low-Funde. Umsetzung erfolgt phasenweise; hier der Stand von Phase 1.

### Block A: Next.js/sharp-CVEs — erledigt

**Problem:** `next@16.2.4` enthielt zwei unauthenticated-RCE-Advisories und eine kritische DoS-Advisory; `sharp@0.34.4` enthielt bekannte libvips/libheif-CVEs auf dem Bild-Upload-Pfad (Räume/Events-Admin-Upload).

**Fix:** Update auf `next@16.3.4` und `sharp@0.35.4` (gezielt minimale Patch-Version statt `latest`, um die Blast Radius klein zu halten). `npm audit`: critical 1→0, high 13→10 — die verbleibenden 10 High betreffen ausschließlich andere, nicht in dieser Phase behandelte Pakete (Prisma-Ökosystem, tiptap, browserslist, hono, js-yaml, mysql2, brace-expansion, fast-uri), keiner davon next/sharp. Verifiziert mit vollem Playwright-Smoke-Test (Login, Räume-CRUD inkl. Bild-Upload mit WebP-Magic-Byte-Prüfung, kompletter Gäste-Buchungsassistent inkl. Räume-Buchungsflow).

### Fund 9: Gast erhielt 500 trotz erfolgreich gespeicherter Anfrage — erledigt

**Problem:** In `/api/submit` hing die Erfolgsantwort an den Gast am Erfolg des E-Mail-Versands (Betreiber-Benachrichtigung). Schlug nur die interne Betreiber-Mail fehl, bekam der Gast einen 500er, obwohl seine Anfrage bereits in der DB gespeichert war — mit dem Risiko doppelter Anfragen durch erneutes Absenden.

**Fix:** Beide E-Mail-Sends (Betreiber + Gast-Bestätigung) laufen jetzt außerhalb des kritischen Pfads; Fehler werden mit `inquiryId` geloggt statt geworfen. Die Betreiber-Mail bekommt vor dem Loggen einen einmaligen Retry, da sie der einzige Kanal ist, über den der Betreiber überhaupt von der Anfrage erfährt. Reproduziert (ungültiger Resend-Key → 500 trotz gespeicherter Anfrage) und nach Fix verifiziert (200, Fehler korrekt geloggt) — zusätzlich live im Smoke-Test bestätigt, als Resends Sandbox-Regel die Gast-Bestätigung an eine `example.com`-Testadresse ablehnte: Betreiber-Mail ging raus, Submit blieb trotzdem bei 200.

---

## Bereits korrekt implementiert (vor dem Audit)

- HMAC-Autologin mit `timingSafeEqual` (verhindert Timing-Angriffe)
- Prisma ORM — kein Risiko für SQL-Injection
- Slug-Sanitierung mit Regex `/^[a-z0-9-]+$/`
- bcryptjs mit cost factor 12
- Status-Wert-Validierung im Inquiries-Endpunkt
