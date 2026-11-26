# Office Brain – geplante Architekturentscheidungen

Diese Liste ist ein Entscheidungsbacklog, kein Beschluss. Erst nach Phase 0 werden einzelne ADRs mit Alternativen, Folgen, Kosten und Verifikation angelegt. Die bestehende Agentenlaufzeit und gemeinsame Bürobewegung sind bereits in [ADR 0024](../../decisions/0024-agent-platform-on-cloudflare.md) und [ADR 0025](../../decisions/0025-synchronisierte-agentenpraesenz.md) entschieden; der offene Backlog beschreibt zusätzliche Office-Brain-Module.

## Offene Entscheidungen

1. **Erster Arbeitsfall und zulässige Daten:** Welche Aufgabe darf ein Agent wirklich übernehmen und welche Daten darf er sehen?
2. **Modellprovider und Modellprofile:** Welcher Provider ist für den POC freigegeben, wo liegt der Key, welche Provider-/Modell-IDs und Obergrenzen gelten?
3. **Agentenruntime:** AI-SDK-Toolloop, Mastra, Cloudflare Agents oder ein anderer Kandidat anhand desselben POC vergleichen.
4. **Dauerhafte Ausführung:** Ab welchem Laufzeit-/Resume-Bedarf ist ein separater Worker wirtschaftlich und betrieblich gerechtfertigt?
5. **Wissensquellen und Aufbewahrung:** Welche Inhalte sind kanonisch in Git, importiert, privat, löschbar und durchsuchbar?
6. **Semantische Suche:** Erst nach Vergleich von PostgreSQL-Volltext mit einem relevanten Testsatz über pgvector/andere Optionen entscheiden.
7. **Graphdatenvertrag:** Entitäten, Edge-Typen, Provenienz und ob es nur eine Visualisierung oder später einen Workflow-Editor gibt.
8. **Kosten- und Sicherheitsfreigabe:** Maximalbudget, Freigabestufen und erlaubte externe Nebenwirkungen.

## ADR-Regel

Keine neue Bibliothek, kein neues Paket, keine Migration und kein externer Dienst wird allein aus diesem Vorschlag abgeleitet. Ein ADR nennt außerdem Besitzer, Rückprüfungsauslöser und den Weg zurück.
