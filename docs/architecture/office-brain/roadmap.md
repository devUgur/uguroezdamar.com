# Office Brain – Umsetzungsroadmap

- Status: Agentenchat, Office-Präsenz und erstes persistentes Aufgabenboard umgesetzt; Organisationsverwaltung und automatische Orchestrierung folgen
- Stand: 26.11.2026
- Ziel: Aus dem bestehenden Portal und Agenten-Control-Plane schrittweise eine nachvollziehbare AI-Software-Organisation entwickeln

Diese Roadmap gilt für `uguroezdamar.com`. Sie übernimmt keine Repository-Befunde aus dem eingefügten aidevops-Text. Maßgeblich sind der aktuelle Code sowie ADR 0024, 0025 und 0026. „Vollständig“ heißt hier ein durchgängiges Produktziel in prüfbaren Stufen, nicht simulierte Rollen oder eine 3D-Szene, die nicht mit echter Ausführung verbunden ist.

## Zielbild

Ein menschlicher Owner steuert Anforderungen über das Portal. Ein klar begrenzter Control Plane verwaltet Organisation, Aufgaben, Zuweisungen, Runs, Ereignisse und Freigaben. Agenten-Runtimes sind austauschbare Ausführungsadapter. Office- und Management-Ansichten lesen dieselben gespeicherten Daten; die 3D-Ansicht ist niemals Runtime oder Datenquelle.

Der erste Betriebsumfang bleibt klein: ein Owner, die vorhandene Chef-Agent-Definition und echte Aufgaben. Rollenprofile und weitere Worker kommen erst hinzu, wenn sie eigene Fähigkeiten, Berechtigungen, Prompts, Limits und Abnahmekriterien haben.

## Bestehende Bausteine

| Bereich | Implementiert | Grenze |
| --- | --- | --- |
| Portalzugang | Admin-Session und geschützte Portalrouten | Browser erhält nie das API-Service-Token |
| Agentenruntime | `apps/api`, D1, Durable Objects, Model-/Tool-Ports, Freigaben | Nur der registrierte Chef-Agent ist derzeit ausführbar |
| Chat | `/chat`, Threads, Live-Streaming, Stop und Approval | Keine automatische Delegation an andere Rollen |
| Office | `/agents`, 2D/3D, serverautoritatives Präsenzmodell und individuelle Kamera | Visualisierung spiegelt Laufzeit und ersetzt sie nicht |
| Work | `/work`, persistente Tasks, Priorität, Kriterien, Statusübergänge und Live-Events | Noch keine Sprintplanung oder automatische Ausführung aus einer Task-Zuweisung |

Die Aufgaben liegen bei Agentenarbeit gemäß [ADR 0026](../decisions/0026-agent-work-management.md) in D1, zusammen mit den Agentenreferenzen und Events. Neon bleibt für die bestehenden Portal-Domänen zuständig. Es gibt keine zweite Kopie derselben Aufgaben.

## Sechs Umsetzungsphasen

### 1. Organisation und Agentenkatalog

**Ergebnis:** verwaltbare Abteilungen, Rollenprofile, Fähigkeiten und Agent-Definitionen; getrennt von konkreten Agent-Instanzen, Runs und Workstations.

- Bestehende `AGENTS`-Registry und D1-Instanzen inventarisieren; keine scheinbaren Mitarbeitenden aus UI-Daten erzeugen.
- Stabilen Vertrag für `department`, `role`, `reportsTo`, `capabilities`, Policy-Version und Agent-Definition festlegen.
- Definition und Instanz unterscheiden: Definition enthält Prompt-/Tool-/Modell-Policy; Instanz ist ein aktiver Runtime-Akteur mit Limits und Desk.
- Hierarchie nur als Delegationsregel behandeln, nie als implizite Berechtigung.
- Owner-geschützte Verwaltung erst nach Rollen-/Scope-Modell freischalten.

**Gate:** Katalog und Office zeigen dieselben aktiven Instanzen; jede Rolle hat belegte Aufgaben und Least-Privilege-Tools; Deaktivieren löscht weder historische Runs noch Events.

### 2. Backlog und Delivery

**Ergebnis:** eine echte Aufgabenquelle für Backlog, Ready, Umsetzung, Review, QA, Blockaden und Done.

- **Umgesetzt:** `/work` liest und schreibt Tasks über die geschützte Agenten-API; D1 ist maßgeblich.
- **Umgesetzt:** Statusübergänge werden im API-Layer validiert und als `task_created`/`task_updated` gespeichert und live verteilt.
- **Als Nächstes:** Zuweisungs- und Abhängigkeitsregeln, Epic-/Story-Beziehungen, Sprint-Ziel und Kapazität ergänzen.
- PR, Commit, CI-Lauf, Ergebnis und Blockierungsgrund als strukturierte, auditierbare Referenzen erfassen.
- Scrum-Begriffe dienen dem Arbeitsfluss; das System erzwingt keine Meetings oder Schätzwerte.

**Gate:** Board und API zeigen nach Reload/Live-Event dieselbe Datenversion; ungültige Übergänge, unbekannte Agenten und unautorisierte Schreibzugriffe werden abgewiesen.

### 3. Begrenzte Orchestrierung und Übergaben

**Ergebnis:** ein Auftrag kann nach expliziten Regeln von Intake zu Planung, Umsetzung, unabhängiger Prüfung und Rückmeldung laufen.

