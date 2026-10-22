# Betrieb, Release und Recovery

## Aktuell bekannte Ausgangslage

Das Repository enthält GitHub Actions für Lint, Typecheck, Tests und Build. Die Site nutzt Next.js; Projekttexte kommen aus Git/MDX, operative Daten aus Neon PostgreSQL. Hosting ist Vercel ([ADR 0020](../architecture/decisions/0020-vercel-hosting.md)).

## Umgebungen

- **Lokal:** Stage `dev` (eigener Neon-Branch) mit Secrets aus Infisical; siehe [Secrets und Entwicklungsumgebung](secrets.md).
- **Preview:** getrennte Zugangsdaten und Testdaten, keine Kopie echter Kontakt-/Admin-Datensätze ohne begründete Schutzmaßnahmen.
- **Produktion:** minimale DB-Rechte, verwaltete Secrets, Backups, Logs ohne PII/Secrets, definierter Rollback.

### Hosting bei Vercel

Site und Portal sind zwei Vercel-Projekte aus diesem Repository ([ADR 0020](../architecture/decisions/0020-vercel-hosting.md)). Einrichtung, Vorschau je Pull Request, Smoke-Lauf, Freigabe in die Produktion und Rollback stehen in [preview.md](preview.md).

Stand 21.10.2026: Site läuft auf Vercel-Production mit Commit `3bc31aa`; PR #29 wurde nach grüner CI via Deployment `dpl_2eqo7YyeoscLwwZxirzPgY5ZFxru` promotet. Das Portal bleibt unverändert auf Commit `f92be7d`. Öffentliche Site-Smoke-Prüfung besteht 24/24, Portal 6/6. Der neue Smoke umfasst Projektkarten, Sitemap-Routen, Canonicals, Detailseiten, Cover und ViralSync-Ziel-Link. Vorherige 404 der Projektseiten waren darauf zurückzuführen, dass die MDX-Einträge noch Drafts waren. Die Portfolio-Domain zeigt über Cloudflare-DNS direkt auf Vercel.

Der Kontakt-Endpunkt liest die Client-Adresse aus `x-vercel-forwarded-for` (`apps/site/src/lib/client-address.ts`). Das setzt voraus, dass die Domain direkt auf Vercel zeigt und kein weiterer Proxy davor liegt.

## Release-Ablauf

1. Pull Request mit Scope, Risiko, Daten-/Security-Auswirkung und Verifikation erstellen.
2. Pflichtchecks vollständig bestehen lassen.
3. Preview auf Kernrouten und – bei Contentänderungen – Publish/Unpublish prüfen.
4. Freigeben und den unveränderlichen Build/Commit deployen.
5. Smoke-Checks auf Startseite, Projekte, Blog, Kontakt und Portal-Login ausführen.
6. Release-Commit, Build-ID und Ergebnis festhalten.

Jede Produktions-/Preview-Umgebung muss Server-Routen unterstützen und `DATABASE_URL` aus Infisical erhalten (Secret Sync). Statische Export-Deploys sind mit dem festgelegten Inhaltsmodell nicht kompatibel.

## Datenmigration und Rollback

- Migrationen sind wiederholbar, protokolliert und zunächst auf einer Kopie/Preview geprüft.
- Vor destruktiven Datenänderungen gibt es ein getestetes Backup und eine Rückwegentscheidung.
- App-Rollback und Inhalts-Rollback sind getrennt beschrieben; vorherige veröffentlichte Revisionen bleiben abrufbar.
- Unvollständige Deployments oder Revalidation-Fehler markieren den Publish als fehlgeschlagen, statt falschen Erfolg zu melden.

## Kontakt- und Admin-Smoke-Checks

