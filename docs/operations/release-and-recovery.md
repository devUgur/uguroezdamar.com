# Betrieb, Release und Recovery

## Aktuell bekannte Ausgangslage

Das Repository enthält GitHub Actions für Lint, Typecheck, Tests und Build. Die Site nutzt Next.js; Projekttexte kommen aus Git/MDX, operative Daten aus Neon PostgreSQL. Hosting ist Vercel ([ADR 0020](../architecture/decisions/0020-vercel-hosting.md)).

## Umgebungen

- **Lokal:** Stage `dev` (eigener Neon-Branch) mit Secrets aus Infisical; siehe [Secrets und Entwicklungsumgebung](secrets.md).
- **Preview:** getrennte Zugangsdaten und Testdaten, keine Kopie echter Kontakt-/Admin-Datensätze ohne begründete Schutzmaßnahmen.
- **Produktion:** minimale DB-Rechte, verwaltete Secrets, Backups, Logs ohne PII/Secrets, definierter Rollback.

### Hosting bei Vercel

Site und Portal sind zwei Vercel-Projekte aus diesem Repository ([ADR 0020](../architecture/decisions/0020-vercel-hosting.md)). Einrichtung, Vorschau je Pull Request, Smoke-Lauf, Freigabe in die Produktion und Rollback stehen in [preview.md](preview.md).

Historischer Stand vom 21.10.2026: Site-Production auf Commit `3bc31aa`, Portal auf `f92be7d`; die damaligen Site-Smoke-Prüfungen bestanden 24/24 und Portal 6/6. Der Produktionsstand wurde danach über PR #42 aktualisiert.

Stand 22.10.2026: PR #42 wurde in `main` gemergt (Merge-Commit `5a31083`). Der PR führte die vereinheitlichte Portfolio-Gestaltung und die Kontaktanfrage-Aufbewahrung ein. Die Produktionsmigration für `contact_requests.expires_at` und der Promote wurden im Releaseverlauf als durchgeführt dokumentiert; der öffentliche Smoke bestand 95/95 Prüfungen. Site und Portal sind zwei Vercel-Projekte; Cloudflare-DNS zeigt direkt auf Vercel.

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
- Kontaktanfragen laufen gemäß vom Owner gewählter Frist 90 Tage nach Eingang ab. Markiert der Owner sie im Portal nach Abschluss der Bearbeitung als „processed“, beginnt die 90-Tage-Frist ab diesem Zeitpunkt erneut. Unbearbeitete Nachrichten laufen spätestens 90 Tage nach Eingang ab. Abgelaufene Anfragen werden schon bei Listen und Zählerabfragen verborgen; der tägliche Cron führt zusätzlich die physische Löschung aus. `expires_at` hat eine Datenbank-Default-Frist für Rollback-Kompatibilität. Der geschützte Vercel-Cron `/api/cron/purge-contact-requests` benötigt `CRON_SECRET`; Vercel wiederholt fehlgeschlagene Cron-Aufrufe nicht automatisch. Admin-Aufbewahrung läuft in derselben täglichen Aufgabe: abgelaufene Sessions, verwendete/abgelaufene Einladungen und Login-Versuche älter als 24 Stunden werden entfernt. Ein Cron-Ausfall verzögert physische Löschung; Monitoring und regelmäßige Prüfung des Vercel-Cron-Logs bleiben erforderlich. Gelöschte Daten können bis zum Ablauf des Neon-Recovery-Fensters in Wiederherstellungspunkten enthalten sein.
- Das geschützte Portal zeigt pro Anfrage Ablaufdatum, „Mark processed“ (setzt 90 Tage ab Bearbeitung) und unmittelbares Löschen. Löschanfragen betroffener Personen können so umgesetzt werden; Betreiber müssen Anfrage und Identität vor Löschung prüfen.
- Datenschutz- und Impressumsseiten sind nach ausdrücklicher Betreiberbestätigung vom 22.10.2026 ohne Entwurfskennzeichnung veröffentlicht. Die vom Betreiber freigegebenen Fakten und technischen Aufbewahrungswege sind im [Datenschutz- und Anbieterinventar](../legal/privacy-and-provider-inventory.md) festgehalten. Änderungen an Datenflüssen, Anbietern oder Aufbewahrungsfristen müssen vor einem weiteren Release mit den öffentlichen Hinweisen abgeglichen werden.
- Admin: erlaubte Anmeldung, abgelehnte Rolle, abgelehntes unberechtigtes Update, Logout und Invite-Ablauf prüfen.
- Niemals produktive Passwörter in Smoke-Test-Automation speichern; Testkonten besitzen nur erforderliche Rechte.

## Monitoring und Vorfälle

- Verfügbarkeit und Fehlerquote öffentlicher Site sowie geschützter Admin-/Publish-Flows beobachten.
- Alarme auf handlungsrelevante Probleme begrenzen und einen Verantwortlichen/Runbook-Verweis enthalten.
- Incident-Ablauf: Auswirkung begrenzen, betroffene Version/Revision bestimmen, zurückrollen oder Zugriff sperren, Ursache beheben, Regression prüfen, Nachbereitung dokumentieren.
- Logs enthalten Request-/Release-IDs, aber keine Passwörter, Session-Tokens, vollständigen Kontaktinhalte oder Secrets.

## Recovery-Ziel

Konkrete RTO-/RPO-Ziele werden erst festgelegt, nachdem Hosting, Datenspeicherung und Backup-Angebot bekannt sind. Vor Launch muss jedoch mindestens eine Wiederherstellung praktisch geprobt sein und das Ergebnis dokumentiert werden.
