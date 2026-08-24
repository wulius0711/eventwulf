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

- [x] Neue Route `/events` (eigener Embed-Code, analog zu `page.tsx`, gleiche Theming-Logik über `config`) — `next.config.ts` CSP-Routing um `/events` ergänzt, das fehlte sonst komplett (nur `"/"` war erfasst)
- [x] Card-Grid: `repeat(auto-fill, minmax(320px, 1fr))`
- [x] Card: Bild oben (fix, Farbbalken als Fallback ohne Bild), Name, Zeitraum, Preis, Kapazitätsanzeige, Ausgebucht-Zustand (Badge, Formular durch Hinweistext ersetzt)
- [x] Accordion-Expand (CSS-Grid `grid-template-rows`-Technik statt `max-height`, keine JS-Höhenmessung nötig): `ResizeObserver` auf dem Akkordeon-Inhalt löst `IframeResizer`-Resize aus — reagiert laufend während der Animation, nicht nur beim DOM-Mount. Gemeinsame `lib/iframeResize.ts` von `IframeResizer.tsx` und der Card wiederverwendet statt dupliziert.
- [x] Kompaktes Buchungsformular: Name, E-Mail, Personenanzahl (Client-Validierung gegen Min/freie Plätze, Server bleibt Quelle der Wahrheit)
- [x] Leerer Zustand: "Aktuell sind keine Events geplant"
- [x] Bestätigungsmail für Event-Buchungen — bereits in Phase 2 erledigt (Event-Name, Zeitraum, Storno-Link im bestehenden E-Mail-Template)

End-to-end gegen den Dev-Branch getestet: Seite lädt (200, korrekte CSP inkl. Bunny-CDN), volle Buchung über den echten `/api/submit`-Aufruf mit der Card-Payload-Form verifiziert (`bookedCount` korrekt erhöht). **Visuelle UI-Prüfung im Browser weiterhin offen** — kein Browser-Tool verfügbar.

## 6. Bestehendes Formular / Kalender

- [x] `Calendar.tsx`: `isBlocked()`/`hasBlockedBetween()` sperren jetzt nur noch bei `type: "blocked"` oder `intern: true` — extern-Events bleiben reine Info-Banner. Gegen echte Daten verifiziert (`intern:false`-Testevent blockiert korrekt nicht).
- [x] Begriffstrennung im UI: `InquiryInbox.tsx` zeigt jetzt "Event" statt "Veranstaltung" als Detail-Label, wenn `eventId` gesetzt ist, plus ein kleines "Event"-Badge in der Anfragenliste zur schnellen Unterscheidung. Fehlenden Status "abgelaufen" in `STATUS_LABELS`/`STATUS_COLORS` ergänzt (wäre sonst als "Neu" falsch eingefärbt worden).

## 7. Testing

- [x] Lokaler Build gegen localhost getestet (jede Phase einzeln, siehe oben)
- [x] Race-Condition-Test: 15 echte parallele Requests (unterschiedliche IPs, um das Rate-Limit realistisch zu umgehen) gegen ein Event mit `maxParticipants: 10` — exakt 10 erfolgreich, 5 korrekt abgelehnt, `bookedCount` landete exakt bei 10. Kein Overselling unter echter Nebenläufigkeit.
- [x] Min/Max-Validierung getestet (Phase 2 + 4)
- [x] Storno-Flow getestet: echten Cancel-Token-Link aufgerufen, `bookedCount` korrekt von 10 auf 9 reduziert
- [x] Ablauf-Frist-Mechanismus getestet (Phase 2, Cronjob-Lauf)
- [ ] Schmale iFrame-Breite — **nicht testbar in dieser Session**, kein Browser-Tool verfügbar. Bitte manuell prüfen (Accordion-Verhalten, Grid-Umbruch auf 1 Spalte, Resize-Verhalten in einem echten schmalen iFrame).
- [x] E-Mail-Versand: mehrere echte Sends über den vollständigen Flow ausgelöst (Bestätigung inkl. Event-Name/Storno-Link, Betreiber-Benachrichtigung, Storno-Benachrichtigung), keine Resend-Fehler

## 8. Rollout

- [ ] Produktions-Migration mit vorherigem Backup
- [ ] Deploy via `vercel --prod` (kein Auto-Deploy)
- [ ] Neuen Embed-Code an Hotels kommunizieren
- [ ] `eventwulf-handbuch.md` aktualisieren (Abschnitt 7 "Seminarpakete" → "Events")
