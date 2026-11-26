# ADR 0030: Owner-geschützte Organisationsverwaltung

- Status: accepted
- Datum: 2026-11-26
- Beteiligte: Projektverantwortlicher
- Ergänzt: [ADR 0027](0027-agent-organization-catalog.md), [ADR 0024](0024-agent-platform-on-cloudflare.md)

## Kontext

Der Organisationskatalog ist persistent, aber bisher nur lesbar. Änderungen brauchen einen einzigen autoritativen Speicher, nachvollziehbare Versionen, ausdrückliche Owner-Berechtigung und Schutz vor versehentlichem Verlust aktiver Arbeit. Rollenbeschreibungen dürfen keine Runtime- oder Tool-Berechtigung erzeugen.

## Entscheidung

1. `/organization/manage` ist nur für aktive Portal-Owner erreichbar. Die Server Action prüft die aktuelle Admin-Session und Rolle erneut; der Browser erhält weder API-Service-Token noch Schreib-Scope.
2. Der Portalserver leitet für diese Aktionen ausschließlich den begrenzten Scope `organization:write` an die authentisierte Agenten-API weiter. Die API verlangt zusätzlich immer das bestehende Bearer-Service-Token und prüft den Scope für jede Mutation.
3. Rollenprofile können angelegt und geändert, aber nicht gelöscht werden. Änderungen verlangen die erwartete Version, erhöhen die Profilversion und schreiben Vorher-/Nachher-Zustand sowie Akteur atomar in `organization_audit`.
4. Bestehende, in der Runtime-Registry bekannte Instanzen können umbenannt, umplatziert oder deaktiviert werden. Versionsvergleich verhindert Lost Updates; auditierte Vorher-/Nachher-Zustände bleiben erhalten. Instanzen mit laufenden Tasks/Reviews können nicht deaktiviert werden; der einzige Coding-Agent bleibt aktiv.
5. Agent-Definitionen, Modellprofile, Prompts, Tool-Allowlist, Budgets, neue Runtime-Instanzen und harte Löschungen sind nicht über diese Oberfläche veränderbar. Neue Profile bleiben nicht ausführbar, bis eine separate Codeprüfung und Registrierung erfolgt.
6. Der Katalog und das Portal zeigen die aktuelle Version. Owner sehen die letzten 50 Organisationsänderungen; Live-Events signalisieren Aktualisierungen an offene Ansichten.

## Alternativen

- Rolle oder Runtime aus Portalformularen frei ausführbar machen: verworfen, weil Beschreibung und Berechtigung getrennte Vertrauensgrenzen haben.
- Profile hart löschen: verworfen, weil Definitionen, Aufgaben und historische Ereignisse stabile Referenzen benötigen.
- Last-write-wins: verworfen; die erwartete Version führt bei konkurrierenden Änderungen zu `409` statt stillem Überschreiben.
- Scope allein als Berechtigung nutzen: verworfen; der Scope ist nur bei gültigem Portal-Service-Token vertrauenswürdig und wird im Portal aus der aktiven Owner-Session abgeleitet.

## Konsequenzen

- Migration `0010_organization_management.sql` ergänzt Mutationsversionen und ein unveränderliches D1-Auditlog.
- Das Management verändert keine Runtime-Policy. Sicherheitsrelevante Ausführungsänderungen bleiben Code, Review und Deployment vorbehalten.
- Die Dev-Abnahme muss Versionskonflikte, fehlende Scope-Header, aktive Runs und Zwei-Browser-Aktualisierung prüfen.

## Rückprüfung

Neu entscheiden, wenn feinere Rollen als `owner`/`admin` verwaltet werden müssen, Rollen Delegationsregeln erhalten oder Instanzen sicher on-demand erstellt werden können.
