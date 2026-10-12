# Betrieb, Release und Recovery

## Aktuell bekannte Ausgangslage

Das Repository enthält GitHub Actions für Lint, Typecheck, Tests und Build. Die Site nutzt jetzt serverseitiges Next.js statt Static Export; CMS-Routen lesen veröffentlichte Inhalte zur Laufzeit. Netlify ist primäres Ziel. Das Render-Blueprint ist auf denselben Serverbetrieb angepasst, aber als alternative Umgebung zu behandeln. Historische CI-Fehler aus dem Audit waren nicht mehr abrufbar.

## Umgebungen

- **Lokal:** synthetische oder isolierte Daten; `.env.example` dokumentiert Namen und sichere Beispielwerte.
- **Preview:** getrennte Zugangsdaten und Testdaten, keine Kopie echter Kontakt-/Admin-Datensätze ohne begründete Schutzmaßnahmen.
- **Produktion:** minimale DB-Rechte, verwaltete Secrets, Backups, Logs ohne PII/Secrets, definierter Rollback.

## Release-Ablauf

1. Pull Request mit Scope, Risiko, Daten-/Security-Auswirkung und Verifikation erstellen.
2. Pflichtchecks vollständig bestehen lassen.
3. Preview auf Kernrouten und – bei Contentänderungen – Publish/Unpublish prüfen.
4. Freigeben und den unveränderlichen Build/Commit deployen.
5. Smoke-Checks auf Startseite, Projekte, Blog, Kontakt und Portal-Login ausführen.
6. Release-Commit, Build-ID und Ergebnis festhalten.

Jede Produktions-/Preview-Umgebung muss Server-Routen unterstützen und eine passende `MONGODB_URI` konfigurieren. Statische Export-Deploys sind mit dem festgelegten Inhaltsmodell nicht kompatibel.

## Datenmigration und Rollback

- Migrationen sind wiederholbar, protokolliert und zunächst auf einer Kopie/Preview geprüft.
- Vor destruktiven Datenänderungen gibt es ein getestetes Backup und eine Rückwegentscheidung.
- App-Rollback und Inhalts-Rollback sind getrennt beschrieben; vorherige veröffentlichte Revisionen bleiben abrufbar.
- Unvollständige Deployments oder Revalidation-Fehler markieren den Publish als fehlgeschlagen, statt falschen Erfolg zu melden.

## Kontakt- und Admin-Smoke-Checks

- Kontakt-Endpunkt: valide Anfrage, invalide Anfrage, Spam-/Honeypot-Fall und Zustellungsfehler prüfen.
- Admin: erlaubte Anmeldung, abgelehnte Rolle, abgelehntes unberechtigtes Update, Logout und Invite-Ablauf prüfen.
- Niemals produktive Passwörter in Smoke-Test-Automation speichern; Testkonten besitzen nur erforderliche Rechte.

## Monitoring und Vorfälle

- Verfügbarkeit und Fehlerquote öffentlicher Site sowie geschützter Admin-/Publish-Flows beobachten.
- Alarme auf handlungsrelevante Probleme begrenzen und einen Verantwortlichen/Runbook-Verweis enthalten.
- Incident-Ablauf: Auswirkung begrenzen, betroffene Version/Revision bestimmen, zurückrollen oder Zugriff sperren, Ursache beheben, Regression prüfen, Nachbereitung dokumentieren.
- Logs enthalten Request-/Release-IDs, aber keine Passwörter, Session-Tokens, vollständigen Kontaktinhalte oder Secrets.

## Recovery-Ziel

Konkrete RTO-/RPO-Ziele werden erst festgelegt, nachdem Hosting, Datenspeicherung und Backup-Angebot bekannt sind. Vor Launch muss jedoch mindestens eine Wiederherstellung praktisch geprobt sein und das Ergebnis dokumentiert werden.
