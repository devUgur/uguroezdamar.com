# ADR 0041: Vorhaben und Planungs-Lebenszyklus

- Status: accepted
- Datum: 2026-11-27
- Beteiligte: Projektverantwortlicher
- Ergänzt: [ADR 0040](0040-platform-core-and-providers.md) (Workflow-Port, Policy-Engine), [Plan](../../product/agent-company-plan.md) Stufe 4
- Umsetzung: [Plattform-Migration](../platform-migration.md), Phase P3

## Kontext

**Bisher:**
- Der Owner legt jede Aufgabe selbst an; das Team setzt eine Aufgabe nach der anderen um (`delivery`, ADR 0040 P3).

**Gewünscht:**
- Der Owner äußert nur ein Vorhaben in eigenen Worten.
- Das Team stellt Rückfragen, erarbeitet Anforderungen und Architektur und prüft sie.
- Daraus legt es selbst Epics und Tickets mit Abhängigkeiten an, schlägt einen Sprint vor und arbeitet ihn nach Freigabe ab.
- Der Owner entscheidet nur an festen Punkten.

## Entscheidung

1. **Ein Vorhaben ist eine Aufgabe der Art `initiative`.**
   - Aufgaben bekommen eine Art (`initiative`, `epic`, `story`, `task`), eine vorgeschlagene Rolle und Abhängigkeiten (`task_dependencies`).
   - Epics hängen am Vorhaben, Stories und Tasks an Epics (`parent_id`).
   - Keine zweite Projektverwaltung neben Tafel und Sprints.
2. **Der Planungsablauf `planning`** läuft auf derselben Workflow-Engine wie `delivery`:

   | Schritt | Rolle | Ergebnis (Artefakt) |
   | --- | --- | --- |
   | Eingang | Chef | Ziel, Umfang, Annahmen; Rückfragen bei echten Lücken |
   | Anforderungen | Product Owner | Ziele, Nicht-Ziele, Nutzer, Abläufe, fachliche Regeln, Risiken |
   | Architektur | Tech Lead | Komponenten, Datenmodell, Schnittstellen, Technikentscheidungen mit Alternativen (ADR-Kandidaten), Sicherheit, Teststrategie |
   | Konzeptprüfung | QA-Reviewer | Lücken, Widersprüche, Sicherheit, Testbarkeit; bei Nacharbeit einmal zurück zur Architektur |
   | Backlog | Scrum Master | Epics und Tickets mit Zielen, Abnahmekriterien, Rolle, Story Points und Abhängigkeiten |
   | Sprintplanung | Scrum Master | Sprint mit Ziel und den ersten umsetzbaren Tickets |
   | Zusammenfassung | Chef | Gesamtkonzept und offene Entscheidungen für den Owner |

3. **Artefakte:**
   - Die vollständige Ausgabe jedes Schritts wird als versioniertes Artefakt gespeichert (`planning_artifacts`). Die folgenden Rollen lesen alle bisherigen Artefakte.
   - Die Datenbank ist dabei der Arbeitsstand. Was dauerhaft gilt, etwa ADRs, landet über ein Ticket per Pull Request im Repository: Git bleibt die Quelle der Doku.
4. **Rückfragen statt Raten:**
   - Jede Rolle kann mit `ask_owner` Fragen stellen, mit Begründung und Vorschlag.
   - Sind nach einem Schritt Fragen offen, wartet der Ablauf. Mit den Antworten läuft derselbe Schritt erneut; alle Antworten stehen in jedem weiteren Prompt.
5. **Entscheidungspunkte des Owners:**
   - Fragen beantworten.
   - **Planung freigeben:** Der Sprint wird aktiv, seine Tickets werden „Ready“.
   - Pull Requests nach der Autonomie des Projekts (ADR 0040, P2).
   - Abnahme jeder Aufgabe.
6. **Sprint-Zyklus:**
   - Nach der Freigabe startet das Team die Tickets des Sprints nacheinander als `delivery`, in der Reihenfolge der Abhängigkeiten.
   - Ist ein Ticket zur Abnahme bereit oder abgenommen, folgt das nächste.
   - Ein Sprint-Review mit Aktualisierung des Backlogs schließt den Zyklus; es folgt als nächster Ausbauschritt.
7. **Neue Rolle Scrum Master** (Rollenprofil aus ADR 0027): Er strukturiert Backlog und Sprints und schreibt keinen Code.
8. **Einstieg:**
   - Im Office „Neues Vorhaben“ im Projekt.
   - Oder im Chat zum Chef: Er startet mit `initiative_start` die Planung.

## Folgen

- **Owner-Rolle:** Der Owner beschreibt Wünsche, beantwortet Fragen, gibt die Planung frei und nimmt Ergebnisse ab. Tickets legt er nicht mehr einzeln an.
- **Kosten:** Eine Planung kostet mehrere Modellaufrufe, und die Architektur liest gründlich. Die Tagesbudgets je Mitarbeiter (Plan Stufe 2) begrenzen das.
- **Nicht jetzt:**
  - Sprint-Review und nächste Iteration automatisch.
  - Mehrere Entwickler parallel.
  - Artefakte als Dateien im Repository.
