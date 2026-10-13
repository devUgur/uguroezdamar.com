# Security-Baseline

Dieses Dokument definiert Mindestanforderungen für Admin-Portal, Kontaktfluss, Datei-Uploads und Datenzugriff. Argon2id-Hashing, Upgrade alter Hashes beim erfolgreichen Login, Invite-gebundene Kontoaktivierung, Owner-Prüfung bei Rollenänderungen und Session-Prüfung gegen aktive Konten sind im aktuellen Arbeitsstand implementiert. Unabhängige Verifikation steht noch aus.

## Identität, Authentifizierung und Autorisierung

- Jede geschützte API-Route und Serveraktion prüft Identität **und** konkrete Berechtigung serverseitig. UI-Verbergung ist keine Zugriffskontrolle.
- Rollen und erlaubte Aktionen sind zentral und deny-by-default definiert. Nutzer können weder ihre eigene Rolle noch höher privilegierte Rollen ändern, außer eine ausdrücklich geprüfte Policy erlaubt es.
- Passwortspeicherung verwendet Argon2id mit 64 MiB Speicher, drei Iterationen und einem Lane. Bestehende SHA-256-Hashes werden mit dem konfigurierten Legacy-`ADMIN_API_KEY`-Pepper geprüft und nach erfolgreichem Login aktualisiert. Wurde dieser Pepper seit der Erzeugung der alten Hashes geändert, müssen betroffene Passwörter zurückgesetzt werden.
- Bootstrap- und Invite-Secrets sind getrennt vom normalen Anmeldeablauf. Keine globale API-Key-Abkürzung für Benutzerlogin.
- Sessions sind signiert/undurchsichtig, kurz genug, widerrufbar und mit angemessenen `HttpOnly`, `Secure` (Produktion) und `SameSite`-Cookie-Einstellungen geschützt.
- Login und sensible Änderungen erhalten Rate-Limits, generische externe Fehlermeldungen und auditierbare Ereignisse ohne Geheimnisse.
- Rollenänderung, Invite, Passwortwechsel, Profiländerung und Veröffentlichung erhalten Positiv- sowie Negativtests.

## API und Eingaben

- Eingaben an jeder nicht vertrauenswürdigen Grenze mit Schema validieren; keine Client-Daten als Autorisierungsfakt verwenden.
- Das Portal nimmt keine Dateien mehr entgegen und ruft keine fremden Adressen mehr ab: Projektbild-Upload und Vorschau-Abruf sind mit dem Content-CMS entfernt ([ADR 0019](../architecture/decisions/0019-content-from-git.md)). Bilder kommen als reviewte Dateien über das Repository.
- Methoden, Herkunft/CSRF-Schutz, Request-Größe und Rate-Limits anwendungsbezogen beschränken.
- Responses geben keine internen Fehlerdetails, DB-Objekte oder Secrets preis.
- Öffentliche Endpunkte veröffentlichen nur freigegebene Felder und veröffentlichte Inhalte.

## Uploads

Derzeit gibt es keinen Upload-Endpunkt. Die folgenden Anforderungen gelten, falls wieder einer eingeführt wird.


- Authentifizierung und Upload-Berechtigung vor Speicherung prüfen.
- Größenlimit, erlaubte MIME-/Dateitypen und tatsächlichen Dateiinhalt prüfen; Dateinamen normalisieren und nie als Pfad verwenden.
- Zufällige Objekt-IDs, private Speicher-Buckets oder kontrollierte öffentliche Auslieferung einsetzen.
- Unsichere aktive Inhalte blockieren; Metadaten/EXIF nur behalten, wenn erforderlich.
- Fehlerhafte/abgebrochene Uploads und verwaiste Objekte kontrolliert bereinigen.

## Daten und Secrets

- Produktions-/Preview-Daten und Secrets trennen; Rechte minimal vergeben und Secrets regelmäßig rotieren.
- Secrets liegen ausschließlich in Infisical ([Betrieb](../operations/secrets.md)); es gibt keine `.env`-Dateien. Logs, Test-Fixtures, Screenshots, Agenten- und CLI-Ausgaben dürfen keine Geheimnisse enthalten; die Projekt-CLI gibt nur Schlüsselnamen aus.
- Kontaktanfragen minimieren, Zweck und Aufbewahrungszeit dokumentieren und Zugriff begrenzen.
- Backups verschlüsseln und Restore praktisch prüfen; Backup-Erfolg allein belegt keine Wiederherstellbarkeit.

## Vor Produktivbetrieb zu verifizieren

1. Rolle- und Admin-API-Matrix vollständig durchgehen, inklusive Self-Elevation und Owner-Schutz.
2. Passwortmigration sowie Invite-/Bootstrap-Ablauf testen.
3. Session-Widerruf, Cookie-Flags, Rate-Limits und CSRF-/Origin-Annahmen prüfen.
4. Upload-Pfade und Objektzugriffe anhand nicht autorisierter Requests testen.
5. Secret-/PII-Ausgabe in Logs und Fehlerantworten prüfen.
6. Login, Invite-Annahme, Rollenänderung und Session-Widerruf mit automatisierten Negativtests absichern.

## Umgang mit Sicherheitsbefunden

Schwere Sicherheitslücken werden vor Feature-Arbeit behoben. Reproduktion, betroffene Version, Auswirkung, Fix und Regressionstest werden in einem nicht öffentlichen Kanal dokumentiert, wenn Details einen Angriff erleichtern könnten. Keine Sicherheitsbehauptung wird allein aus einem bestandenen Build abgeleitet.
