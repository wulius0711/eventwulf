# Umsetzungsanweisung: Events-Feature eventwulf

Du setzt das Events-Feature für eventwulf gemäß dem Entwicklerplan
(`eventwulf-events-feature-plan.md`) um.

Der Package-Datensatz wurde bereits gelöscht, keine weitere Aktion dazu
nötig. Im Zuge der Schema-Migration bleibt trotzdem, das Package-Modell
selbst aus `schema.prisma` zu entfernen (inkl. der `Inquiry.packageId`/
`package`-Relation).

## Grundsätzliche Arbeitsweise

Setze jeden Punkt architektonisch, im Code und im CSS so um, wie es nach
Best Practice für diesen Stack sinnvoll ist — nicht nur "funktionierend",
sondern wartbar, konsistent mit dem bestehenden Code und für andere
Entwickler nachvollziehbar. Konkret bedeutet das:

### Architektur & Datenmodell

- Prisma-Schema so modellieren, dass Constraints (z.B. `maxParticipants >=
  minParticipants`, `bookedCount <= maxParticipants`) so weit wie möglich
  auf DB-Ebene bzw. in der Transaktionslogik erzwungen werden, nicht nur
  im UI.
- Offener Punkt, den du auflösen musst: `maxParticipants` war bei
  `BlockedDate` nullable ("leer lassen = unbegrenzt"), bei `Package`
  immer gesetzt (Default 50). Entscheide bewusst, ob unbegrenzte Events
  im neuen Event-Modell weiterhin möglich sein sollen. Falls ja, muss die
  DB-Constraint das abbilden, z.B.
  `CHECK (max_participants IS NULL OR booked_count <= max_participants)`.
  Kurz begründen, wofür du dich entscheidest, bevor du das Schema anlegst.
- Kapazitätsreservierung als atomare DB-Operation. Bevor du
  implementierst, kurz zwischen folgenden Optionen abwägen und die Wahl
  begründen:
  1. Einfaches atomares Conditional Update, z.B.
     ```sql
     UPDATE "Event" SET "bookedCount" = "bookedCount" + $1
     WHERE id = $2 AND "bookedCount" + $1 <= "maxParticipants"
     ```
     — kein Versionsfeld, keine Serializable-Isolation nötig, da die
     WHERE-Klausel plus Zeilensperre durch das UPDATE selbst für
     Atomarität sorgt. Das ist vermutlich die einfachste Option und sollte
     der Standardfall sein, wenn keine zusätzliche Logik (z.B.
     mehrstufige Prüfung, Nebeneffekte in derselben Transaktion)
     dagegenspricht.
  2. Prisma `$transaction` mit Serializable-Isolation und Retry-Logik bei
     Konflikten.
  3. Optimistic Locking über ein separates Versionsfeld.

  Race conditions sind der kritischste Punkt im ganzen Feature —
  entsprechend sorgfältig behandeln, aber nicht komplexer als nötig.
- Ablauf-Frist für unbeantwortete Reservierungen: **kein** Wiederverwenden
  von `reminderSentAt`. Dieses Feld ist bereits belegt
  (`app/api/cron/reminders/route.ts` nutzt es für die Anreise-Erinnerung
  einen Tag vor `datumVon`, nur für `status: "bestaetigt"`, per
  `reminderSentAt: null`-Filter). Eine Event-Reservierung, die schon eine
  Ablauf-Warnung bekommen hat, würde sonst nach späterer Bestätigung nie
  mehr die Anreise-Erinnerung erhalten. Stattdessen ein eigenes, neues
  Feld einführen (z.B. `holdExpiresAt` / `capacityReminderSentAt`).
  `reminderSentAt` bleibt unangetastet für seinen bestehenden Zweck.
- Bestehende Patterns im Code respektieren (z.B. wie `InquiryInbox` oder
  der Cancel-Token-Flow aktuell strukturiert sind) statt parallele,
  abweichende Lösungen einzuführen.
- Keine Breaking Changes an bestehenden, noch genutzten Endpunkten ohne
  Rücksprache — mit einer expliziten Ausnahme: Das Ablösen von
  `Package`/`BlockedDate(type:"event")` inklusive `/admin/packages`,
  `PackagesEditor`, dem Paket-Dropdown in `Step1Veranstaltung` und den
  zugehörigen API-Routen ist ausdrücklicher Teil dieses Auftrags. Dafür
  ist keine gesonderte Rücksprache nötig.

