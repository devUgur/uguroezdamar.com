# ADR 0026: Agentenarbeit und Aufgabenfluss im API-Control-Plane

- Status: accepted
- Datum: 2026-11-26
- Beteiligte: Projektverantwortlicher
- Ergänzt: [ADR 0024](0024-agent-platform-on-cloudflare.md), [ADR 0025](0025-synchronisierte-agentenpraesenz.md)

## Kontext

Das Portal soll von Chat und Office-Visualisierung zu einer nachvollziehbaren Entwicklungsorganisation wachsen. Die Agentenplattform besitzt bereits eine Cloudflare API, D1, registrierte Agenten, Threads, Events, Freigaben und eine angelegte `tasks`-Tabelle. Eine parallele Work-Datenbank in Neon würde Projekt-/Agentenreferenzen und Ereignisse über zwei Systeme verteilen, obwohl diese Aufgaben unmittelbar Agentenläufe steuern.

## Entscheidung

1. **D1 in `apps/api` ist die Quelle der Wahrheit für Agentenarbeit.** Aufgaben, Zuordnungen zu registrierten Agenten, Status und ihre Audit-Ereignisse liegen in der vorhandenen D1-Datenbank. Neon bleibt für die bestehenden Portal-Domänen zuständig; dieselben Aufgaben werden nicht doppelt gehalten.
2. **`apps/api` ist der Control Plane.** Der Browser ruft keine Agenten-API direkt mit Service-Credentials auf. Server Components und Server Actions des Portals prüfen weiterhin die Admin-Session und sprechen über `agents-api.ts` mit der API.
3. **Das Work Board zeigt persistierte Aufgaben.** Es unterstützt Backlog, Ready, In Progress, Code Review, QA, Blocked und Done, ergänzt Priorität, Beschreibung und Abnahmekriterien und validiert Statusübergänge zentral in der API.
4. **Änderungen erzeugen gespeicherte Events.** `task_created` und `task_updated` tragen Task-/Projekt-/Agent-Referenzen und den handelnden Portal-Admin. Der vorhandene Live-Hub verteilt sie; Boards lesen nach dem Ereignis erneut den autoritativen Datensatz.
5. **Organisation und Ausführung bleiben getrennt.** Der aktuelle Agentenkatalog bleibt durch die Runtime-Registry begrenzt. Ein Work-Item oder ein Avatar erzeugt keine Agenteninstanz, Workstation, Branch oder Ausführung. Automatische Delegation wird erst aktiviert, wenn eine echte Runtime-Übergabe mit Budgets, Berechtigungen, Wiederaufnahme und Abnahme implementiert ist.
6. **Die Runtime bleibt austauschbar.** Aufgaben und Events nutzen einen API-Vertrag; sie hängen weder an der 3D-Szene noch an einem bestimmten Modellanbieter oder Agentenframework.

## Alternativen

- Office-Arbeitsdaten zusätzlich in Neon spiegeln: verworfen, weil Tasks und Agenten bereits im API-Control-Plane liegen und doppelte Schreibwahrheit Konsistenzfehler erzeugt.
- Agenten/Rollen nur als 3D-Szenenobjekte modellieren: verworfen, weil die Visualisierung keine Runtime- oder Organisationsquelle sein darf.
- Sofort ein Multi-Agent-Framework oder separate Worker einführen: verworfen, bis ein konkreter, gemessener Laufzeitbedarf belegt ist.

## Folgen

- Die vorhandene D1-Tasktabelle erhält ein rückwärtsverträgliches Migrations-Upgrade. Frühere `open`-Aufgaben werden dem Backlog zugeordnet.
- Der Portalpfad `/work` liefert die erste Management-Ansicht; `/agents` bleibt die Office-Ansicht, `/chat` bleibt der Agentendialog.
- Weitere Domänen müssen einzeln entscheiden, ob sie zur Agentenarbeit (API/D1) oder zu bestehenden relationalen Portal-Daten (Neon) gehören.
- Die aktuelle Umsetzung bietet noch keine Sprintplanung, dynamische Organisationsverwaltung, automatische Agentenübergabe, isolierte Workstations oder CI/CD-Ausführung. Diese Fähigkeiten werden in getrennten Phasen ergänzt und dürfen nicht als aktiv angezeigt werden.

## Rückprüfung

Neu entscheiden, wenn Agentenarbeit ein weiteres Produkt oder eine eigene Datenzugriffs-/Aufbewahrungsgrenze benötigt, D1-Transaktions-/Abfragegrenzen nachweislich nicht reichen oder Work-Items unabhängig von der Agentenplattform betrieben werden sollen.
