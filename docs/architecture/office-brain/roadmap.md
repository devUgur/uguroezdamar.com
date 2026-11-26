# Office Brain – Umsetzungsroadmap

- Status: Agentenchat, Office-Präsenz, Aufgabenboard, Projektkatalog und owner-geschützte Organisationsverwaltung umgesetzt; automatische Orchestrierung folgt
- Stand: 26.11.2026
- Ziel: Aus dem bestehenden Portal und Agenten-Control-Plane schrittweise eine nachvollziehbare AI-Software-Organisation entwickeln

Diese Roadmap gilt für `uguroezdamar.com`. Sie übernimmt keine Repository-Befunde aus dem eingefügten aidevops-Text. Maßgeblich sind der aktuelle Code sowie ADR 0024, 0025 und 0026. „Vollständig“ heißt hier ein durchgängiges Produktziel in prüfbaren Stufen, nicht simulierte Rollen oder eine 3D-Szene, die nicht mit echter Ausführung verbunden ist.

## Zielbild

Ein menschlicher Owner steuert Anforderungen über das Portal. Ein klar begrenzter Control Plane verwaltet Organisation, Aufgaben, Zuweisungen, Runs, Ereignisse und Freigaben. Agenten-Runtimes sind austauschbare Ausführungsadapter. Office- und Management-Ansichten lesen dieselben gespeicherten Daten; die 3D-Ansicht ist niemals Runtime oder Datenquelle.

Der erste Betriebsumfang bleibt klein: ein Owner, der Chef-Agent für Umsetzung und ein read-only QA-Reviewer für unabhängige Prüfung. Planungsrollen sind im Katalog sichtbar, aber noch nicht ausführbar.

## Bestehende Bausteine

| Bereich | Implementiert | Grenze |
| --- | --- | --- |
| Portalzugang | Admin-Session und geschützte Portalrouten | Browser erhält nie das API-Service-Token |
| Agentenruntime | `apps/api`, D1, Durable Objects, Model-/Tool-Ports, Freigaben | Chef-Agent und read-only QA-Reviewer sind registriert; Planungsrollen führen keine Runs aus |
| Chat | `/chat`, Threads, Live-Streaming, Stop und Approval | Keine freie oder automatische Delegation; Task-Review ist ein expliziter eigener Start |
| Office | `/agents`, 2D/3D, serverautoritatives Präsenzmodell und individuelle Kamera | Visualisierung spiegelt Laufzeit und ersetzt sie nicht |
| Work | `/work`, persistente Tasks, Priorität, Abnahmekriterien, Statusübergänge, Owner-Abnahmen und Live-Events; Ready startet Chef, Review startet read-only QA mit eigener Historie | Noch keine Sprintplanung, parallele Developer-Delegation oder isolierte Workstation |

Die Aufgaben liegen bei Agentenarbeit gemäß [ADR 0026](../decisions/0026-agent-work-management.md) in D1, zusammen mit den Agentenreferenzen und Events. Neon bleibt für die bestehenden Portal-Domänen zuständig. Es gibt keine zweite Kopie derselben Aufgaben.

## Sechs Umsetzungsphasen

### 1. Organisation und Agentenkatalog

**Ergebnis:** verwaltbare Abteilungen, Rollenprofile, Fähigkeiten und Agent-Definitionen; getrennt von konkreten Agent-Instanzen, Runs und Workstations.

- **Umgesetzt:** D1 führt Abteilungen, versionierte Rollenprofile, versionierte Agent-Definitionen und Agent-Instanzen getrennt; `/api/organization` ist geschützt.
- **Umgesetzt:** `/organization` zeigt read-only Rollenprofile und echte Instanzen. Nur Definitionen mit bekanntem Registry-Key werden als ausführbar ausgewiesen.
- **Umgesetzt:** Chef ist als `chef-v1` dem stabilen Rollenprofil `chief` zugeordnet; weitere Profile erzeugen weder Instanzen noch Office-Avatare.
- **Umgesetzt:** `reviewer` ist als `qa-reviewer-v1` mit separater Agenteninstanz registriert; nur explizite Lese-Werkzeuge, eigener Thread und Budget.
- **Umgesetzt:** Owner-geschützte Verwaltung auf `/organization/manage`: Profiländerungen erzeugen neue Versionen, Rollenprofile bleiben nicht ausführbar, registrierte Instanzen lassen sich begrenzt pflegen. API-Scopes, Optimistic Concurrency und Vorher-/Nachher-Audit sind serverseitig erzwungen; aktive Arbeit blockiert Deaktivierungen.
- Als Nächstes: Dev-Abnahme der Versionskonflikte, Scope-Grenzen, aktiven Runs und Aktualisierung in zwei Browsern; Audit-Retention und Paginierung festlegen, sobald das tatsächliche Änderungsvolumen messbar ist.
- Stabilen Vertrag für `department`, `role`, `reportsTo`, `capabilities`, Policy-Version und Agent-Definition erweitern, sobald echte Delegation die Beziehungen benötigt.
- Definition und Instanz unterscheiden: Definition enthält Prompt-/Tool-/Modell-Policy; Instanz ist ein aktiver Runtime-Akteur mit Limits und Desk.
- Hierarchie nur als Delegationsregel behandeln, nie als implizite Berechtigung.
- Keine Runtime-Policy oder zusätzliche Tools über die Organisationsverwaltung freischalten; dafür bleibt ein separates Code-/Review-Gate nötig.