- Kontakt-Endpunkt: valide Anfrage speichern, invalide Anfrage, Cross-Origin-/Content-Type-/Größenprüfung, Honeypot-Fall, 429/Retry-After und DB-Fehler prüfen. Das persistente Rate-Limit zählt höchstens fünf Anfragen pro pseudonymisiertem Client-IP-Schlüssel in zehn Minuten. Der Proxy muss die Client-Adresse an den Handler durchreichen (siehe Hosting bei Vercel); die rohe Adresse wird nicht in der Rate-Limit-Tabelle persistiert. Das HMAC läuft nach etwa 70 Minuten ab und wird bei einer späteren Zählung entfernt; `CONTACT_RATE_LIMIT_SECRET` muss mindestens 32 Zeichen lang und je Stage getrennt sein. Der Request-Erfolg bestätigt ausschließlich das Speichern in der Datenbank, keinen E-Mail-Versand.
- Das Rate-Limit liegt in der Tabelle `contact_rate_limits` und wird mit einem atomaren `INSERT … ON CONFLICT` gezählt; abgelaufene Einträge werden beim nächsten Zählvorgang gelöscht. Trusted Client-IP-Header und 429-Verhalten sind noch gegen die echte Preview zu verifizieren.
- Kontaktanfragen laufen gemäß vom Owner gewählter Frist 90 Tage nach Eingang ab. Markiert der Owner sie im Portal nach Abschluss der Bearbeitung als „processed“, beginnt die 90-Tage-Frist ab diesem Zeitpunkt erneut. Unbearbeitete Nachrichten laufen spätestens 90 Tage nach Eingang ab. Abgelaufene Anfragen werden schon bei Listen und Zählerabfragen verborgen; der tägliche Cron führt zusätzlich die physische Löschung aus. `expires_at` hat eine Datenbank-Default-Frist für Rollback-Kompatibilität; die Site führt täglich den geschützten Vercel-Cron `/api/cron/purge-contact-requests` aus. Die additive Migration wurde auf Neon `dev` angewendet; PR #42 besteht den HTTP-Smoke auf Site und Portal mit 95/95. Der Cron läuft nur in Production, benötigt `CRON_SECRET` in Infisical `prod` und Vercel Production, wird bei einem Fehler nicht automatisch wiederholt und muss über Vercel Cron Logs/regelmäßige Prüfung überwacht werden. Gelöschte Datensätze können bis zum Ablauf von Datenbankbackups fortbestehen. Vor dem Promote: Migrationen `0002_minor_vision` und `0003_bored_grey_gargoyle` auf dem Neon-Produktionsbranch kontrolliert anwenden, Secret-Generierung/Sync prüfen, angemeldete Portalaktionen sowie Cron-Authentifizierung und ersten erfolgreichen Lauf im Vercel-Projekt bestätigen.
- Das geschützte Portal zeigt pro Anfrage Ablaufdatum, „Mark processed“ (setzt 90 Tage ab Bearbeitung) und unmittelbares Löschen. Löschanfragen betroffener Personen können so umgesetzt werden; Betreiber müssen Anfrage und Identität vor Löschung prüfen.
- Datenschutz- und Impressumsseiten bleiben ausdrücklich Entwürfe, bis die im [Datenschutz- und Anbieterinventar](../legal/privacy-and-provider-inventory.md) genannten Betreiber-, Rechtsgrundlagen-, Anbieter-, Log-, Mail- und Backup-Angaben bestätigt und rechtlich geprüft sind. Kein Production-Promote, der sie als final erscheinen lässt, bevor diese Gates geschlossen sind.
- Admin: erlaubte Anmeldung, abgelehnte Rolle, abgelehntes unberechtigtes Update, Logout und Invite-Ablauf prüfen.
- Niemals produktive Passwörter in Smoke-Test-Automation speichern; Testkonten besitzen nur erforderliche Rechte.

## Monitoring und Vorfälle

- Verfügbarkeit und Fehlerquote öffentlicher Site sowie geschützter Admin-/Publish-Flows beobachten.
- Alarme auf handlungsrelevante Probleme begrenzen und einen Verantwortlichen/Runbook-Verweis enthalten.
- Incident-Ablauf: Auswirkung begrenzen, betroffene Version/Revision bestimmen, zurückrollen oder Zugriff sperren, Ursache beheben, Regression prüfen, Nachbereitung dokumentieren.
- Logs enthalten Request-/Release-IDs, aber keine Passwörter, Session-Tokens, vollständigen Kontaktinhalte oder Secrets.

## Recovery-Ziel

Konkrete RTO-/RPO-Ziele werden erst festgelegt, nachdem Hosting, Datenspeicherung und Backup-Angebot bekannt sind. Vor Launch muss jedoch mindestens eine Wiederherstellung praktisch geprobt sein und das Ergebnis dokumentiert werden.
