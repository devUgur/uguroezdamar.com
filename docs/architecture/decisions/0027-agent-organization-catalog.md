# ADR 0027: Organisationskatalog im Agenten-Control-Plane

- Status: accepted
- Datum: 2026-11-26
- Beteiligte: Projektverantwortlicher
- Ergänzt: [ADR 0024](0024-agent-platform-on-cloudflare.md), [ADR 0026](0026-agent-work-management.md)

## Kontext

Das Agentenbüro benötigt Abteilungen, Rollenprofile, Definitionen und konkrete Laufzeitinstanzen. Diese Konzepte dürfen nicht vermischt werden: ein Rollenprofil ist keine laufende Agenteninstanz, und eine Instanz ist nur dann ausführbar, wenn ein Runtime-Adapter für ihre Definition registriert ist. Agentenaufgaben und Events liegen bereits in D1 gemäß ADR 0026.

## Entscheidung

1. Organisationsdaten für die Agentenplattform liegen in derselben D1-Control-Plane wie Instanzen, Aufgaben und Events. Neon erhält keine Spiegelkopie.
2. `departments`, `role_profiles`, `agent_definitions` und `agents` sind getrennte Entitäten. Eine Agenteninstanz referenziert optional eine versionierte Definition; die Definition referenziert ein Rollenprofil.
3. Rollenprofile beschreiben Zweck, Verantwortlichkeiten und Fähigkeiten. Sie verleihen keine Laufzeit- oder Tool-Berechtigung.
4. Eine Definition ist nur ausführbar, wenn ihr `runtime_key` in der Server-Registry vorhanden ist. Portal-Katalog oder Avatar können keine Runtime registrieren.
5. Der erste Katalog enthält sieben Rollenprofile, aber nur die bereits vorhandene `chef-v1`-Definition und Chef-Agent-Instanz. Keine weiteren Mitarbeiter werden simuliert.
6. `/api/organization` liefert einen geschützten Read-Model-Endpunkt. `/organization` zeigt Katalog und echte Instanzen read-only. Änderungen an Runtime-Definitionen, Berechtigungen, Prompts und Instanzen bleiben bis zum Owner-geschützten Verwaltungs- und Scope-Modell versioniert durch Code/Migration.
7. Produktionsfreigaben, Secrets und externe Aktionen bleiben den bestehenden Freigaben und Owner-Gates unterstellt.

## Alternativen

- Agenten direkt aus Rollenprofilen dynamisch starten: verworfen, da Rollenbeschreibungen keine geprüfte Tool-Allowlist, Modellpolicy oder Laufzeit enthalten.
- Organisationsdaten in Neon halten: verworfen, weil Agenten-Control-Plane sonst Referenzen zwischen zwei schreibbaren Systemen koordinieren müsste.
- Nur TypeScript-Objekte ohne persistente IDs: verworfen, weil Management-, Office- und Task-Ansichten dieselben stabilen Organisationsreferenzen benötigen.

## Konsequenzen

- Migration `0007_organization_catalog.sql` legt Katalogtabellen an, versieht die Chef-Instanz mit `chef-v1` und ordnet `ceo` dem stabilen Profil `chief` zu.
- Die Portalroute `/organization` zeigt gespeicherte Rollen und Instanzen; nicht ausführbare Profile sind sichtbar als Profile und erzeugen keine Avatare.
- Neue Agenten werden erst aktiviert, wenn Registry-Auflösung, Least-Privilege-Tools, Limits, Berechtigungen, Arbeitszuweisung und Abnahme gemeinsam implementiert sind.
- Schreibende Organisationsverwaltung ist noch nicht verfügbar. Vor dieser Erweiterung ist ein Rollen-/Scope-Vertrag mit Audit-Ereignissen zu ergänzen.

## Rückprüfung

Neu entscheiden, sobald mehrere echte Runtime-Definitionen oder Instanzen eingeführt werden, oder wenn Organisationsdaten eine andere Aufbewahrungs-/Zugriffsgrenze als D1 erhalten.
