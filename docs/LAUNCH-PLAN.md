# eventwulf: Plan bis zum Launch

Stand: 26.09.2026. Grundlage: docs/audits/VOLLAUDIT-2026-09-26.md.
Code-Arbeit: Claude Code. Dashboard- und Rechtsarbeit: Kai. Beides läuft parallel.
Vor dem Launch kein weiterer Vollaudit.

## Block 1: Sofort

Code:
- [x] H1 Teil 1: Bunny-Löschung abgeschaltet, Bild-URL pro Mandant geprüft
- [x] Test-Isolation: Dummy-Keys für Bunny und Stripe im Test-Server
- [x] H2 Teil 1: Inquiry-ID aus /api/availability entfernt
- [x] M2: nur öffentliche Konfigurationsfelder im Widget
- [x] M3: Sicherheits-Header auf allen Routen
- [x] M10: Funktionsregion fra1
- [x] Doku-Nachtrag H5 im Audit

Kai:
- [x] H5 Sofortmaßnahme (26.09.): Preview-Scope bei den sechs Variablen entfernt, Preview-Deploys schlagen bewusst fehl
- [ ] H5: eigene Preview-Umgebung (eigener Neon-Branch, eigene Secrets), erst dann wieder Preview-Deploys
- [x] Stripe-Live-Key in .env.local durch Test-Key ersetzen
- [x] Prod-SQL aus H1 im Neon-Editor ausführen, Treffer vor dem Deploy klären (26.09.: 0 Treffer)

Deploy 1, danach prüfen:
- [ ] x-vercel-id zeigt fra1::fra1
- [ ] Crons laufen erfolgreich (Vercel-Dashboard)
- [ ] Widget: Anfrage bis zum Absenden funktioniert

## Block 2: Mails und Überwachung

- [ ] H4: zentraler Mail-Wrapper, Statusfelder (sentAt, reminderSentAt) erst nach erfolgreichem Versand, Fehlversand im Admin sichtbar
- [ ] Fehlerüberwachung (Sentry), /api/health, Alarm bei Cron-Ausfall
- [ ] M4: Stornieren per Bestätigungsseite und POST, Statusübergang atomar
- [ ] M6: Signup prüft bestehende E-Mail vor der Zahlung

Deploy 2

## Block 3: Missbrauchsschutz und Abschluss H1/H2

- [ ] H3: Limit pro Zieladresse und pro Mandant, danach Bot-Schutz im Widget
- [ ] H1 Teil 2: sicheres Löschen auf Bunny wieder aktiv (Pfadprüfung beim Löschen)
- [ ] H2 Teil 2: eigener Kalender-Token statt Inquiry-ID, Rate-Limit auf /api/ical

Deploy 3

## Block 4: Track B (Kai, einmal durchgehen)

- [ ] Neon: Backup-Fenster geprüft, ein Restore einmal getestet
- [ ] Resend: Domain verifiziert, SPF/DKIM/DMARC, Fehler-Logs der letzten 30 Tage
- [ ] Stripe: abonnierte Webhook-Ereignisse und Zustellstatus, eingeschränkte Keys
- [ ] GitHub: Repo privat, Secret-Scanning aktiv
- [ ] Superadmin: starkes Passwort im Passwortmanager
- [ ] Recht: Datenschutzerklärung aktualisiert (Dienstleister, Region, Speicherdauer), AVVs mit Neon, Vercel, Resend, Bunny, Stripe
- [ ] M12: Datenschutz-Hinweis und Link im Widget und in Gast-Mails (Texte juristisch geklärt, Einbau per Code)

## Launch-Kriterium

- [ ] Blöcke 1 bis 4 erledigt
- [ ] Volle Testsuite grün
- [ ] Manueller Durchlauf auf Produktion: Anfrage stellen, bestätigen, Mail kommt an, stornieren

Dann ist eventwulf launch-bereit.

## Nach dem Launch

- Restliche Mittel/Niedrig-Punkte aus dem Audit, in dieser Reihenfolge: M1 (Login-Limit pro Konto), M7 (Team-Rollen), M8 (Änderungsprotokoll, Superadmin-2FA), M11 (Löschfristen), dann M5, M9, N-Punkte
- Vor dem ersten echten Kunden: Test-Branch schema-only neu aufsetzen (M13)
- Jedes neue Feature bekommt vor dem Deploy eine kurze Prüfung nur dieses Features
- Sentry regelmäßig anschauen