- Chief koordiniert; Product/Planner klären Anforderungen; Engineering Lead zerlegt Arbeit; Developer führen zugewiesene Tasks aus; Reviewer/QA prüfen unabhängig.
- Beginne sequenziell mit einem einzigen ausführbaren Agenten. Delegation/Fan-out wird erst nach messbarem Vorteil aktiviert.
- Jeder Run referenziert Task, Definition-/Prompt-Version, Modellprofil, Tool-Allowlist, Budget und Ergebnis.
- Zustandsmaschine: `queued → running ↔ waiting_approval → succeeded | failed | cancelled`; Retries sind begrenzt und idempotent.
- Übergaben sind persistierte Events mit Quell-/Zielrolle, Task-ID, erlaubtem Scope und akzeptiertem Ergebnis; keine freie Agent-zu-Agent-Chat-Schleife.
- Externe Schreibaktionen und Release bleiben menschlich freigabepflichtig.

**Gate:** Resume, Stop, Timeout, Toolfehler und doppelte Zustellung sind nachvollziehbar; der Entwickler kann nicht allein seinen eigenen Review/QA-Schritt abschließen.

### 4. Isolierte Ausführung und Workstations

**Ergebnis:** parallele Coding-Läufe ohne gemeinsamen schreibenden Workspace.

- Ein Workstation-Datensatz bindet Agent-Run, Workspace/Worktree, Branch, Ressourcenlimits und Lifecycle.
- Isolierung über bestehende GitHub-/Runner-Grenzen; kein Zugriff auf lokale Owner-Dateien oder beliebige Shell-Kommandos.
- Logs und Artefakte redigieren Secrets/PII; Retention und Cleanup sind festgelegt.
- Workstations werden nach Bedarf kurzlebig bereitgestellt und nach Ende/Abbruch bereinigt.

**Gate:** konkurrierende Läufe beeinflussen einander nicht; Cleanup nach Erfolg, Fehler und Abbruch ist belegt; Kosten und Laufzeit lassen sich je Run zuordnen.

### 5. Management, Agent-Ansicht und Office-Visualisierung

**Ergebnis:** zusammenhängende Control-Plane-Oberfläche mit drei klaren Aufgaben.

- **Office View:** Räume, Plätze und Status aus Organisations- und Präsenzdaten; Kamera und Auswahl lokal je Browser.
- **Management View:** Backlog/Sprints, Auslastung, Risiken, Kosten, Freigaben und Delivery; ohne 3D vollständig bedienbar.
- **Agent View:** Rolle, Fähigkeiten, aktueller Task/Run, Verlauf, freigegebene Tool-Spuren, Modellprofil und Limits.
- Räume/Abteilungen werden aus Daten gerendert; 2D bleibt kompakter, zugänglicher Fallback.
- Statusanimationen werden aus echten Run-/Task-Events abgeleitet und als Visualisierung kenntlich gemacht.

**Gate:** alle Ansichten referenzieren dieselben IDs/Revisionen; Screenreader-/Tastaturbedienung und schmale Viewports sind geprüft; bei API-Ausfall sind Fehler und letzte bekannte Daten klar erkennbar.

### 6. QA, DevOps und kontrollierte Lieferung

**Ergebnis:** verifizierte Artefakte und Release-Berichte, keine automatische Produktion ohne Owner-Freigabe.

- CI-Ergebnis, Review, QA, Commit und PR werden an die Task-/Run-Historie gebunden.
- Release-Agent darf Status erfassen und Vorschläge machen; Secrets, Deployment und Merge bleiben durch bestehende Freigaberegeln geschützt.
- Observability zeigt Erfolgsquote, Laufzeit, Tool-/Modellverbrauch, Retries, Blockaden und Kosten je akzeptiertem Ergebnis.
- Kostenlimits, Zeit-/Schrittlaufgrenzen, Stop und Alarmierung sind Pflicht vor Multi-Agent-Betrieb.

**Gate:** fehlgeschlagene Pflichtchecks blockieren die Lieferung; Produktionsaktionen benötigen die bestehende explizite Freigabe und sind rückverfolgbar.

## Produktarchitektur

~~~text
apps/portal
  Office UI · Management UI · Agent UI · Session/Auth · serverseitiger API-Adapter
apps/api (Cloudflare Worker)
  Control Plane · D1 Work/Org/Events · Policies · AgentRuntimePort · ModelPort · ToolPort
  Durable Objects: Thread-Runtime · LiveHub · synchronisierte OfficePresence
Neon / packages/server
  bestehende Portal-Domänen; keine zweite Kopie von Agenten-Work-Items
GitHub / CI
  Branches, Reviews, Checks und freigabepflichtige Delivery
~~~

Es wird kein zusätzliches Agentenframework, Message Broker, Graph-/Vektorspeicher oder Worker-Produkt eingeführt, bevor ein POC den konkreten Bedarf und Betriebsvorteil zeigt.

## Nächste Reihenfolge

1. Task-Board im Dev-Portal auf Erstellung, Übergänge, zwei Browser und WebSocket-Reconnect abnehmen.
2. Tasks mit den vorhandenen Agent-Threads/Runs verbinden, sodass Zuweisung und Ausführung eine echte, auditierbare Kette bilden.
3. Agent-Definitionen und Instanzen als Organisationskatalog modellieren; nur die registrierte ausführbare Instanz bleibt aktiv.
4. Reviewer-/QA-Handoff und unabhängige Abnahme ergänzen.
5. Workstation-/Worktree-Runner isoliert evaluieren; erst nach erfolgreichem POC persistente Orchestrierung erweitern.
6. Management- und Agent-Detailansicht sowie dynamische Abteilungen aus den bestätigten Datenverträgen bauen.

Produktionsdaten, Secrets, bezahlte Anbieter und Production-Deployments bleiben getrennte Owner-Entscheidungen gemäß [AGENTS.md](../../../AGENTS.md) und den gültigen ADRs.