### Code-Qualität

- TypeScript strikt: keine `any`, saubere Typen für `Event`,
  Inquiry-Relation, API-Request/Response-Shapes.
- Server-seitige Validierung ist die Quelle der Wahrheit; Client-seitige
  Live-Validierung ist UX-Zucker, ersetzt aber nie die Server-Prüfung.
- Validierung im bestehenden Stil umsetzen: Das Projekt nutzt bereits ein
  handgeschriebenes Validierungsmuster (`lib/validate.ts`,
  `validateSubmit`), kein Zod. Für die neuen Event-Endpunkte an diesem
  Muster bleiben, nicht Zod einführen — das wäre genau die "parallele,
  abweichende Lösung", die wir vermeiden wollen. Falls du eine
  Umstellung auf Zod für sinnvoll hältst, das explizit als separaten
  Vorschlag zur Diskussion stellen (projektweite Entscheidung), nicht
  stillschweigend nur hier einführen.
- Fehlerfälle explizit behandeln (Überbuchung, abgelaufene Reservierung,
  ungültige Personenanzahl) mit klaren, dem Nutzer verständlichen
  Fehlermeldungen — keine generischen 500er.
- Keine toten Codepfade oder auskommentierten Altlasten stehen lassen,
  wenn `Package`/`BlockedDate(type:"event")` abgelöst werden.

### CSS / Frontend

- Bestehendes Theming-System (config-basiert, wie in `page.tsx`)
  konsequent weiterverwenden, keine Parallelstruktur für `/events`.
- Grid/Card-Layout responsiv und mit sinnvollen Breakpoints, explizit
  auch für sehr schmale iFrame-Breiten getestet (1-spaltig).
- Accordion-Resize-Trigger: nicht auf `transitionend` bei einer
  max-height-Animation verlassen — das feuert je nach Property/Browser
  unzuverlässig (mehrfach oder gar nicht). Stattdessen einen
  `ResizeObserver` auf dem sich ausklappenden Element verwenden, der den
  IframeResizer-Trigger auslöst, sobald sich die tatsächliche Höhe
  stabilisiert hat. Kein fixer Timeout.
- Zugänglichkeit mitdenken (Farbkontrast bei Status-Badges/
  Kapazitätsbalken, Tastaturbedienbarkeit im Accordion-Formular).

### Vorgehen

- Arbeite die Abschnitte des Plans in der vorgegebenen Reihenfolge ab
  (Datenmodell → Backend → Bilder → Admin-UI → Frontend → Bestehendes
  anpassen → Rollout), da spätere Abschnitte auf früheren aufbauen.
- Falls beim Abschnitt "Bilder" die Bunny.net-Zugangsdaten (Storage-Zone,
  Access Key) noch nicht bereitstehen: kurz nachfragen und nicht die
  ganze Kette blockieren. Stattdessen mit Admin-UI und Frontend
  fortfahren (Upload-Endpunkt und CSP-Anpassung können nachgezogen
  werden, sobald die Zugangsdaten vorliegen). Keine Platzhalter-
  Credentials erfinden.
- Testing ist keine reine Schlussphase: Nach jeder Phase einen kurzen
  Smoke-Test dieser Phase durchführen (z.B. Migration lokal gegen
  Dev-DB testen, bevor der nächste Abschnitt beginnt). Der
  Testing-Abschnitt aus dem Plan ist für die übergreifenden Tests
  reserviert, die erst nach mehreren fertigen Phasen sinnvoll sind
  (Race-Condition-Test, volle E2E-Flows, schmale iFrame-Breite). So
  fallen Integrationsfehler nicht erst ganz am Ende auf, wenn sie am
  schwersten zu isolieren sind.
- Bei weiteren Punkten mit mehreren sinnvollen Umsetzungsoptionen (z.B.
  Cronjob vs. Lazy-Expiry für die Ablauf-Frist) kurz die gewählte
  Option und den Grund dafür nennen, bevor du implementierst.
- Vor Prod-Migration explizit auf das nötige Backup hinweisen und nicht
  eigenständig gegen Prod ausführen.
- Pro Abschnitt einen eigenen Commit statt eines Mega-Commits am Ende —
  erleichtert Review und macht es möglich, einzelne Phasen (z.B. die
  Kapazitätslogik) später isoliert zurückzurollen, falls nötig.
- Nach jedem größeren Abschnitt kurz zusammenfassen, was geändert wurde
  und was als Nächstes ansteht.