**Gate:** Katalog und Office zeigen dieselben aktiven Instanzen; jede ausführbare Rolle hat belegte Aufgaben und Least-Privilege-Tools; Deaktivieren löscht weder historische Runs noch Events.

### 2. Backlog und Delivery

**Ergebnis:** eine echte Aufgabenquelle für Backlog, Ready, Umsetzung, Review, QA, Blockaden und Done.

- **Umgesetzt:** `/work` liest und schreibt Tasks über die geschützte Agenten-API; D1 ist maßgeblich.
- **Umgesetzt:** Statusübergänge werden im API-Layer validiert und als `task_created`/`task_updated` gespeichert und live verteilt.
- **Umgesetzt:** Eine bereite Aufgabe kann an den registrierten Chef-Agenten übergeben werden. Task, Thread, Approval und Agenten-Events tragen dieselbe Task-ID; Erfolg geht in Review, Fehler/Stop in Blocked.
- **Umgesetzt:** `review` kann ausschließlich über die QA-Route an einen eigenen Reviewer-Thread übergeben werden. Review-Ausgaben, Findings, Evidence und Task-Referenzen werden persistiert.
- **Umgesetzt:** QA kann weder `Done` setzen noch `qa` vortäuschen. Owner-Abschluss benötigt eine begründete Notiz; bei fehlender QA-Evidenz ist manuelle Abnahme möglich.
- **Als Nächstes:** Zuweisungs- und Abhängigkeitsregeln, Epic-/Story-Beziehungen, Sprint-Ziel und Kapazität ergänzen.
- PR, Commit, CI-Lauf, Ergebnis und Blockierungsgrund als strukturierte, auditierbare Referenzen erfassen.
- Scrum-Begriffe dienen dem Arbeitsfluss; das System erzwingt keine Meetings oder Schätzwerte.

**Gate:** Board und API zeigen nach Reload/Live-Event dieselbe Datenversion; ungültige Übergänge, unbekannte Agenten und unautorisierte Schreibzugriffe werden abgewiesen.

### 3. Begrenzte Orchestrierung und Übergaben

**Ergebnis:** ein Auftrag kann nach expliziten Regeln von Intake zu Planung, Umsetzung, unabhängiger Prüfung und Rückmeldung laufen.

- **Umgesetzt, begrenzter Ablauf:** Chef implementiert, dann startet der Owner explizit den read-only Reviewer. Product/Planner, Engineering Lead und weitere Developer sind noch nicht ausführbar.
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

1. Task/Run, QA und Organisationsverwaltung in API-Dev mit echtem Modell, PR-Diff, CI-Status, Scope-/Versionskonflikten, Fehler/Stop und Zwei-Browser-Live-Pfad abnehmen.
2. Isolierte Workstation-/Worktree-Runner evaluieren; parallele Coding-Runs erst nach erfolgreichem Isolation-POC aktivieren.
3. Work-Items um echte PR-/Commit-/CI-Referenzen und Abhängigkeiten ergänzen.
4. Product/Planning und Tech-Lead-Rollen mit strukturierten Übergaben umsetzen; zuerst sequenziell und mit Begrenzungen.
5. Management-/Agent-Detailansichten sowie Kosten- und Delivery-Metriken aus echten Runs ergänzen.

Produktionsdaten, Secrets, bezahlte Anbieter und Production-Deployments bleiben getrennte Owner-Entscheidungen gemäß [AGENTS.md](../../../AGENTS.md) und den gültigen ADRs.
