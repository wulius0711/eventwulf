# Events-Feature: Entwicklerplan

Umbau von "Pakete" (reine Preisvorlage) zu "Events" (terminierte, buchbare Hotel-Angebote mit Kapazität). Konzeptiert 2026-08-23.

## 1. Datenmodell / Migration

- [x] Neues `Event`-Modell in `prisma/schema.prisma`: `name`, `description`, `image`, `startDate`, `endDate`, `pricePerPerson`, `minParticipants`, `maxParticipants` (nullable = unbegrenzt), `bookedCount`, `isActive`, `sortOrder`, `color`, `intern` (bool). DB-CHECK-Constraints für Kapazitätsinvarianten ergänzt.
- [x] `Inquiry.eventId` als echte Relation auf `Event` ergänzt (ersetzt die heutige Datums-Overlap-Heuristik in `inquiries/route.ts` — Anpassung der Route folgt in Abschnitt 2)
- [x] Package-Datensatz gelöscht (nur einer vorhanden, keine Live-Kunden, keine Datenmigration nötig). Package-Modell im Zuge der Schema-Migration aus `schema.prisma` entfernt (inkl. `Inquiry.packageId`/`package`-Relation).
- [x] Bestehende `BlockedDate`-Einträge mit `type: "event"` ins neue `Event`-Modell überführt (3 echte Einträge in Prod gefunden und per Migration übernommen, `intern: true` gesetzt um heutiges Verhalten nicht rückwirkend zu ändern)
- [x] `BlockedDate` bereinigt — bleibt nur noch für reine Sperrzeiten (`type`/`color`/`maxCapacity`/`bookedCount` entfernt)
- [x] Prisma-Migration geschrieben, gegen Neon-Dev-Branch getestet (inkl. Race-Condition-Test der Kapazitätslogik und Datenmigrations-Verifikation)
- [ ] Migration gegen Produktions-DB — vorher Backup

## 2. Backend / API

- [x] Event-CRUD (`/api/admin/events`: GET/POST/PATCH/DELETE)
- [x] Öffentlicher Event-Endpunkt (`/api/events?slug=...`) — nur aktive, zukünftige Events, chronologisch sortiert
- [x] Atomare Kapazitätsreservierung (Conditional Update statt Transaktion/Versionsfeld) beim Absenden einer Event-Anfrage — gegen Überbuchung end-to-end getestet
- [x] Validierung: Personenanzahl gegen `minParticipants`/`maxParticipants` **und** freie Plätze
- [x] Freigabe reservierter Plätze bei Stornierung (bestehender Cancel-Token-Flow) und bei Ablehnung im Admin — symmetrische held/nicht-held-Logik in `lib/eventCapacity.ts`
- [x] Ablauf-Frist für unbeantwortete Reservierungen: Cronjob `/api/cron/event-holds` (48h, eigenes `holdExpiresAt`-Feld). **Offen für Rollout:** `CRON_SECRET` muss in Vercel gesetzt und ein externer Scheduler dafür eingerichtet werden (wie beim bestehenden `/api/cron/reminders`).
- [ ] `isBlocked()`-Bug fixen: künftig sperren nur `type: "blocked"` **und** `Event.intern === true` (verschoben auf Abschnitt 6 — Calendar.tsx bleibt bis dahin bewusst unverändert, `/api/availability` liefert bereits abwärtskompatibel)
- [x] `/api/availability` um Event-Daten (inkl. `intern`) erweitert — bewusst abwärtskompatibles Format, damit der Live-Kalender bis Abschnitt 6 unverändert weiterläuft

## 3. Bunny.net Bild-Upload

- [x] Storage-Zone (`eventwulf-events`, Frankfurt) + Access Key bereitgestellt, Pull Zone `eventwulf-zone.b-cdn.net` verbunden
- [x] Admin-Upload-Endpunkt (`/api/admin/events/upload`, PUT an Bunny Storage API, kein SDK) — JPEG/PNG/WebP, max. 5MB
- [x] CSP in `next.config.ts` um Bunny-CDN-Domain im `img-src` erweitert (Widget + Admin)
- [x] Env Vars gesetzt (`BUNNY_STORAGE_ZONE`, `BUNNY_STORAGE_KEY`, `BUNNY_CDN_HOST`) in `.env.local`. **Offen für Rollout:** dieselben Vars müssen noch in Vercel gesetzt werden.

