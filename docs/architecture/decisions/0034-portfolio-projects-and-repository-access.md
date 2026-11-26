# ADR 0034: Portfolio-Projekte von Repository-Freigaben trennen

- Status: accepted
- Datum: 2026-11-26
- Beteiligte: Projektverantwortlicher
- Ergänzt: [ADR 0026](0026-agent-work-management.md), [ADR 0029](0029-projects-as-repository-access.md), [ADR 0032](0032-multi-tenant-github-connect.md)

## Kontext

Die bestehende D1-Tabelle `projects` ist kein übergeordnetes Produktprojekt. Sie repräsentiert ein einzelnes GitHub-Repository samt Agenten-Schreibregel. Mehrere Repositories können zu einem Produkt gehören, und eine Produktzuordnung darf keine GitHub- oder Agentenrechte erteilen.

## Entscheidung

1. `projects` bleibt die bestehende Repository-Freigabe mit Sichtbarkeit, Standardbranch und Schreibmodus gemäß ADR 0029.
2. `portfolio_projects` ist die übergeordnete Produktebene mit Name, Kurzbeschreibung, Status, Priorität und optimistischer Versionsnummer.
3. `portfolio_project_repositories` bildet die Viele-zu-viele-Zuordnung zwischen Portfolio-Projekten und aktiven Repository-Freigaben.
4. Work Items bleiben im D1-Control-Plane. Eine Zuordnung zu einem Produkt verleiht selbst keine zusätzliche Les-/Schreibberechtigung und ändert nicht die Repository-Grenze eines Agent-Runs.
5. Portal-Schreibaktionen erfordern eine aktive Owner-Session. Die API verlangt zusätzlich den engen Scope `portfolio:write` und prüft Zugehörigkeit sowie aktiven Status beider Datensätze.
6. Die Migration initialisiert nur das bekannte Produkt `uguroezdamar.com` und verknüpft das bereits bestehende Haupt-Repository. Weitere Produkte werden durch den Owner angelegt.
7. Erstellen, Ändern und Zuordnen werden in `portfolio_audit` mit Akteur und betroffenen IDs protokolliert; Änderungsnotizen oder Secrets werden nicht darin gespeichert.

## Alternativen

- `projects` in Produktprojekte umdeuten: abgelehnt, weil Threads, Tasks und GitHub-Schreibrechte heute daran hängen.
- Produktname als Feld an einer Repository-Zeile speichern: abgelehnt, weil ein Produkt mehrere Repositories und ein Repository mehrere Produktbeziehungen haben kann.
- GitHub Projects als alleinige Domänenquelle verwenden: zurückgestellt. Erst Zugriff, Feldvertrag, Synchronisierung und GitHub-App-Berechtigungen festlegen.

## Konsequenzen

- Migration `0020_portfolio_projects.sql` ergänzt die D1-Produktebene ohne Kopie oder Umdeutung bestehender Repository-Freigaben.
- Das Portal erhält `/portfolio`; `/projects` bleibt die Verwaltung der Repository-Freigaben.
- Status- und Prioritätssynchronisierung zu GitHub Issues/Projects, Work-Item-Beziehungen über Repositories und externe Repository-Provisionierung sind nicht Teil dieser Entscheidung.

## Rückprüfung

Neu entscheiden, sobald GitHub Issues/Projects synchronisiert, Portfolio-Projekte mandantenübergreifend geteilt oder Work Items auf mehreren Repositories ausgeführt werden sollen.
