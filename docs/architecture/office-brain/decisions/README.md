# Office Brain – geplante Architekturentscheidungen

Diese Liste ist ein Entscheidungsbacklog, kein Beschluss. Die Agentenlaufzeit, gemeinsame Bürobewegung, Agentenarbeit, Organisationskatalog und unabhängige QA im API-Control-Plane sind in [ADR 0024](../../decisions/0024-agent-platform-on-cloudflare.md), [ADR 0025](../../decisions/0025-synchronisierte-agentenpraesenz.md), [ADR 0026](../../decisions/0026-agent-work-management.md), [ADR 0027](../../decisions/0027-agent-organization-catalog.md) und [ADR 0028](../../decisions/0028-independent-agent-qa.md) entschieden.

## Offene Entscheidungen

1. **Erster ausführbarer Arbeitsfall:** Task-/Thread-/Run-Verknüpfung, erlaubte Daten und menschliche Abnahme konkret festlegen.
2. **Organisationsmodell:** Definitionen, Rollen, Instanzen, Vorgesetztenbeziehung und Rechtevertrag vor schreibbarer Verwaltung festlegen.
3. **Agentenübergabe:** Events, Idempotenz, Retry/Resume und Gate bei Mehr-Agenten-Zuweisungen spezifizieren.
4. **Isolierte Workstation:** Runner-Kandidat, Repository-Rechte, Workspace-Isolation und Cleanup anhand eines begrenzten POC vergleichen.
5. **Wissensquellen und Aufbewahrung:** Git-Referenzen, private Quellen, Versionen und Zugriffsscope bestimmen.
6. **Semantische Suche:** Erst nach Qualitätsvergleich von PostgreSQL-Volltext mit echtem Fragensatz über pgvector/andere Optionen entscheiden.
7. **Graphdatenvertrag:** Entitäten, Edge-Typen, Provenienz und reine Visualisierung vs. Workflow-Editor festlegen.
8. **Kosten- und Sicherheitsfreigabe:** Run-/Zeitraumbudget, Freigabestufen und erlaubte externe Nebenwirkungen festlegen.

## ADR-Regel

Keine neue Bibliothek, kein neues Paket, keine Migration und kein externer Dienst wird allein aus diesem Vorschlag abgeleitet. Ein ADR nennt außerdem Besitzer, Rückprüfungsauslöser und den Weg zurück.
