# eventwulf: Vollständiger Sicherheits- und Datenschutz-Bericht (Schritt 2)

**Stand:** `git fetch` durchgeführt. `main` steht weiter auf `46c3405` (HEAD = `origin/main`), es gibt keine neuen Commits. H1–H4 sind damit unverändert gültig.

**Grenzen:**
- Alles ist statisch aus dem Code ermittelt.
- Lesende Zugriffe auf Produktion: 8 GET/HEAD auf `app.eventwulf.at` (Demo-Widget, `/login`, `/signup`, `/admin/login`, `/storniert`, `/zz-admin-preview`, `/api/health`, `/robots.txt`).
- Dazu kamen `npm audit` und lesende Doku-Abrufe bei Bunny und GitHub.
- Es gab keine schreibenden Requests und keinen Zugriff auf Bunny, Neon, Stripe oder Resend.
- Nicht im Detail gelesen: die Wizard-Step-Komponenten und der Text des Handbuchs.

---

## A. Hoch-Befunde (H1 und H2 mit Korrekturen, H3/H4 unverändert)

### H1: Cross-Tenant-Löschung auf Bunny, Schwere offen (Tendenz Kritisch)

- **Befund:**
  - `image` wird bei Events und Räumen ungeprüft gespeichert (`app/api/admin/events/route.ts:153,231`).
  - Beim Ersetzen oder Löschen wird die alte URL mit dem Plattform-`AccessKey` per DELETE an Bunny geschickt (`lib/bunny.ts:22-23,27` für Events, `:51-52,56` für Räume; Aufrufer `events/route.ts:263-264,287-288`, `rooms/route.ts:177,211`).
  - Der Pfad ist `imageUrl.slice(prefix.length)`, direkt in die URL interpoliert: `https://storage.bunnycdn.com/${zone}/${path}`. Er wird nicht normalisiert, nicht gegen den eigenen Slug geprüft und nicht auf `?`, `#` oder `..` untersucht.
  - Die "wird noch verwendet?"-Prüfung ist nur auf den eigenen Mandanten gescoped (`bunny.ts:10-14,39-43`).