Gegen die echte Bunny-API end-to-end verifiziert: Upload (201), öffentlicher CDN-Abruf (200, korrekter Content-Type), Löschen (200).

## 4. Admin-UI

- [x] Neuer eigener Event-Editor (`EventsEditor.tsx` + `/admin/events`) statt Zusammenführung — `PackagesEditor` war schon in Phase 2 entfernt worden, `AvailabilityEditor` bleibt jetzt bewusst nur noch für reine Sperrzeiten (kein Tab mehr)
- [x] Formularfelder: Name, Beschreibung, Bild-Upload, Zeitraum, Preis, Min/Max, Farbe, Intern/Extern-Toggle, Aktiv
- [x] Liste gruppieren: Bevorstehend (Standard sichtbar) / Vergangen (einklappbar)
- [x] Status-Badges (Aktiv / Ausgebucht / Vergangen / Inaktiv) im Stil von `InquiryInbox`
- [x] "Duplizieren"-Aktion pro Event (für wiederkehrende Retreats)
- [x] Teilnehmerliste pro Event (Expand-Zeile, wiederverwendet `/api/admin/inquiries`, clientseitig nach `eventId` gefiltert)
- [x] `/admin/packages`-Seite entfernt (Phase 2), `AdminNav.tsx` um "Events" ergänzt

API-seitig end-to-end mit signiertem Test-Token gegen den Dev-Branch verifiziert (Create/Update/Delete, Min>Max-Validierung, Max<bookedCount-Schutz). **Visuelle UI-Prüfung im Browser noch offen** — kein Browser-Tool in dieser Session verfügbar, bitte einmal manuell durchklicken.

## 5. Frontend — neuer Events-Embed

- [ ] Neue Route `/events` (eigener Embed-Code, analog zu `page.tsx`, gleiche Theming-Logik über `config`)
- [ ] Card-Grid: `repeat(auto-fill, minmax(320px, 1fr))`
- [ ] Card: Bild oben (fix), Name, Zeitraum, Preis, Kapazitätsbalken, Ausgebucht-Zustand (gedimmt, kein Button)
- [ ] Accordion-Expand: Beschreibung + Buchungsformular inline; Resize-Trigger erst **nach** Abschluss der Aufklapp-Animation (IframeResizer)
- [ ] Kompaktes Buchungsformular: Name, E-Mail, Personenanzahl (Live-Validierung gegen freie Plätze/Min/Max)
- [ ] Leerer Zustand: "Aktuell sind keine Events geplant"
- [ ] Bestätigungsmail-Template für Event-Buchungen (Event-Name, Zeitraum, Storno-Link)

## 6. Bestehendes Formular / Kalender

- [ ] `Calendar.tsx`: extern-Events nur als Info-Banner, intern-Events sperren wie Sperrzeiten
- [ ] Begriffstrennung im UI konsequent: "Event" (Hotel-Termin) vs. "Veranstaltung" (Gruppen-Anfrage)

## 7. Testing

- [ ] Lokaler Build + manueller Test gegen localhost vor Deploy
- [ ] Race-Condition-Test: gleichzeitige Buchungen auf letzte Plätze
- [ ] Min/Max-Validierung testen
- [ ] Storno-Flow testen (Platz wird korrekt wieder frei)
- [ ] Ablauf-Frist-Mechanismus testen
- [ ] Schmale iFrame-Breite testen (1-spaltiges Grid, Accordion-Verhalten, Resize)
- [ ] E-Mail-Versand testen (Bestätigung, Storno, Betreiber-Benachrichtigung)

## 8. Rollout

- [ ] Produktions-Migration mit vorherigem Backup
- [ ] Deploy via `vercel --prod` (kein Auto-Deploy)
- [ ] Neuen Embed-Code an Hotels kommunizieren
- [ ] `eventwulf-handbuch.md` aktualisieren (Abschnitt 7 "Seminarpakete" → "Events")
