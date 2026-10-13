# Betrieb, Release und Recovery

## Aktuell bekannte Ausgangslage

Das Repository enthält GitHub Actions für Lint, Typecheck, Tests und Build. Die Site nutzt jetzt serverseitiges Next.js statt Static Export; CMS-Routen lesen veröffentlichte Inhalte zur Laufzeit. Hosting ist Vercel ([ADR 0020](../architecture/decisions/0020-vercel-hosting.md)). Historische CI-Fehler aus dem Audit waren nicht mehr abrufbar.

## Umgebungen

- **Lokal:** Stage `dev` (eigener Neon-Branch) mit Secrets aus Infisical; siehe [Secrets und Entwicklungsumgebung](secrets.md).
- **Preview:** getrennte Zugangsdaten und Testdaten, keine Kopie echter Kontakt-/Admin-Datensätze ohne begründete Schutzmaßnahmen.
- **Produktion:** minimale DB-Rechte, verwaltete Secrets, Backups, Logs ohne PII/Secrets, definierter Rollback.

### Hosting bei Vercel

Site und Portal sind zwei Vercel-Projekte aus diesem Repository ([ADR 0020](../architecture/decisions/0020-vercel-hosting.md)). Einrichtung, Vorschau je Pull Request, Smoke-Lauf, Freigabe in die Produktion und Rollback stehen in [preview.md](preview.md).

Stand 13.10.2026: Bei Vercel ist noch nichts angelegt. `uguroezdamar.com` zeigt per DNS weiter auf Render und liefert dort den statischen Stand vom März 2026 aus; `portal.uguroezdamar.com` zeigt ebenfalls auf Render und antwortete nicht. Render bleibt unverändert, bis die neue Auslieferung geprüft und der DNS-Eintrag umgestellt ist.

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

- Kontakt-Endpunkt: valide Anfrage speichern, invalide Anfrage, Cross-Origin-/Content-Type-/Größenprüfung, Honeypot-Fall, 429/Retry-After und DB-Fehler prüfen. Das persistente Rate-Limit zählt höchstens fünf Anfragen pro pseudonymisiertem Client-IP-Schlüssel in zehn Minuten. Der Proxy muss die Client-Adresse an den Handler durchreichen (siehe Hosting bei Render); der Wert wird als IP-Adresse validiert. Das HMAC des Client-IP-Schlüssels wird nach maximal etwa 70 Minuten beim nächsten Zählvorgang entfernt; `CONTACT_RATE_LIMIT_SECRET` muss mindestens 32 Zeichen lang und je Umgebung getrennt sein. Der Request-Erfolg bestätigt ausschließlich die Speicherung in der Datenbank, keinen E-Mail-Versand.
- Das Rate-Limit liegt in der Tabelle `contact_rate_limits` und wird mit einem atomaren `INSERT … ON CONFLICT` gezählt; abgelaufene Einträge werden beim nächsten Zählvorgang gelöscht. Trusted Client-IP-Header und 429-Verhalten sind noch gegen die echte Preview zu verifizieren.
- Kontaktanfragen selbst haben aktuell keine automatische Löschfrist. Betreiber und Datenschutzverantwortliche müssen eine Aufbewahrungs- und Löschregel festlegen, bevor das Formular produktiv freigegeben wird.
- Admin: erlaubte Anmeldung, abgelehnte Rolle, abgelehntes unberechtigtes Update, Logout und Invite-Ablauf prüfen.
- Niemals produktive Passwörter in Smoke-Test-Automation speichern; Testkonten besitzen nur erforderliche Rechte.

## Monitoring und Vorfälle

- Verfügbarkeit und Fehlerquote öffentlicher Site sowie geschützter Admin-/Publish-Flows beobachten.
- Alarme auf handlungsrelevante Probleme begrenzen und einen Verantwortlichen/Runbook-Verweis enthalten.
- Incident-Ablauf: Auswirkung begrenzen, betroffene Version/Revision bestimmen, zurückrollen oder Zugriff sperren, Ursache beheben, Regression prüfen, Nachbereitung dokumentieren.
- Logs enthalten Request-/Release-IDs, aber keine Passwörter, Session-Tokens, vollständigen Kontaktinhalte oder Secrets.

## Recovery-Ziel

Konkrete RTO-/RPO-Ziele werden erst festgelegt, nachdem Hosting, Datenspeicherung und Backup-Angebot bekannt sind. Vor Launch muss jedoch mindestens eine Wiederherstellung praktisch geprobt sein und das Ergebnis dokumentiert werden.