- **Bunny-Doku (lesend):** Laut [Delete File](https://bunny.net/docs/api-reference/storage/manage-files/delete-file) gilt:
  - „In case the object is a directory all the data in it will be recursively deleted as well.“ Rekursion ist damit dokumentiert.
  - Das Löschen der Zonen-Wurzel `/` ist standardmäßig durch einen Guard gesperrt.
  - Der Guard lässt sich mit `allowRootDelete=true` als Query-Parameter oder Header umgehen.
  - Zu Slash am Ende und zu `..` schweigt die Doku.
- **Worst-Case-Pfade:**

| Angreifer setzt `image` auf … | Ergebnis | Status |
|---|---|---|
| `https://<cdn>/<eigener-slug>/…` | eigene Dateien | harmlos |
| `https://<cdn>/<fremder-slug>/<datei>.webp` | einzelnes Bild von Mandant B weg | code-belegt |
| `https://<cdn>/<fremder-slug>/` | alle Bilder von B, weil rekursiv laut Doku (Slug ist öffentlich) | Verdacht, nicht verifiziert |
| `https://<cdn>/?allowRootDelete=true` | Pfad wird zu `…/<zone>/?allowRootDelete=true`, also Löschung der ganzen Zone, falls Bunny das so auswertet | Verdacht, nicht verifiziert |
| `…/a/../<fremder-slug>/` | `..` erreichbar: Der WHATWG-URL-Parser von `fetch` normalisiert Punkt-Segmente vor dem Senden. Aus der Zone kommt man damit nicht heraus, weil der `AccessKey` zonengebunden ist (Annahme). | code-belegt (Normalisierung), sonst Annahme |

- **Einstufung:** Vorläufig Hoch. Wird bestätigt, dass die Wurzel per Query-Parameter erreichbar ist und die Zone geleert wird, ist es **Kritisch**: Ein beliebiger zahlender Mandant könnte alle Bilder aller Mandanten löschen. Der Angriff braucht nur einen Basis-Account, weil Events in jedem Plan verfügbar sind.
- **Nachweis:**
  - Praktische Verifikation nur in einer separaten Test-Storage-Zone (siehe „Manuell zu prüfen“ Nr. 1).
  - Im Code zeigt eine Testmandanten-Sequenz PATCH mit fremder URL, dann PATCH mit `image:""`, den Einzeldatei-Fall.
- **Fix:**
  - **Beim Speichern:** `image` nur akzeptieren, wenn es exakt `https://<BUNNY_CDN_HOST>/<eigener slug>/<24 hex>.webp` entspricht.
  - **Beim Löschen:** dieselbe Regex-Prüfung erneut und zusätzlich `..`, `?`, `#`, `%` und leere Pfade ablehnen. Nur Werte löschen, die eine vom Server ausgestellte Upload-URL sind.
  - **Solange das nicht umgesetzt ist:** die Löschfunktion deaktivieren. Verwaiste Bilder sind billig, wie schon im Code-Kommentar steht.
  - **Zusätzlich:** Bunny-Zone-Backup bzw. Replikation prüfen (Manuell Nr. 1).
- **Nachtrag 26.09.:** Die Produktions-SQL zum Bestand (alle Events/Rooms mit `image`, das nicht dem neuen Format des eigenen Clients entspricht) wurde am 26.09. auf `main` ausgeführt: **0 Treffer**. Alle Bild-URLs in Produktion entsprechen dem neuen Format, die Prüfung aus Teil 1 sperrt also keinen Bestandsdatensatz aus.

### H2: Unauthentifizierter Gastdaten-Abfluss (`/api/availability` → `/api/ical/[id]`)

- **Befund, Beleg und Nachweis:**
  - Sie stehen im Bericht aus Schritt 1 und sind unverändert.
  - `availability/route.ts:33-36,55` liefert `id: inq.id`.
  - `ical/[id]/route.ts:26-28` liefert Titel, Namen und Teilnehmerzahl ohne Authentifizierung.
- **Schwere:** Hoch. Nur Pro-Mandanten sind betroffen, weil Räume ab Pro verfügbar sind.
- **Korrigierter Fix:**
  - **Sofort (klein):** Die `id` aus `roomBlockedEntries` in `/api/availability` entfernen, also keine Inquiry-ID in einer öffentlichen Antwort. Der Kalender braucht sie nicht, ein anonymer Zähler oder Hash als React-Key reicht.
  - **Danach:** ein eigenes, zufälliges `icalToken` (mindestens 128 Bit) als neue Spalte an `Inquiry`. Es steht nur in der Bestätigungsmail, und `/api/ical/[token]` schlägt darüber nach. `cancelToken` wird bewusst nicht wiederverwendet, weil sonst jeder mit dem Kalenderlink stornieren könnte.
  - **Nebenwirkung:** Bereits verschickte Mails enthalten `/api/ical/<id>`. Entweder eine Übergangsfrist mit ID-Lookup, oder die Links bewusst brechen.
  - **Zusätzlich:** Rate-Limit auf `/api/ical/*`. Der Endpunkt hat heute keines.

### H3: Mail-Relay über `/api/submit` (unverändert zu Schritt 1)

Belege: `submit/route.ts:66,302,371-378,393-405`, `validate.ts:161-190`, `ratelimit.ts:31-34`.

### H4: Mailfehler still verschluckt und keine Fehlerüberwachung (unverändert zu Schritt 1)

Belege: `invoices/route.ts:121,180`, `reminders/route.ts:97,107,110`, `forgot/route.ts:54`, `webhook/route.ts:159`, `team/route.ts:136`, `cancel/[token]/route.ts:49`.

Zwei Ergänzungen:
- Die vorhandenen `console.error("Failed to send …")` in `forgot:70`, `webhook:170`, `team:148` und `invoices:188` sind Totcode, weil `send()` nie wirft.
- `cancel-cron-race.spec.ts` deckt nur „Admin-Storno gegen Cron“ ab. Für die Mail-Pfade gibt es keinen Test.

### H5: Preview und Production teilen sich Datenbank und Secrets (Nachtrag 26.09.)

- **Befund:**
  - `vercel env ls` (26.09., nur Namen und Environments, keine Werte) zeigt `DATABASE_URL`, `JWT_SECRET`, `RESEND_API_KEY`, `CRON_SECRET`, `PROVISIONING_SECRET` und `SUPERADMIN_SLUG` je als **einen** Eintrag für **Preview und Production**. Preview-Deployments laufen damit gegen dieselbe Datenbank und mit denselben Secrets wie die Produktion.
  - Das Script `build` führt `prisma migrate deploy` aus (`package.json:7`, `scripts/migrate-deploy-unpooled.js`). Jeder Preview-Deploy migriert also die Produktions-DB, mit dem Schema-Stand des jeweils deployten Codes, auch unfertigem oder unreviewtem.
  - Mindestens ein Preview-Deploy ist am 22.09. erfolgt (Verifikation von `getIp()`, siehe Kommentar in `lib/ratelimit.ts:36-41`).
  - Weitere Folgen: Ein Preview-Deploy kann mit dem Produktions-`JWT_SECRET` gültige Sitzungen ausstellen und lesen, mit dem Produktions-Resend-Key echte Mails an echte Adressen versenden und akzeptiert `CRON_SECRET` und `PROVISIONING_SECRET` der Produktion. Sein Code liest und schreibt echte Mandantendaten.
- **Schwere:** Hoch.
- **Beleg:** `vercel env ls` (Spalte „environments“ = „Preview, Production“ für die genannten sechs Variablen), `package.json:7`, `scripts/migrate-deploy-unpooled.js`.
- **Nachweis:** `vercel env ls` im Projekt `eventwulf`. Die Werte selbst wurden nicht gelesen. Ob der Preview-Wert tatsächlich derselbe ist wie der Produktionswert, folgt aus der gemeinsamen Zuordnung: Eine Variable hat in Vercel einen Wert pro Eintrag.
- **Fix (manuell, nicht im Code):** Eigene Preview-Werte in Vercel setzen: eigener Neon-Branch für Preview, eigene Secrets (`JWT_SECRET`, `CRON_SECRET`, `PROVISIONING_SECRET`), eigener Resend-Key (oder Versand in Preview abschalten). Bis das erledigt ist: keine Preview-Deploys (`vercel` ohne `--prod` vermeiden).
- **Sofortmaßnahme umgesetzt 26.09.:** Preview-Scope bei den sechs Variablen in Vercel entfernt, nur noch Production. Preview-Deploys schlagen damit beim Build fehl, das ist gewollt. **Eigene Preview-Umgebung offen** (eigener Neon-Branch, eigene Secrets, eigener Resend-Key).

---

## B. Impersonation und Superadmin-Zugriff

**Warum das kickerwulf-Muster AZ-01 nicht vorkommt:**
- Es gibt kein Impersonation-Cookie und kein „Als Kunde anmelden“.
- Die Sitzung kommt ausschließlich aus einem signierten HS256-JWT (`lib/auth.ts:24-34`). `JWT_SECRET` hat keinen Fallback, das Fehlen wirft (`auth.ts:5-8`).
- `getSession()` prüft bei **jedem** Request den User in der DB und `passwordChangedAt` (`auth.ts:38-63`). Das JWT ist damit an eine reale DB-Zeile gebunden.
- Es gibt keinen Slug- oder ID-Wert in einem unsignierten Cookie.
- Das AZ-02-Muster (Mandant per `?id=`) kommt ebenfalls nicht vor. Alle Admin-Seiten und -APIs leiten den Mandanten aus `session.clientSlug` ab. Jede ID aus Body oder Query wird mit `clientId` gescoped. Das habe ich für alle Admin-Routen geprüft. Die neuen und geänderten Routen seit 22.09. (Inquiries mit `id`, `archived`, `take`, `skip`; Invoices-Paging; `raeume`-Filter) sind ebenfalls gescoped. Die einzigen Ausnahmen sind H1 und H2.

**Wie Superadmin-Zugriff stattdessen funktioniert:**
- Superadmin ist, wer ein JWT mit `clientSlug === SUPERADMIN_SLUG` (Default `"admin"`) hat.
- Der Slug wird beim Login als erster Client der Organisation gesetzt (`login/route.ts:22-40`) oder per `switch-slug` innerhalb der eigenen Organisation (`switch-slug/route.ts:9-16`). Der Slug ist global eindeutig (`schema.prisma`, `Client.slug @unique`). Signup und Provision hängen einen Zufallssuffix an, ein Mandant kann `admin` also nicht erhalten.
- Der Superadmin hat keinen Zugriff auf Mandantendaten (kein Impersonation). Er kann aber:
  - alle Organisationen samt User-E-Mails listen (`clients/route.ts:12-27`),
  - Pakete setzen (`:36-47`),
  - Organisationen mit selbst gewähltem Passwort anlegen (`:51-75`),
  - Organisationen löschen (`:79-99`).

**Zentral oder verstreut?** Weiterhin verstreut, unverändert seit 22.09.: **5 Dateien, 14 Vergleichsstellen**, kein Helper.
- `app/admin/(protected)/layout.tsx:11-12`
- `clients/page.tsx:7-8`
- `elemente/page.tsx:18-19`
- `api/admin/clients/route.ts:9,13,36,51,79,88`
- `api/admin/orgs/[id]/clients/route.ts:7,11,60,77,113,123`

Alle vergleichen strikt gegen denselben Wert, keine weicht ab. Das Risiko ist Wartbarkeit, nicht ein aktueller Fehler (siehe N6).

**Ähnliche Mechanismen mit Einfluss auf Kontoübernahme:**
- **`/api/autologin`:** Es loggt als `org.users[0]` ein, per HMAC mit `bookingAppKey`. Der Token gilt 60 s und wird gegen Wiederverwendung geschützt.
- **`/api/provision`:** Es gibt für bestehende E-Mails den `bookingAppKey` zurück (`provision/route.ts:25-31`). Wer `PROVISIONING_SECRET` hat, kann sich damit in jede provisionierte Organisation einloggen. Das ist beabsichtigt, das Secret ist damit faktisch ein Master-Schlüssel (Info, siehe N9).

**Protokollierung:** Nein. Es gibt kein Audit-Log, weder für Superadmin-Aktionen noch für Logins (siehe M8).

---

## C. Mittel

### M1: Login: nur IP-Limit, Timing-Enumeration, E-Mail nicht normalisiert
- **Befund:**
  - Limit nur pro IP (5 pro 15 Min., `login/route.ts:8`), kein Account-Limit, kein Lockout. Verteilte Angreifer umgehen es.
  - Bei unbekannter E-Mail wird kein bcrypt ausgeführt (`:24`), die Antwortzeit verrät, ob ein Konto existiert. `forgot` und `team` haben dafür einen künstlichen Delay, der Login nicht.
  - `login` sucht die E-Mail unnormalisiert, `forgot` lowercased (`forgot/route.ts:29`). Ein mit gemischter Schreibweise angelegter Nutzer (Team-Einladung `team/route.ts:79`, Provision, Signup) kann sich nie zurücksetzen.
  - `compareSync`/`hashSync` (Kosten 12) blockieren den Event-Loop, und `req.json()` ohne Typprüfung wirft bei einem Nicht-String einen 500.
- **Schwere:** Mittel. Die Passwortrichtlinie mit Leak-Check ist gut, das mildert.
- **Nachweis:** Antwortzeit `POST /api/admin/login` mit bekannter gegenüber unbekannter E-Mail vergleichen. Ein Body mit `password: {}` liefert 500.
- **Fix:** Zusätzlich Limit pro E-Mail-Hash. Bei unbekanntem Nutzer ein Dummy-`compare`. E-Mails beim Speichern und Suchen lowercasen. Async-bcrypt.

### M2: `notifyEmail` und weitere Konfiguration in der öffentlichen Widget-HTML
- **Befund:** `app/page.tsx:105` reicht die komplette Konfiguration an die Client-Komponente `Wizard` durch. Dadurch steht `notifyEmail` (die interne Empfängeradresse des Betreibers) im HTML für jeden Besucher. **Live bestätigt** auf `?kunde=demo` (`"notifyEmail":"demo-unused@eventwulf.at"`). Bei echten Mandanten wäre das deren echte Adresse, oft eine Personen-Mailbox. Sie ist Ziel für Spam und Phishing.
- **Schwere:** Mittel. Das ist dasselbe Muster wie kickerwulf AZ-05, ein zu breites öffentliches Objekt.
- **Nachweis:** `curl "https://app.eventwulf.at/?kunde=<slug>"` und nach `notifyEmail` suchen.
- **Fix:** Nur die für die Anzeige nötigen Felder übergeben (`pick`), `notifyEmail` und `billing` weglassen. Dasselbe für `/events`.

### M3: Sicherheits-Header fehlen auf `/login`, `/signup`, `/signup/complete`, `/storniert`
- **Befund:** `next.config.ts:79-88` setzt Header nur für `/`, `/events`, `/admin/(.*)` und `/api/*`. **Live bestätigt:** `/signup` und `/storniert` haben keine CSP, kein `X-Frame-Options`, kein `nosniff` und keine Referrer-Policy. Nur der Vercel-Default-HSTS ist da, ohne `includeSubDomains` und `preload`. `/login` leitet auf `/admin/login` um, das ist geschützt. Damit ist die Signup-Seite einbettbar (Clickjacking auf den Weg zu Stripe). `X-XSS-Protection` ist veraltet.
- **Schwere:** Mittel. Das ist dasselbe Muster wie kickerwulf EA-06.
- **Nachweis:** `curl -I https://app.eventwulf.at/signup`.
- **Fix:** Globaler Header-Block mit `frame-ancestors 'none'`, Ausnahme nur für `/` und `/events`.
- **Bekannt und offen aus 10.09.:** die CSP-Nonce-Migration (`unsafe-inline`).
- **Nachtrag 26.09. (umgesetzt):** Alle Pfade außer `/`, `/events` und `/api/submit` bekommen `X-Frame-Options: DENY` und die CSP mit `frame-ancestors 'none'`, dazu `nosniff` und die Referrer-Policy. Der HSTS-Wert bleibt unverändert (`max-age=63072000; includeSubDomains; preload`), `X-XSS-Protection` ist entfernt. Die Widget-Seiten `/` und `/events` bleiben mit `frame-ancestors *` einbettbar.
- **Sonderfall, gewollt:** `app/page.tsx:29` und `app/events/page.tsx:30` leiten bei fehlendem oder leerem `kunde`-Parameter auf `/signup` um. Ein Embed ohne `kunde` zeigt nach dem Deploy deshalb im Frame eine Browser-Fehlerseite statt des Signup-Formulars. Das ist beabsichtigt: Das Signup-Formular (mit Weg zu Stripe) soll nicht in einem Fremd-Iframe erscheinen. Alle bekannten Einbettungen (Demo auf eventwulf.at, Admin-Snippets, Framer-Komponente, Admin-Vorschau) enthalten `kunde`.

### M4: `GET /api/cancel/[token]` ändert Zustand, dazu ungesichertes Doppel-Storno
- **Befund:**
  - Stornieren passiert schon beim Aufruf der URL (`cancel/[token]/route.ts:33-35`). Link-Scanner und Vorschau-Prefetcher von Mail-Clients (z. B. Safe Links) stornieren dadurch Buchungen ohne Zutun des Gastes.
  - Der Status wird gelesen (`:29`), dann bedingungslos geschrieben (`:33`), und die Kapazität wird anhand des alten Status freigegeben (`:37-40`). Zwei fast gleichzeitige Aufrufe (Scanner plus Gast) können die Kapazität doppelt freigeben und Überbuchung erzeugen. **Verdacht, nicht verifiziert:** `cancel-cron-race.spec.ts` testet Admin gegen Cron, nicht zwei parallele GETs.
- **Schwere:** Mittel.
- **Nachweis:** Zwei parallele `GET /api/cancel/<token>` bei einer gehaltenen Event-Anfrage, danach `bookedCount` prüfen.
- **Fix:** GET zeigt eine Bestätigungsseite, das Stornieren läuft per POST. Der Status-Übergang wird atomar (`updateMany … WHERE status NOT IN (…)`) und die Freigabe nur bei `count === 1` ausgeführt.

### M5: Organisationslöschung unvollständig und nicht transaktional
- **Befund:**
  - `clients/route.ts:93-97` löscht Inquiries, Termine, Clients, User und Organisation in fünf einzelnen Aufrufen ohne `$transaction`. Ein Abbruch dazwischen hinterlässt halb gelöschte Daten.
  - Das Stripe-Abo (`stripeSubscriptionId`) wird nicht gekündigt. Der Kunde wird weiter belastet, der Webhook findet keine Organisation und macht nichts.
  - Bunny-Bilder, `UsedTrialCardFingerprint` und Logs bleiben.
  - `orgs/[id]/clients` DELETE (`:131-133`) hat dasselbe Muster für Standorte.
- **Schwere:** Mittel. Es ist nur durch den Superadmin auslösbar, aber finanziell und DSGVO-relevant.
- **Nachweis:** Testorganisation mit Abo anlegen, per Superadmin löschen, danach im Stripe-Dashboard prüfen.
- **Fix:** Abo zuerst kündigen (bei Fehler abbrechen), dann alles in einer Transaktion, Bilder freigeben (siehe H1-Fix zur Vorsicht).

### M6: Signup: bezahltes Konto wird bei bestehender E-Mail stillschweigend nicht angelegt
- **Befund:**
  - `/api/signup` prüft nicht, ob die E-Mail schon existiert (`signup/route.ts:16-43`).
  - Der Webhook bricht bei vorhandenem User stumm ab (`webhook/route.ts:88-89`, `break`, kein Log). Das Abo (14 Tage Test, dann Abbuchung) existiert bei Stripe, der Kunde hat aber kein Konto. Das trifft z. B. einen wiederkehrenden Kunden. Ebenso kann jemand eine fremde E-Mail „besetzen“, ohne sie zu bestätigen.
  - Die E-Mail wird vor der Zahlung nicht verifiziert.
- **Schwere:** Mittel.
- **Nachweis:** Signup mit einer E-Mail, die schon als User existiert, durchspielen und den Webhook prüfen.
- **Fix:** Vor dem Checkout auf bestehende E-Mail prüfen (mit generischer Antwort), im Webhook den Fall loggen und das Abo automatisch kündigen oder den Betreiber alarmieren.

### M7: Team ohne Rollen
- **Befund:** Jedes Mitglied kann jedes andere Mitglied löschen, auch den Inhaber (`team/route.ts:160-172`, nur „nicht selbst“), einladen und das Stripe-Portal öffnen. In einem 2er-Team (Pro) kann Mitglied B den zahlenden Inhaber A entfernen und übernimmt das Konto samt Abo-Verwaltung.
- **Schwere:** Mittel. Das betrifft nur das Vertrauen innerhalb eines Mandanten.
- **Fix:** Rolle `owner`. Nur der Inhaber darf löschen und Billing verwalten.

### M8: Kein Audit-Log, Superadmin ohne 2FA
- **Befund:** Im Code gibt es keine Protokollierung. Superadmin-Aktionen (Organisation löschen, Paket ändern, Organisation mit Passwort anlegen, alle E-Mails listen), Team-Änderungen und Logins sind nicht nachvollziehbar. Das Superadmin-Konto ist eine einzelne Zugangsdatenkombination mit Vollzugriff auf alle Mandanten, ohne 2FA.
- **Schwere:** Mittel.
- **Fix:** Tabelle `AuditLog` (Akteur, Aktion, Ziel, Zeit) für Superadmin- und Teamaktionen. 2FA oder mindestens IP-Bindung für den Superadmin.

### M9: Sitzungen: 7 Tage, Logout ohne Widerruf, Slug nicht an Organisation gebunden
- **Befund:**
  - JWT gilt 7 Tage (`auth.ts:24-30`). Logout löscht nur das Cookie (`logout/route.ts`). Ein gestohlenes Token bleibt gültig, bis das Passwort geändert oder der User gelöscht wird. Das Passwort-Invalidieren ist ein guter Ausgleich (`auth.ts:54-58`).
  - `getSession` prüft nicht, dass `clientSlug` zur `organizationId` gehört. **Verdacht, nicht verifiziert:** Wird ein Standort gelöscht und derselbe Slug für eine andere Organisation neu angelegt, hätte eine noch gültige Sitzung der ersten Organisation Zugriff auf den neuen Standort. Das ist ein enger Ausnahmefall und nur durch den Superadmin auslösbar.
- **Schwere:** Mittel bis Niedrig.
- **Fix:** In `getSession` den Slug gegen die Organisation prüfen. Bei Bedarf eine Sitzungs-Version pro User.

### M10: Funktionsregion `iad1` (DSGVO-Aspekt)
- **Befund:** `x-vercel-id: fra1::iad1::…` (live, Demo-Widget). Der Edge sitzt in Frankfurt, die **Funktionen laufen in `iad1` (Washington)**. Die Region ist nirgends im Repo gesetzt: `vercel.json` hat kein `regions`-Feld, `.vercel/project.json` enthält keine Region. Es gilt also der Projekt-Standard (Vercel Dashboard → Project → Settings → Functions → Function Region). Alle Requests mit Personendaten (Formulardaten, Logins, Mails) werden damit in den USA verarbeitet, die DB steht in der EU (Neon `eu-central-1`, aus dem Verbindungs-Host). Das ist dasselbe Muster wie kickerwulf DS-14.
- **Schwere:** Mittel. **Rechtlich klären:** Vercel ist ohnehin ein US-Unternehmen (DPA, SCC/DPF), aber Datenverarbeitung in `iad1` statt `fra1` ist eine vermeidbare Übermittlung. Sie muss in der Datenschutzerklärung stehen.
- **Fix:** `"regions": ["fra1"]` in `vercel.json` oder die Projekt-Einstellung ändern. Nach dem Deploy `x-vercel-id` erneut prüfen.

### M11: Kein Löschkonzept, Art.-9-Risiko, Pseudonyme statt Anonymisierung
- **Befund:**
  - Keine automatische Löschung: Anfragen, Angebote, abgelaufene Einladungs- und Reset-Tokens (`User.inviteToken` bleibt nach Ablauf stehen) und `UsedAutologinToken` bleiben unbegrenzt. Der einzige Cleanup-Cron löscht nur `RateLimitEntry` (`cleanup-rate-limits/route.ts:17`).
  - Der Cleanup läuft wöchentlich (`vercel.json:17`), die Zeilen dürfen aber nach 24 h weg. Sie bleiben real bis zu 8 Tage.
  - `RateLimitEntry` speichert `sha256("login:<IP>")` (`ratelimit.ts:18`). Das ist unsalted und bei IPv4 in Sekunden rückrechenbar, also pseudonym, nicht anonym.
  - `barrierefreiheit` („Besondere Bedürfnisse“) und die frei definierbaren `customFields` können Gesundheitsdaten (Art. 9 DSGVO) enthalten, ohne dass irgendwo darauf hingewiesen wird.
  - `UsedTrialCardFingerprint` (`schema.prisma`) wird nie gelöscht, mit Absicht.
  - Betroffenenrechte: einzelne Anfragen lassen sich löschen (`inquiries/route.ts:172`), aber es gibt keinen Export und keine serverseitige Suche nach Personen (die Suche läuft im Browser, `InquiryInbox`). Archivieren ist keine Löschung.
- **Schwere:** Mittel. **Rechtlich klären.**
- **Fix:** Cron mit konfigurierbaren Fristen (z. B. 12 bis 24 Monate nach Eventdatum) für Inquiries, Tokens und Hashes. Hinweistext im Formular zu sensiblen Feldern. Export und Personensuche. Die Aufbewahrungspflicht für Angebote/Rechnungen dagegen prüfen lassen, weil die Löschung einer Inquiry deren Angebote per Cascade mitlöscht.

### M12: Mails und Widget ohne Impressum, Datenschutzhinweis und Verantwortlichen
- **Befund:**
  - Die App hat keine `/datenschutz`- und keine `/impressum`-Seite. Nur `signup/page.tsx:157-185` verlinkt auf `eventwulf.at/legal/…`.
  - Das Widget und alle Mails an Gäste enthalten weder Datenschutz-Link noch Impressum, noch den Namen des Verantwortlichen. Absender ist `anfrage@eventwulf.at` mit dem Mandantennamen als Anzeigename, `replyTo` ist gesetzt.
  - Das Widget sammelt personenbezogene Daten (Name, E-Mail, Telefon, Bedürfnisse) ohne Einwilligungs- oder Hinweistext. Das ist der offene Track-B-Punkt („Impressum/AGB/Datenschutz im Widget“).
- **Schwere:** Mittel. **Rechtlich klären.**
- **Fix:** Pro Mandant Felder `privacyUrl`/`imprintUrl` und Verantwortlicher. Hinweis samt Link im Widget und Footer in Mails.

### M13: Test-Branch enthält möglicherweise echte Daten
- **Befund:** Commit `fd39532` sagt selbst, der Test-Branch (`TEST_DATABASE_URL`) sei per Copy-on-Write-Fork von der Produktion entstanden und habe echte Daten geerbt. Ersetzt wurde nur der Superadmin-Client. **Verdacht, nicht verifiziert:** Der Rest des Forks (echte Inquiries, User, Organisationen zum Zeitpunkt des Forks) kann noch im Test-Branch liegen. Tests laufen auf Entwickler-Rechnern mit diesem Branch.
- **Schwere:** Mittel, Einstufung abhängig vom Befund im Neon-Dashboard (Manuell Nr. 4).
- **Nachtrag 26.09.:** Geprüft 26.09.: Test-Branch enthält nur Demo-Mandanten (`marigold`, `loci`). Einstufung damit **Niedrig**. Vor dem ersten echten Kunden Test-Branch schema-only neu aufsetzen statt Fork.

---

## D. Niedrig

- **N1: Öffentliche Endpunkte ohne Rate-Limit.**
  - Betroffen: `/api/rooms`, `/api/events`, `/api/ical/[id]`, `/api/cancel/[token]`, `/api/signup/finalize` (`signup/finalize/route.ts:24-39`), `/api/admin/account` (Passwort-Prüfung mit Session, `account/route.ts:18`) und der Upload.
  - `signup/finalize` ruft bei jedem Aufruf `stripe.checkout.sessions.retrieve` auf. Das ist die geteilte Stripe-Kontingent-Quelle mit bookingwulf, und es gibt keinen `try/catch` (500).
  - Das Limit ist außerdem fail-open (`ratelimit.ts:31-34`) und teilt bei fehlender IP einen Bucket `unknown`.
  - **Fix:** Limits ergänzen, Stripe-Fehler abfangen.
- **N2: Upload ohne Quote und Pixel-Limit.** `events/upload/route.ts:15,44`: Jeder eingeloggte Mandant kann unbegrenzt Bilder hochladen (Bunny-Kosten). `sharp` wird ohne `limitInputPixels`-Anpassung genutzt (Speicherlast durch Dekompressionsbomben). Fix: Quote pro Mandant, Rate-Limit, Pixel-Limit.
- **N3: Fachlogik `datumBis`.** `validate.ts:163-165` prüft nicht `datumBis >= datumVon` und keine Höchstspanne. Eine umgekehrte oder extrem lange Spanne kann die Überschneidungsprüfung umgehen (`roomAvailability.ts:39-50`) oder nach der Bestätigung einen Raum sehr lange blockieren. Die Bestätigung erfordert eine Admin-Aktion. Fix: Reihenfolge und Maximum (z. B. 366 Tage) prüfen.
- **N4: Angebote: fehlende Typ- und Werteprüfung.** `invoices/route.ts:102,119`: `validUntil` als ungültiges Datum führt zu 500, `taxRate` wird nicht validiert (Bereich 0 bis 1). JSON-Felder wie `id` werden nicht auf String geprüft. Filter-Objekte bleiben durch das `clientId`-Scoping im eigenen Mandanten, sind also kein Cross-Tenant-Problem. Fix: gemeinsames Schema.
- **N5: iCal-Header-Injection.** `ical/[id]/route.ts:16-18,64-65`: `escapeIcal` entfernt kein `\r`, `validateSubmit` lässt Steuerzeichen zu. Ein Gast kann Zeilen (z. B. zusätzliche Eigenschaften) in seine eigene `.ics` einschleusen. In Kombination mit H2 lässt sich der Link an Dritte weitergeben. Fix: Steuerzeichen in Eingaben entfernen, `\r` in `escapeIcal` ersetzen.
- **N6: SUPERADMIN-Prüfung verstreut.** Siehe Abschnitt B. Fix: ein Helper `isSuperAdmin(session)` mit Test (steht bereits auf der Nachtragsliste).
- **N7: Host-abgeleitete Links.** `team/route.ts:133` und `signup/route.ts:29`, `checkout/route.ts:102`, `portal/route.ts:26` nutzen `req.nextUrl.origin`, die anderen Stellen `resolveBaseUrl`. Auf Vercel muss der Host zu einer Projekt-Domain gehören, das Risiko ist klein. Fix: überall `resolveBaseUrl`.
- **N8: Zeitzone (Speicherung, Eingabe, Anzeige, Randfälle).**
  - **Speicherung:** Zeitstempel sind UTC (Prisma). Reine Datumswerte (Events, Sperrzeiten) sind `DateTime` mit UTC-Mitternacht, weil die Formulare `type="date"` nutzen (`EventsEditor.tsx:370,377`, `AvailabilityEditor.tsx:142,146`) und `new Date("YYYY-MM-DD")` UTC ist. Ein Tag kann so nicht verrutschen. Anfragen speichern Datum und Uhrzeit als Strings im JSON. Das ist das sicherste Modell.
  - **Anzeige, Admin:** Sie nutzt `substring(0,10)` und `T12:00:00` (korrekt). `dashboard/page.tsx:8` und `invoiceTemplate.ts:19` formatieren serverseitig in UTC. `createdAt` und `validUntil` können nachts (00:00 bis 02:00 Wiener Zeit) einen Tag früher erscheinen.
  - **Anzeige, Widget:** `Calendar.tsx:75-76,89-90,158-159` und `EventsList.tsx:34` nutzen die Browser-Zeitzone für UTC-Mitternachtswerte. Für Besucher westlich von UTC (z. B. USA) erscheinen Events und Sperrzeiten einen Tag früher. Für DACH korrekt.
  - **Rechnungsnummer:** `invoiceNumber.ts:4` nimmt das UTC-Jahr. Ein Angebot am 01.01. zwischen 00:00 und 01:00 (MEZ) bekommt noch die Vorjahresnummer.
  - **Randfälle:** `/api/events` filtert `endDate >= now` (`events/route.ts:12`). Ein Event verschwindet um 00:00 UTC (01:00/02:00 Wien) am **letzten Tag** aus der Liste. Die Reminder-Cron läuft fest um 07:00 UTC, `tomorrow` ist ein UTC-Datum (`reminders/route.ts:65-67`). Das ist ganzjährig korrekt, solange der Cron nicht um Stunden verspätet startet. Der 48-h-Hold ist DST-unabhängig (`HOLD_DURATION_MS`). `validate.ts:95,165` nutzt UTC-heute, was am Tagesbeginn in Wien einen Tag Toleranz gibt. iCal-Zeiten sind „floating“ (ohne `TZID`), was akzeptabel ist.
  - **Kapazität pro Tag:** Räume sind tagesgenau belegt (ein Raum kann am selben Tag nicht doppelt gebucht werden, auch nicht vormittags/nachmittags). Das ist konsistent, aber eine Produktentscheidung.
  - **Fix:** Anzeige überall mit `timeZone: "UTC"` bzw. `"Europe/Vienna"` fest formatieren, Jahr der Rechnungsnummer in `Europe/Vienna`.
- **N9: Autologin und Provision.**
  - `autologin/route.ts:28` nimmt `org.users[0]` ohne `orderBy`, der Login-Benutzer ist bei mehreren Mitgliedern beliebig.
  - `:20` prüft nur „nicht zu alt“, ein Zeitstempel in der Zukunft läuft nie ab (nur mit gültigem Schlüssel).
  - Der Schlüssel liegt im Klartext in der DB. Der Token steht in der URL und damit in Logs und Referern.
  - **Fix:** `Math.abs`-Fenster, `orderBy`, Schlüssel pro Organisation rotierbar machen.
- **N10: Abhängigkeiten (Details in Abschnitt F).**
- **N11: Reminder-Cron.** `reminders/route.ts`: kein atomares Beanspruchen (überlappende Läufe senden doppelt), lädt alle bestätigten Anfragen aller Mandanten in den Speicher, sequenzielle Sends, kein `maxDuration`. Fix: `updateMany … WHERE reminderSentAt IS NULL` als Claim, in Batches.
- **N12: Latenz durch Regionswechsel (getrennt von M10).**
  - Ein Admin-Seitenaufruf macht rund 8 sequenzielle DB-Roundtrips (`layout.tsx`: Session, Organisation, Client, zwei Zähler; danach Seite: Session, Client, Abfragen). `/api/submit` macht rund 8 bis 10.
  - Bei geschätzt 90 bis 100 ms pro Roundtrip Washington↔Frankfurt (Schätzung, nicht gemessen) sind das etwa 0,8 s reine DB-Wartezeit pro Admin-Seite.
  - Das ist unabhängig vom DSGVO-Aspekt, der Fix ist derselbe (`fra1`). Zusätzlich: `getSession` pro Aufruf cachen (`React.cache`).
- **N13: Dead Config.** `Client.isActive` wird nirgends im öffentlichen Pfad gelesen (`grep`: nur Räume/Events). Ein „deaktivierter“ Standort nimmt weiter Anfragen an. Die Deaktivierung beim Downgrade ist damit nur ein Zähler, kein Sperren. Fix: `isActive` in Widget und `/api/submit` prüfen oder die Semantik dokumentieren.
- **N14: Log-Inhalte.** E-Mail-Adressen stehen in Logzeilen (`webhook/route.ts:115,122,170`, `forgot/route.ts:70`). Prisma-Fehler können Eingabewerte enthalten (`submit/route.ts` „Failed to save inquiry“, **Verdacht, nicht verifiziert**). Fix: nur Codes und IDs loggen.

## E. Info

- **I1: Kein zentraler Guard.** `proxy.ts` behandelt nur die Framer-Domain. Alle 33 Routen prüfen Authentifizierung einzeln. Geprüft: Alle nicht öffentlichen Routen rufen `getSession` (bzw. Cron-Secret, Stripe-Signatur, `PROVISIONING_SECRET`) auf. Eine neue Route ohne Guard wäre offen (kickerwulf AZ-10). Fix: gemeinsamer Wrapper.
- **I2: Cron-Auth ist in Ordnung.** Alle vier Cron-Routen nutzen `isAuthorizedCronRequest` (konstanter Vergleich, fail-closed bei fehlendem Secret). Seit 22.09. sind keine neuen Cron-Routen dazugekommen (`cleanup-rate-limits` stammt vom 21.09.). Es gibt keine Sitzungs- oder Header-Umgehung über `x-cron-secret` mehr.
- **I3: `getIp()` wird überall genutzt.** Kein direkter Zugriff auf `x-forwarded-for` außerhalb von `lib/ratelimit.ts`. `RATELIMIT_DISABLED` wird nur in `ratelimit.ts:16` gelesen und nur in `playwright.config.ts` gesetzt. Ob die Variable in der Produktion fehlt, ist unter „Manuell“ (Nr. 3). Dasselbe gilt für `STRIPE_CHECKOUT_FAKE_FOR_TESTS`, `PASSWORD_BREACH_CHECK_DISABLED` und `HIBP_API_URL`.
- **I4: Lokale Dateien.**
  - `app/zz-admin-preview/` (nicht getrackt) läuft nur im Dev-Modus. Live geprüft: `/zz-admin-preview` liefert 404.
  - `components/download.mobileconfig` (nicht getrackt, nicht unter `public/`) ist ein signiertes IMAP-Profil für `info@eventwulf.at`. Es enthält nur den Schlüssel `OutgoingPasswordSameAsIncomingPassword`, aber keinen Passwortwert.
  - `.env` (Mai) und `.env.local` zeigen auf denselben DB-Host. Manuell Nr. 4.
  - Git-Historie ohne Secrets (Scan nach `sk_`, `whsec_`, `re_`, `.env`-Dateien).
- **I5: Kein `/robots.txt` und kein `noindex`** (live 404). Widget-Seiten und `?kunde=`-URLs sind indexierbar. Kein `/api/health` (404).
- **I6: Service Worker** (`public/sw.js`) tut nichts (kein Caching), das ist unkritisch. `embed.js` und `postMessage` prüfen die Quelle des iframes (`contentWindow`), aber keine Origin, das betrifft nur das Layout.
- **Positiv bestätigt:** `JWT_SECRET` ohne Fallback, bcrypt 12, Reset- und Invite-Token 256 Bit, einmalig, Passwort-Richtlinie mit Leak-Check, `timingSafeEqual` bei Secrets, Escaping in Mails und HTML, `sanitize-html` für Beschreibungen, Advisory-Locks und atomare Kapazitätsupdates, Cross-Tenant-Scoping in `/api/submit` (IDOR-Fix vom 09.09.), Rate-Limit in Postgres statt In-Memory.

---

## F. Abhängigkeiten (Nachprüfung Punkt 5)

- **Installiert:** `next 16.3.4`, `jose 6.2.2`. Als Auth-Bibliothek dient `jose` (keine next-auth). `prisma 7.8.0`, `stripe 22.6.2`, `resend 6.12.2`, `sharp 0.35.4`.
- **Aktuell verfügbar:** `next 16.3.6`, `jose 6.2.12`, `@tiptap/react 3.31.3`.
- **`npm audit` (44 Treffer: 1 low, 33 moderate, 10 high, 0 critical):** Zu `next` gibt es keinen Eintrag für 16.3.4.

| Paket | Schwere | Genutzt? | Einordnung |
|---|---|---|---|
| `@tiptap/core` und ~30 Erweiterungen | hoch (`__proto__`-Attribute, ReDoS) | Ja, aber nur im Admin-Editor | Eingabe stammt vom eigenen Mandanten (Self-XSS-Klasse), Ausgabe wird serverseitig bereinigt. Fix verfügbar (`npm update`). Niedrig. |
| `prisma` → `@prisma/dev`, `hono`, `mysql2`, `deepmerge-ts`, `valibot` | hoch/mittel | Nur CLI und Dev-Tooling, nicht zur Laufzeit | Der vorgeschlagene Fix `prisma@6.19.3` ist ein Major-**Downgrade** und wird nicht ausgeführt (wie bei kickerwulf OP-08). Die Laufzeit nutzt PostgreSQL, nicht MySQL. |
| `resend` → `svix` → `uuid` | mittel | Webhook-Signatur von Resend, in der App nicht genutzt | nicht erreichbar |
| `brace-expansion`, `browserslist`, `js-yaml`, `fast-uri`, `baseline-browser-mapping`, `@babel/core` | hoch/mittel/niedrig | Build-Zeit | nicht Laufzeit |

- **Next.js-Advisories:** Die [GitHub-Advisory-Liste](https://github.com/vercel/next.js/security/advisories) nennt u. a. „Server-Side Request Forgery in Server Actions“, „Middleware/Proxy bypass … Turbopack“ (der Build läuft ohne Turbopack) und „Cache confusion“. Die Seite zeigt weder betroffene noch behobene Versionen. **Verdacht, nicht verifiziert:** Ob 16.3.5/16.3.6 etwas für 16.3.4 Relevantes beheben, ist offen (Manuell Nr. 12). Das App-Code nutzt keine Server Actions, `rewrites` (nur `proxy.ts` mit eigenem `fetch`) oder Edge-Runtime.
- **Nebenbefund:** `eslint-config-next 16.2.4` passt nicht zu `next 16.3.4` (nur Entwicklung).

---

## G. Datenbestand (Prisma-Schema)

| Modell | Feld | Zweck | Löschung | Bei Organisationslöschung |
|---|---|---|---|---|
| Organization | `name` | Firmenname (ggf. Person), Anzeige, Mails | nur Superadmin (`clients/route.ts:97`) | gelöscht |
| Organization | `stripeCustomerId`, `stripeSubscriptionId` | Abrechnung (pseudonym) | nein | **Stripe bleibt bestehen** |
| Organization | `bookingAppUrl`, `bookingAppKey` | Integration, Geheimnis im Klartext | mit Organisation | gelöscht |
| Organization | `subscriptionStatus`, `disputeOpenedAt`, `disputeLostAt` | Zugriffssteuerung | mit Organisation | gelöscht |
| User | `email` | Login, Reset, Einladung | Team-DELETE (`team/route.ts:171`) | gelöscht |
| User | `password` | bcrypt-Hash | mit User | gelöscht |
| User | `inviteToken`, `inviteTokenExpiresAt` | Reset/Einladung, **Klartext, nach Ablauf nicht bereinigt** | nein (nur beim Einlösen) | gelöscht |
| Client | `config` (JSON: Firmenname, Adresse, Telefon, E-Mail, Website, Logo, `notifyEmail`) | Widget, Mails, Angebote | mit Standort/Organisation | gelöscht |
| Inquiry | `data` (JSON: `nameGruppenleitung`, `email`, `telefon`, `artTitel`, `anreise`, `barrierefreiheit`, `budget`, `customFields`, Wünsche) | Anfrage, Angebot, Erinnerung | einzeln (`inquiries/route.ts:172`), **keine Frist** | gelöscht |
| Inquiry | `cancelToken`, `participantCount`, Zeitstempel | Storno, Kapazität | mit Inquiry | gelöscht |
| Invoice | `lineItems`, `notes`, `number` | Angebot (Empfänger kommt live aus Inquiry) | einzeln oder per Cascade mit Inquiry | gelöscht |
| InvoiceCounter | `id`, `counter` | Nummernkreis | nein | **bleibt** (keine Personendaten) |
| BlockedDate, Event, Room | Labels, Beschreibungen, Bilder | Geschäftsinhalte | Standort/Organisation | gelöscht; **Bilder bleiben auf Bunny** |
| UsedTrialCardFingerprint | `fingerprint` | Missbrauchsschutz für Testphase | **nie** (Absicht) | **bleibt** |
| UsedAutologinToken | `tokenHash` | Wiederverwendungsschutz | nein | bleibt (nur Hash) |
| RateLimitEntry | `key` (SHA-256 von IP bzw. E-Mail-Bezug) | Missbrauchsschutz | wöchentlicher Cron (Fenster 24 h) | bleibt bis Cron |
| extern | Resend (Mailinhalt mit Gastdaten), Stripe (Kunde), Vercel-Logs (E-Mails in Logzeilen), Neon-Backups | Versand, Abrechnung, Betrieb | nicht steuerbar aus der App | **bleiben** |

Kündigung durch den Kunden (`customer.subscription.deleted`) setzt nur `plan = basis` (`webhook/route.ts`), alle Daten bleiben unbegrenzt.

---

## H. Manuell zu prüfen (ohne Schwere)

1. **Bunny (Test-Zone, nicht Produktion):** Eigene, separate Storage-Zone anlegen und dort prüfen, ob `DELETE …/<zone>/?allowRootDelete=true`, `DELETE …/<zone>/<verzeichnis>/` und `…/a/../<verzeichnis>/` wie in H1 beschrieben wirken. In der Produktions-Zone (`BUNNY_STORAGE_ZONE`, Vercel Env): Dashboard → Storage → File Manager (Ordner je Slug, was liegt sonst dort?), Replikation und ob eine Wiederherstellung nach Löschung möglich ist. AccessKey-Rotation. **Nachtrag 26.09.:** Die Testumgebung nutzt dieselbe Bunny-Storage-Zone und sehr wahrscheinlich denselben AccessKey wie die Produktion (die `BUNNY_*`-Werte kommen über `.env.local` und `run_tests_with_env.mjs` in den Test-Server; die Variablen gibt es in Vercel nur für Production). Der Test-Server konnte damit bisher in der Produktionszone schreiben und löschen. Der Test-Isolations-Commit überschreibt diese Werte in `playwright.config.ts` mit Dummies. Solange die echten Werte in `.env.local` liegen, bleibt das Risiko für alles, was nicht über die Playwright-Config läuft.
2. **Vercel-Region und Cron:** Project → Settings → Functions → Function Region (laut Live-Header `iad1`). Project → Settings → Cron Jobs: Plan-Grenzen (stündliche Crons brauchen Pro), letzte Läufe mit Status (200/401), ob `reminders` und `event-holds` real laufen.
3. **Vercel-Env (Production):** Vorhanden sein müssen `JWT_SECRET`, `CRON_SECRET`, `SUPERADMIN_SLUG`, `PROVISIONING_SECRET`, `NEXT_PUBLIC_APP_URL`, `RESEND_API_KEY`, `STRIPE_*`, `BUNNY_*`. **Nicht** gesetzt sein dürfen `RATELIMIT_DISABLED`, `STRIPE_CHECKOUT_FAKE_FOR_TESTS`, `PASSWORD_BREACH_CHECK_DISABLED`, `HIBP_API_URL`, `TEST_DATABASE_URL*`. Environment-Scopes: Zeigt `DATABASE_URL` in **Preview** auf die Produktions-DB? Der Build führt `prisma migrate deploy` aus (`package.json`, Script `build`), das würde bei Preview-Builds Migrationen gegen Produktion laufen lassen.
4. **Neon:** Point-in-Time-Recovery-Fenster (Project → Settings → Storage/History), Datum des letzten getesteten Restores (die Migrationshistorie-Lücke aus Track B beachten). Region des Projekts (Host sagt `eu-central-1`). Test-Branch `ep-mute-pond-…`: Enthält er echte Daten aus dem Fork (M13)? Zeigen `.env` und `.env.local` auf dem Entwicklungsrechner auf die Produktions-DB (beide haben denselben Host `ep-wandering-king-…`)? Ist die Verbindung auf IPs eingeschränkt?
5. **Resend Dashboard:** Domain `eventwulf.at` verifiziert (SPF, DKIM), Logs der letzten 30 Tage auf Fehlversand (beweist oder widerlegt H4), Bounce- und Complaint-Rate, API-Key-Rechte (nur Senden), Open/Click-Tracking, Region (EU/US), AVV.
6. **DNS:** `_dmarc.eventwulf.at`, SPF (inkl. Resend und Hostinger für `info@`), DKIM, CAA. HSTS-Preload für `eventwulf.at` und `app.eventwulf.at`.
7. **Stripe Dashboard:** Webhook-Endpunkt: abonnierte Ereignistypen (nur die im Code behandelten), Zustellstatus und Fehlerrate (Konto wird mit bookingwulf geteilt). Kunden und Abos, deren Organisation per Superadmin gelöscht wurde (M5). Restricted Keys statt Vollzugriff. Ein Live-Key lag laut Kommentaren in `playwright.config.ts` und den Stripe-Specs auf dem Entwicklungsrechner. Seit 26.09. steht in `.env.local` ein `sk_test_`-Key (Präfixe geprüft: `sk_test_`, `whsec_`, `bpc_`, keine Doppelten, kein `rk_live_`/`pk_live_`). Ob das `whsec_` zum Test-Modus-Endpunkt gehört, ist im Stripe-Dashboard zu prüfen.
8. **Verträge und Rechtstexte:** AVV/DPA mit Neon, Vercel, Resend, Bunny, Stripe (SCC/DPF). AVV eventwulf ↔ Mandanten (AGB). Verarbeitungsverzeichnis und TOM. Datenschutzerklärung `eventwulf.at/legal/privacy-policy` gegen den Code abgleichen (Rollen, Unterauftragsverarbeiter, Speicherdauer, Art. 9, Kartenfingerprint, Region `iad1`). Aufbewahrungspflicht für Angebote/Rechnungen vor Löschautomatik klären.
9. **GitHub:** Repo privat, Branch-Schutz, Secret-Scanning aktiv, Zugriffsliste. Vercel-Git-Integration (manueller Deploy, siehe Memory) bewusst aus.
10. **Vercel Firewall/Logs:** Bot-Schutz oder Rate-Limit-Regeln auf `/api/submit` (ergänzt H3), Log-Retention und Log-Drains (Personendaten in Logs, N14).
11. **Superadmin-Konto:** Passwortmanager, Rotation, Notfallzugang. Nachtragsliste vom 22.09. (Memory) aus dem Chat in ein dauerhaftes System übertragen.
12. **Next.js:** Release Notes von 16.3.5 und 16.3.6 auf Fixes prüfen, die 16.3.4 betreffen.

---

## I. Neun-Punkte-Tabelle

| # | Punkt | Status | Befunde |
|---|---|---|---|
| 1 | Admin-Übernahme / Impersonation | **Befund** (Mechanismus fehlt, Umfeld schwach) | M8, M9, N6, N9 |
| 2 | Mandantentrennung (Nachprüfung) | **Befund** | H1, H2 (neue Routen seit 22.09. unauffällig) |
| 3 | Rate-Limit und IP-Quelle | **Befund** | M1, N1, I3 (Manuell Nr. 3) |
| 4 | Zeitzone | **Befund** (niedrig) | N8, N3 |
| 5 | Abhängigkeiten | **Befund** (niedrig) + Manuell | Abschnitt F, N10 (Manuell Nr. 12) |
| 6 | Mails (Resend) | **Befund** + Manuell | H3, H4, M12 (Manuell Nr. 5, 6) |
| 7 | Cron, Fehlerüberwachung, Backups | Cron **OK**, Monitoring **Befund**, Backups **Manuell** | I2, H4, N11 (Manuell Nr. 2, 4) |
| 8 | Personenbezogene Daten und DSGVO | **Befund** + Manuell | M5, M11, M12, M13, N14 (Manuell Nr. 8) |
| 9 | Vercel- und DB-Region | **Befund** + Manuell | M10, N12 (Manuell Nr. 2, 4) |

---

## J. Priorisierte Liste

**Launch-Blocker (Kritisch/Hoch):**
1. **H1** Bild-URL-Prüfung und Löschfunktion absichern. ⚡ klein, sofort wirksam. Bis dahin Bunny-Löschung abschalten. Einstufung nach der Verifikation in der Test-Zone.
2. **H2** ⚡ `id` aus `/api/availability` entfernen (klein, sofort), danach `icalToken` und Rate-Limit.
3. **H3** Bot-Schutz, Limit pro Zieladresse, Text in der Gastmail kürzen. Mittlerer Aufwand.
4. **H4** Mail-Wrapper, der `error` auswertet und Statusfelder erst nach Erfolg setzt. Error-Tracking und Health-Endpoint. Mittlerer Aufwand.
5. **H5** Preview-Werte in Vercel trennen (eigener Neon-Branch, eigene Secrets). Manuell. Sofortmaßnahme umgesetzt 26.09. (Preview-Scope entfernt, keine Preview-Deploys mehr möglich); eigene Preview-Umgebung offen.

**Vor dem Livegang dringend, weil klein:**
- ⚡ M2 `notifyEmail` aus dem Widget entfernen.
- ⚡ M3 Header auf `/signup`, `/storniert`.
- ⚡ M10 `regions: ["fra1"]` (zugleich N12).
- ⚡ M6 Vorab-Prüfung der E-Mail beim Signup.
- M4 Storno per POST mit Bestätigung.
- M12 Datenschutz/Impressum-Felder in Widget und Mails (juristisch klären).

**Kann später nachgezogen werden:** M1, M5, M7, M8, M9, M11, M13 (nach Neon-Befund einstufen), N1 bis N14, I1 (Guard-Wrapper).

---

Sources:
- [Bunny Storage: Delete File](https://bunny.net/docs/api-reference/storage/manage-files/delete-file)
- [Next.js Security Advisories](https://github.com/vercel/next.js/security/advisories)
