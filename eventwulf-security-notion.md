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

## Nachtrag — Launch-Readiness-Audit (September 2026), Phase 2

Fund 10 („keine automatisierte Testabdeckung im Repo, insbesondere kein Regressionstest für den bereits real ausgenutzten Cross-Tenant-IDOR und keiner für die Advisory-Lock-Race-Condition") — Mindest-Sicherheitsnetz für die zwei Stellen, an denen der als nächstes geplante Block B (Nebenläufigkeit) am ehesten stille Regressionen einbaut.

**Infrastruktur:** `@playwright/test` als echte Dependency, `playwright.config.ts` mit `webServer` gegen einen dedizierten Neon-Test-Branch (kein Zugriff auf Dev-/Produktions-DB), bewusst ungültigem `RESEND_API_KEY` (sicher dank Fund-9-Fix oben) und einem Test-Env-Bypass für den Rate-Limiter in `lib/ratelimit.ts` — verifiziert per Gegen-Check, dass das produktive Rate-Limiting (5 Requests/10min) außerhalb der Tests unverändert bleibt.

**Automatisiert abgesichert:**
- **Cross-Tenant-IDOR** (`__tests__/security/cross-tenant-idor.spec.ts`): Raum- und Event-Fall separat, je mit Positivfall-Gegenprobe.
- **Advisory-Lock-Race-Condition** (`__tests__/concurrency/room-advisory-lock.spec.ts`): echte parallele Requests (2er- und 5er-Fall) auf denselben Raum/Zeitraum — genau einer erfolgreich, Rest `409`, kein `500`, kein stiller Doppel-Erfolg. Flakiness-Kontrolle über 10 Läufe: 0 geflackerte Assertions.

**Offen:** Die systematische IDOR-Prüfung aller ID-basierten Endpunkte (Audit Abschnitt 1, über den bereits gefundenen `/api/submit`-Fall hinaus) sowie ein Test für Fund 3 (Event-Kapazitäts-Leak bei Vercel-Timeout) stehen weiterhin aus — beide bewusst nicht Teil dieser Phase.

---

## Zusätzlicher Fund (September 2026, während Block B) — Cron-Endpunkte ohne funktionierende Authentifizierung

Kein Teil der ursprünglichen 12 Audit-Findings, sondern entdeckt bei der Frage, ob Fund 4 in Produktion überhaupt wirksam werden kann — deshalb hier separat dokumentiert statt rückwirkend in Fund 4 verschmolzen: es sind zwei unabhängige Probleme (Race Condition beim Status-Übergang **und** ein kaputter Auth-Mechanismus, der den Cron überhaupt erst zum Laufen bringen muss).

**Problem:** Alle drei Cron-Routen (`event-holds`, `room-holds`, `reminders`) prüften einen selbst erfundenen `x-cron-secret`-Header. Vercels tatsächlicher Cron-Trigger sendet laut offizieller Doku aber `Authorization: Bearer <CRON_SECRET>` — einen Header, den der Code nie gelesen hat. `CRON_SECRET` ist in der Vercel-Produktionsumgebung seit 130 Tagen korrekt gesetzt (verifiziert per `vercel env ls`), das war also nicht die Ursache. Ergebnis: jeder echte, geplante Cron-Aufruf bekam `401` und lief nie durch — unabhängig von Fund 4, seit die Endpunkte existieren. Damit war effektiv auch der ursprüngliche Track-B-Punkt aus Abschnitt 12 des Audits („sind `CRON_SECRET`/`BUNNY_*` in Produktion tatsächlich gesetzt?") beantwortet, aber mit einem gravierenderen Folgefund: gesetzt zu sein reichte nicht, weil der Header-Name nicht passte.

**Fix:** Neuer gemeinsamer Helper `lib/cronAuth.ts` (`isAuthorizedCronRequest`), der den `Authorization: Bearer`-Header korrekt liest und per `timingSafeEqual` vergleicht (gleiches Muster wie der bestehende HMAC-Check in `app/api/autologin/route.ts`). In allen drei Cron-Routen eingesetzt. Regressionstests ergänzt, die explizit den alten `x-cron-secret`-Header senden und `401` erwarten — dokumentiert, dass der alte Mechanismus bewusst nicht mehr greift, nicht nur zufällig durch Auslassung nicht mehr existiert.

---

## Nachtrag — Launch-Readiness-Audit (September 2026), Block B (Nebenläufigkeit)

Fund 3, 4, 5 — gemeinsamer Nenner: ein Zustandsübergang, der sich auf einen zuvor gelesenen Wert verlässt, ohne beim Schreiben erneut zu prüfen, ob sich der Wert zwischenzeitlich geändert hat. Fix-Prinzip durchgehend: atomare bedingte Schreiboperation statt Read-then-Write.

**Fund 3 (Event-Kapazitäts-Leak bei Timeout) — erledigt.** `reserveEventCapacity` war bereits eine atomare bedingte UPDATE-Query, lief aber als eigenständiger Aufruf getrennt von der `Inquiry`-Speicher-Transaktion — ein Absturz dazwischen ließ `bookedCount` dauerhaft erhöht ohne zugehörige Anfrage zurück. Jetzt Teil derselben Transaktion; drei zuvor nötige manuelle Kompensationsaufrufe in `/api/submit` entfernt (eine vierte Stelle war bereits unerreichbarer Dead Code, per Kontrollfluss-Beweis verifiziert). Neuer Test `__tests__/concurrency/event-capacity.spec.ts`, inkl. echtem Rollback-Beweis (Kapazität reserviert, danach Raum-Konflikt in derselben Transaktion → Kapazität korrekt zurückgerollt).

**Fund 4 (Cron überschreibt bestätigte Buchung) — erledigt.** `event-holds`-Cron nutzt jetzt eine einzelne `UPDATE ... RETURNING`, gebündelt mit der Kapazitätsfreigabe in einer Transaktion; `room-holds` vereinfacht auf ein bedingtes `updateMany`. Idempotenz bei doppeltem Cron-Lauf explizit getestet, nicht nur unterstellt. Test: `__tests__/concurrency/cron-status-race.spec.ts`.

**Fund 5 (kein Konfliktschutz bei Multi-Admin-Bearbeitung) — erledigt.** `Inquiry.updatedAt` ergänzt (Migration, Backfill aus `createdAt`). Zwei unabhängige Schreibstellen abgesichert: der PATCH-Handler in `/api/admin/inquiries` und — als eigenständiger Fund während der Umsetzung entdeckt — der POST-Handler in `/api/admin/invoices`, der denselben ungeschützten Read-then-Write-Fehler hatte. Beide gaten ihre Event-Kapazitäts-Logik jetzt hinter demselben `updatedAt`-Guard in einer Transaktion. Test: `__tests__/concurrency/inquiry-conflict.spec.ts`, inkl. zweier echter Parallelitäts-Tests (PATCH und Invoice-POST), beide vor dem jeweiligen Fix nachweislich rot (Kapazität hätte sich verdoppelt: 12 statt 6, zwei statt ein `Invoice`-Datensatz).

**Zusätzlicher Fund (kein Teil der ursprünglichen 12 Audit-Findings, keine Nebenläufigkeitsfrage — bewusst getrennt von Fund 5 dokumentiert):** Ein Angebot für eine Anfrage zu erstellen, die nicht bereits in einem gehaltenen Status war (z.B. eine zuvor abgelehnte), setzte den Status auf `angebot_versendet` — selbst ein gehaltener Status — ohne dafür Kapazität zu reservieren. Reproduzierbar mit einem einzigen Klick, keine Nebenläufigkeit nötig. Produktentscheidung dazu bewusst getroffen: Angebotserstellung bleibt für jeden Status möglich (keine neue UI-Sperre, passt zur bestehenden Philosophie der frei wählbaren Status-Buttons), Kapazität ist der alleinige Schutzmechanismus, mit klarer Ablehnung bei zu wenig Kapazität. Fix im selben Commit wie Fund 5, da derselbe Codepfad.

**Offen, nicht blockierend:**
- Migration für `Inquiry.updatedAt` bisher nur gegen den Neon-Test-Branch angewendet — muss vor dem nächsten `vercel --prod` manuell gegen Produktion laufen (Fund 11 [Migration-vor-Deploy-Prozess] ist noch offen, kein automatischer Prozess dafür).
- Rechnungsnummern-Zähler (`nextInvoiceNumber()`) läuft in einer eigenen, bereits committeten Transaktion vor der äußeren Invoice-Transaktion — bei einem `409`-Konflikt bleibt die verbrauchte Nummer als Lücke stehen. Kein Doppelvergabe-Risiko, rechtlich i.d.R. unproblematisch (Lücken durch fehlgeschlagene Vorgänge sind normal), aber vorgemerkt für einen späteren Blick.

---

## Nachtrag — Launch-Readiness-Audit (September 2026), Block C (fehlende serverseitige Validierung)

Fund 6, 7 — gemeinsamer Nenner: eine clientseitige Prüfung wurde nie durch eine serverseitige Gegenprüfung abgesichert. Anders als Block B kein Nebenläufigkeitsthema.

**Fund 6 (Raumkapazität nicht serverseitig durchgesetzt) — erledigt.** `/api/submit` prüfte `room.capacity` gar nicht — nur ein nicht-blockierender Hinweis im Gäste-Formular. Produktentscheidung bewusst getroffen: Hard-Block, konsistent mit der bereits bestehenden serverseitigen Durchsetzung von Event-Kapazität; die Doku-Aussage „kein Hard-Block, nur Hinweis" bezog sich nachweislich nur auf die Frontend-UX, nicht auf serverseitiges Verhalten. Check sitzt als reiner, nicht-race-anfälliger Read direkt bei der bestehenden `room.isActive`-Prüfung, keine Transaktion nötig. `capacity: null` bleibt unbegrenzt. Test: `__tests__/validation/room-capacity.spec.ts`.

**Fund 7 (negative Teilnehmerzahlen) — erledigt, in zwei unabhängigen Commits.** `personenAnzahl` wurde vor jeder Validierung mit `parseInt()` geparst, was nicht-ganzzahlige Eingaben stillschweigend abgeschnitten hätte (`parseInt("1.5") === 1`) — neue Validierung (`lib/validate.ts`) prüft den Rohwert. Zweiter, unabhängiger Fund beim Verifizieren der Audit-Beschreibung: `participantCount` fließt entgegen der ursprünglichen Audit-Annahme nicht direkt in Rechnungspositionen — es befüllt nur ein clientseitig frei überschreibbares Formularfeld. Die eigentliche Lücke war größer: `app/api/admin/invoices` validierte `lineItems` serverseitig überhaupt nicht (weder `quantity` noch `unitPrice`). Beide Stellen jetzt abgesichert. Tests: `__tests__/validation/participant-count.spec.ts`, `__tests__/validation/invoice-line-items.spec.ts`.

(Block D und Fund 11 waren zu diesem Zeitpunkt noch offen — vollständiger Abschluss des Critical/High-Tracks siehe Zusammenfassung am Ende dieses Dokuments.)

---

## Bereits korrekt implementiert (vor dem Audit)

- HMAC-Autologin mit `timingSafeEqual` (verhindert Timing-Angriffe)
- Prisma ORM — kein Risiko für SQL-Injection
- Slug-Sanitierung mit Regex `/^[a-z0-9-]+$/`
- bcryptjs mit cost factor 12
- Status-Wert-Validierung im Inquiries-Endpunkt

---

## Abschluss — kompletter Critical/High-Track (Launch-Readiness-Audit, September 2026)

Alle 12 ursprünglichen Critical/High-Launch-Blocker aus dem Audit-Bericht sowie 2 während der Umsetzung zusätzlich gefundene Findings sind bearbeitet. Einmal an einer Stelle nachschlagbar, statt durch die einzelnen Block-Vermerke oben blättern zu müssen:

| Finding | Commit(s) |
|---|---|
| Block A — Next.js/sharp-CVEs (deckte mehrere der 12 Original-Punkte ab, als ein Dependency-Fix zusammengefasst) | `5fe2088` |
| Fund 9 — Gast erhielt 500 trotz erfolgreich gespeicherter Anfrage | `e31b712` |
| Fund 10 — keine automatisierte Testabdeckung (Infrastruktur + Cross-Tenant-IDOR-Test + Advisory-Lock-Race-Test) | `433e9a8`, `75c74cd`, `7e244aa` |
| Fund 3 — Event-Kapazitäts-Leak bei Timeout | `1198731` |
| Fund 4 — Cron überschreibt bestätigte Buchung | `5cfff39` |
| Fund 5 — kein Konfliktschutz bei Multi-Admin-Bearbeitung | `f54ef22` |
| Fund 6 — Raumkapazität serverseitig durchgesetzt | `8944e9c` |
| Fund 7 — negative Teilnehmerzahlen (Eingabe + Rechnungs-Line-Items, zwei Commits) | `4530e97`, `e6b09d1` |
| Fund 8 — Config-Fallback-System + Injection-Lücken | `6d1104a` |
| Fund 11 — Migration-vor-Deploy erzwungen | `c970913` |
| Zusatzfund — Cron-Endpunkte ohne funktionierende Authentifizierung (Auth-Header-Mismatch, nicht Teil der 12 Original-Findings) | `9d9f50a` |
| Zusatzfund — fehlende Kapazitätsreservierung bei Angebots-Erstellung für nicht gehaltene Anfragen (nicht Teil der 12 Original-Findings, im selben Commit wie Fund 5) | `f54ef22` |

**Wiederkehrendes Muster, selbst eine Erkenntnis für den nächsten Audit-Durchlauf:** In praktisch jedem Block hat die eigene Verifikation gegen den tatsächlichen Code vor dem Schreiben des Fixes etwas Größeres oder Zusätzliches offengelegt, als die ursprüngliche Audit-Beschreibung nahelegte — nie kleiner. Beispiele: der tote Kompensationscode in B1, die zweite ungeschützte Schreibstelle in B3, die von 2 auf ~15 Felder gewachsene Escaping-Lücke in Fund 8, die falsche `vercel-build`-Annahme bei Fund 11, der Cron-Auth-Fund selbst. Für künftige Audits heißt das: Findings-Beschreibungen sind ein guter Ausgangspunkt, aber der tatsächliche Umsetzungsumfang war in dieser Session durchgehend größer als die erste Beschreibung — entsprechend Puffer einplanen, nicht die Erstschätzung als Obergrenze behandeln.

**Bewusst offen, nicht Teil dieser Code-Session:**
- Die 11 Medium-Findings ("vor Launch empfohlen") aus dem Audit — noch nicht priorisiert oder begonnen.
- Die Low/Info-Liste aus dem Audit.
- Track B (Rechtliches, Betrieb/Monitoring) — nie Teil dieser Code-Session, weiterhin unbeantwortet.
- Konkret vorgemerkte Einzelfunde aus dieser Session:
  - `app/api/cron/reminders/route.ts` hat dasselbe unescaped-Interpolations-Muster für gastseitig übermittelte Werte wie der ursprüngliche Fund-8-Teil in `invoiceTemplate.ts` — andere Datei, anderer Ausgabekanal (E-Mail statt servierte Webseite), bewusst nicht mitgezogen.
  - Rechnungsnummern-Lücke bei einem `409`-Konflikt in der Angebots-Erstellung (kein Doppelvergabe-Risiko, nur eine Nummerierungslücke) — aus B3.
  - Die systematische IDOR-Prüfung aller ID-basierten Endpunkte (Audit Abschnitt 1) über den bereits gefundenen `/api/submit`-Fall hinaus — aus Fund 10/Phase 2.
  - Migrationshistorie-Lücke: `prisma/migrations/20260824084901_init_events_feature/migration.sql` löscht `Inquiry_packageId_fkey` und die `Package`-Tabelle, aber keine Migration in der Historie legt diese je an (vermutlich per `db push` vor konsequentem Migration-Tracking entstanden). Kein Risiko für den normalen `migrate deploy`-Ablauf (überspringt bereits angewendete Migrationen anhand der `_prisma_migrations`-Tabelle), aber `migrate deploy`/`migrate dev` würde beim Aufbau einer wirklich leeren DB aus der vollen Historie an dieser Stelle scheitern (leerer Shadow-DB-Replay reproduziert den Fehler zuverlässig). Gehört inhaltlich zum bestehenden Track-B-Punkt „Datenbank-Backups mit getesteter Restore-Prozedur" (Disaster-Recovery und „neue Umgebung aus der Historie provisionieren" sind derselbe Testfall) — dort mit aufgreifen, nicht als eigenständiges Item. Entdeckt bei Durchgang 2, Teil 7.
  - `cron-status-race.spec.ts:53` (Fund 4) hat eine strukturelle Restfragilität: selbst ohne jede Code-Änderung am Cron-Pfad liegt die Fehlrate bei ca. 17 % (2/12, isoliert per A/B-Test bestätigt) allein durch die aggregierte Nebenläufigkeit der mit Durchgang 2 gewachsenen Testsuite — nicht durch einen der drei Durchgang-2-Fixes verursacht (per Ausschlussbeweis bestätigt: Cleanup-Piggyback komplett aus `event-holds` entfernt ergab dieselbe Rate wie mit Cleanup danach). Der Test selbst müsste robuster gegen aggregierte Suite-Last werden (großzügigeres Zeitfenster oder ein direkterer Mechanismus statt zeitbasiertem Timing) — kein Blocker für laufende Durchgänge, aber ein eigener kleiner Task wert, bevor die Suite weiter wächst.

## Medium-Durchgang 1 abgeschlossen — Löschungen & Cron-Robustheit (Punkte 1–4)

Umfang: Die ersten vier von elf Medium-Findings aus dem Launch-Readiness-Audit. Alle vier zeigten sich beim Umsetzen konkreter oder anders als die ursprüngliche Kurzfassung im Bericht — Details unten.

**Punkt 1 — Doppelte Kapazitätsfreigabe bei zeitgleichem Storno+Cron** (Commit: `ed54c52`)
Ursprünglich als vermutlich bereits durch Fund 4/5 abgesichert eingestuft — größtenteils bestätigt, aber mit einer schmalen Restlücke: der PATCH-Handler las `inquiry.status` per `findFirst` außerhalb der Transaktion, bevor der `updatedAt`-Guard griff. Ein Cron-Commit in diesem schmalen Fenster (zwischen `findFirst` und Transaktionsstart) hätte trotz Guard eine veraltete `wasHeld`-Annahme durchrutschen lassen können. Gehärtet mit `SELECT ... FOR UPDATE` als erstem Schritt innerhalb der Transaktion — sperrt die Zeile, statt sich auf einen Pre-Transaktions-Snapshot zu verlassen. Empirisch bestätigt, dass Cron-SQL `updatedAt` nie berührt (`@updatedAt` ist reines Prisma-Client-Feature, kein DB-Trigger), bevor der Fix geschrieben wurde.

**Punkt 2 — Cron-Schleife nicht transaktional** (Commit: `70494dc`)
Bestätigt als echter, bereits in Produktion befindlicher Bug in Fund-4-Code: ein inneres try/catch verschluckte Fehler bei `releaseEventCapacity` pro Zeile, während die äußere Transaktion trotzdem committete — Status konnte auf „abgelaufen" wechseln, während `bookedCount` fälschlich hoch blieb. Gefixt durch eine eigene kleine Transaktion pro Zeile statt einer gemeinsamen für die ganze Schleife (verhindert, dass eine kaputte Zeile den gesamten Cron-Lauf für alle anderen Kunden blockiert). `releaseEventCapacity` signalisiert jetzt Erfolg/Misserfolg (boolean) statt `void` zurückzugeben — Voraussetzung dafür, dass der Fix überhaupt greifen kann. Nebenfund: Schema-Drift zwischen `schema.prisma` und der tatsächlichen Migration (`onDelete: SetNull` fehlte im Schema-File), korrigiert im selben Commit.

**Punkt 3 — Raum-Löschung während laufendem Gast-Submit** (Commit: `9964e19`)
Bestätigt: Foreign-Key-Verletzung (P2003) führte zu unbehandeltem 500. Gezielt auf `e.code === "P2003"` abgefangen, 409 mit gästefreundlicher Meldung, andere Fehler an derselben Stelle weiterhin unverändert als 500 behandelt. Getestet über einen echten `Promise.all()`-Race (nicht nur sequenziell — der bestehende Pre-Check hätte einen rein sequenziellen Testfall immer schon vor der Transaktion abgefangen, der eigentliche Fehlerpfad wäre so nie getestet worden).

**Punkt 4 — Raum-Löschung ohne Warnung über Event-Blockierverhalten** (Commit: `6c16e4a`)
Bestätigt: die DELETE-Route für Räume kannte zugeordnete Events vorher überhaupt nicht (kein bestehender count) — `onDelete: SetNull` lief rein auf DB-Ebene, unbemerkt vom Handler. Route zählt jetzt aktive zugeordnete Events vor dem Löschen; bei mindestens einem wird 409 mit der echten Zahl zurückgegeben, Admin-UI zeigt einen zweiten Bestätigungsdialog mit dieser Zahl, bevor mit `confirmed: true` erneut gelöscht wird. Inaktive Events zählen bewusst nicht mit (konsistent mit dem `isActive`-Gate in `/api/rooms`/`/api/availability`).

**Offene Punkte, für später vorgemerkt (nicht Teil dieses Durchgangs):**
- DELETE-Handler in `app/api/admin/inquiries/route.ts` hat dasselbe Grundmuster wie das ursprüngliche Punkt-1-Problem (Status außerhalb jeder Transaktion gelesen, kein `updatedAt`-Guard) — gefunden bei Punkt 1, nicht mitgefixt.
- `app/api/cron/reminders/route.ts` hat denselben unescaped-Interpolationsfehler wie der ursprüngliche `invoiceTemplate.ts`-Fund aus Block D, anderer Ausgabekanal (E-Mail statt servierte Seite) — gefunden bei Fund 8, nicht mitgefixt.

Nächster Schritt: Durchgang 2 (Auth- & Mandanten-Hygiene — Medium-Punkte 7, 8, 9).
