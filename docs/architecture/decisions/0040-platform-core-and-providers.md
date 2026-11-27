# ADR 0040: Plattform-Kern mit austauschbarer Infrastruktur

- Status: proposed (wird accepted, sobald der Owner die Punkte unter „Offene Entscheidungen“ festlegt)
- Datum: 2026-11-27
- Beteiligte: Projektverantwortlicher
- Ergänzt: [ADR 0024](0024-agent-platform-on-cloudflare.md), [ADR 0033](0033-model-providers-and-tenant-keys.md), [ADR 0036](0036-isolated-workstations-and-previews.md), [ADR 0039](0039-office-as-own-app-on-workers.md)
- Umsetzung: [Plattform-Migration](../platform-migration.md)

## Kontext

**Ziel:** Aus dem Agenten-Backend wird eine KI-Entwicklungsorganisation.
- Sie betreut mehrere Repositories mit eigenen Teams, steuerbarer Autonomie und austauschbaren Anbietern.
- Sie läuft zuerst für den Owner und soll später als Open Source selbst hostbar sein, ohne Cloudflare-Konto.

**Prüfung des Codes auf `dev` am 27.11.2026:**

| Bereich | Befund |
| --- | --- |
| Agenten-Schleife | `runtime/loop.ts` ist plattformfrei: Modell, Werkzeuge, Freigaben, Ereignisse und Budget kommen als Abhängigkeiten herein. |
| Ports | Vorhanden sind `ModelPort`, `AgentRuntimePort`, `WorkstationPort` und `Tool`. Ein Port für Datenbank, Speicher, Ereignisse, Zeitplanung, Ablauf und Secrets fehlt. |
| Datenbank | 187 direkte Aufrufe von `env.DB` (D1) in 27 Dateien, SQLite-Dialekt: 65× `unixepoch()`, `INSERT OR IGNORE`, FTS5. |
| Cloudflare-Hüllen | `agent.ts` (36 Zugriffe auf den Durable-Object-Speicher mit Alarmen), `hub.ts`, `office/presence.ts`, `knowledge/indexer.ts`, `workstation/*`. Nur diese sechs Dateien importieren `cloudflare:workers`. |
| Läuft auch ohne Cloudflare | Die Tests betreiben die API heute schon auf Node mit SQLite (`tests/_helpers/sqlite-d1.ts`), mit dem echten Fetch-Handler. |
| Modelle | 13 Anbieter: Claude, OpenAI, DeepSeek, Kimi, Mistral, Groq, xAI, Together, Fireworks, Gemini, OpenRouter, Modal, Workers AI. Eigene OpenAI-kompatible Endpunkte wie Ollama fehlen noch. |
| Team | 6 Agenten in der Registry im Code; Abteilungen, Rollen und Definitionen liegen in D1 (ADR 0027). Prompts und Werkzeuglisten sind nur im Code änderbar. |
| Freigaben | Ein Werkzeug ist freigabepflichtig (`requiresApproval`) oder nur im Projekt erlaubt (`requiresProject`); dazu gibt es Risiko-Hinweise und die Datenrichtlinie je Projekt. Autonomiestufen und ein Entscheidungsprotokoll fehlen. |
| Ausführung | Die Workstation ist gebaut, aber nicht gebunden: kein Container in `wrangler.jsonc`, Workers Paid ist nicht gebucht. Kostenloser Weg: `code_verify` über die CI. |
| Open Source | Keine `LICENSE`. `package.json` nennt ISC. Das README beschreibt noch Portal und API ohne Office. |

## Entscheidung

1. **Modularer Monolith mit Ports und Adaptern, kein Microservice-Zoo.**
   - Der Kern kennt nur Schnittstellen; Cloudflare, Node und später weitere Hosts implementieren sie.
   - Keine Paketexplosion auf Vorrat: Ein neues Paket (`packages/platform`) entsteht erst, wenn ein zweiter Host denselben Kern braucht (Phase P4). Das folgt der Regel „kein neues Paket ohne belegten Nutzen“ aus AGENTS.md.
2. **Die Ports:**

   | Port | Aufgabe | Cloudflare (heute) | Selbst gehostet |
   | --- | --- | --- | --- |
   | `SqlPort` | Relationale Daten, D1-förmig (`prepare/bind/first/all/run/batch`) | D1 | SQLite (`node:sqlite`, wie in den Tests), später PostgreSQL |
   | `KeyValuePort` | Konfiguration, Tickets, Zähler | KV | Tabelle in SQL |
   | `BlobPort` | Dateien | R2 | Dateisystem oder S3-kompatibel |
   | `ThreadStorePort` + `SchedulerPort` | Zustand und Wecker je Gespräch (heute Durable-Object-Speicher und Alarme) | Durable Object | SQLite-Tabellen und ein Prozess-Scheduler, der nach einem Neustart weiterläuft |
   | `EventBusPort` | Live-Ereignisse an Browser | `LiveHub` (Durable Object) | WebSocket-Server im Prozess |
   | `EmbeddingPort` | Vektoren für das Wissen | Workers AI + Vectorize | beliebiger Embedding-Anbieter + sqlite-vec oder pgvector |
   | `ExecutionPort` (= `WorkstationPort`) | Bauen und Testen isoliert | Cloudflare Containers | Docker |
   | `WorkflowPort` | Langlebige Abläufe (`DeliveryWorkflow`) | Cloudflare Workflows | eigener SQL-gestützter Ablauf; später Hatchet oder Temporal, wenn nötig |
   | `SecretPort` | Schlüssel lesen | Worker-Secrets | Umgebungsvariablen oder Datei |
   | `GitPort` | Repositories, Branches, PRs, Checks | GitHub App | GitHub App; GitLab und Gitea später |

3. **Datenbank-Weg:**
   - Der `SqlPort` behält die D1-Form, damit die 187 Abfragen bleiben, wie sie sind; Selbsthosting startet mit SQLite.
   - PostgreSQL für die API folgt als eigener Adapter mit Dialekt-Übersetzung, wenn mehrere Instanzen nötig werden. Das Portal nutzt PostgreSQL schon heute.
   - Anders als im Vorschlag ist PostgreSQL damit nicht Standard der ersten Stufe: Ein Umbau aller Abfragen vorab bringt dem eigenen Betrieb nichts.
4. **Policy-Engine statt einzelner Flags:**
   - Jede Aktion eines Agenten ist im Katalog mit Risikoklasse beschrieben (lesen, Branch schreiben, dev schreiben, PR, Abhängigkeiten, CI/Deploy-Konfiguration, Secrets, Produktion, destruktiv).
   - Je Projekt gilt eine Autonomiestufe: `manual`, `balanced`, `high` oder `max`.
   - Globale Grenzen kann kein Projekt aufheben: Secrets, Produktion, Löschen, `main` und Änderungen an Rechten selbst bleiben bei Freigabe oder Verbot.
   - Jede Entscheidung wird protokolliert: Policy-Version, Agent, Projekt, Aktion, Ergebnis und Begründung.
   - `requiresApproval` und `requiresProject` werden zu Einträgen dieses Katalogs.
5. **Ablauf über `WorkflowPort`:**
   - Der `DeliveryWorkflow` aus Stufe 4 wird gegen den Port geschrieben. Der erste Adapter sind Cloudflare Workflows (für die eigene Installation), der zweite ein SQL-gestützter Ablauf für Node.
   - Temporal ist für den Start zu schwer; Hatchet wird erneut geprüft, wenn der eigene Ablauf an Grenzen stößt.
6. **Agenten werden Daten:**
   - Definitionen mit versionierten Prompt-Vorlagen, Werkzeugen, Modellprofil und Skills liegen in der Datenbank. Die Registry im Code bleibt als Startbestand.
   - Teams werden je Projekt besetzt (`project_members`). Eine Rolle kann mehrfach instanziiert werden, etwa zwei Entwickler.
7. **Verträge:** Ereignisse, Aufgaben-Übergaben und Review-Ergebnisse bekommen ein Schema mit Version. Agenten sprechen über Aufgaben und Ereignisse miteinander, nicht über freie Chats.
8. **Open Source:** Erst wenn P1–P4 stehen. Dazu gehören Lizenz, README, Self-Hosting-Anleitung, `docker-compose.yml`, CONTRIBUTING, SECURITY und ein Installationsbefehl. Ob die Plattform dafür ein eigenes Repository bekommt, entscheidet der Owner dann (siehe unten).

## Offene Entscheidungen des Owners

| # | Frage | Empfehlung |
| --- | --- | --- |
| O1 | Lizenz | **Apache-2.0** (Patentklausel, firmenfreundlich). AGPL-3.0, wenn gehostete Kopien ihren Code offenlegen sollen. MIT ist am einfachsten, schützt aber am wenigsten. |
| O2 | Datenbank für selbst gehostete API in Version 1 | SQLite-Datei; PostgreSQL ab Version 2 |
| O3 | Workers Paid (5 $/Monat) für die eigene Installation | Ja, sobald der `DeliveryWorkflow` (P3) steht: Container, mehr CPU je Schritt und Workers AI über das Gratis-Kontingent hinaus |
| O4 | Standard-Autonomie für eigene Projekte | `balanced`: lesen, testen und `agent/…`-Branches automatisch, PR und dev mit Freigabe |
| O5 | Eigenes Repository und Name für die Plattform | Später, nach P4. Bis dahin im Monorepo mit sauberen Grenzen. |

## Folgen

- **Kein großer Umbau vorab:** Jede Phase liefert für sich Nutzen und bricht Office, Portal und API nicht. Die Reihenfolge steht in [platform-migration.md](../platform-migration.md).
- **Cloudflare bleibt erste Wahl für die eigene Installation**, wird aber ein Adapter unter mehreren. Neuer Code nutzt Ports; ein Lint-Wächter verbietet `cloudflare:workers` außerhalb von `apps/api/src/cloudflare/`.
- **Vorerst nicht:** Temporal, Kubernetes, ein Marktplatz-UI für Anbieter und eigene Pakete für Domain, Application und Infrastructure ohne zweiten Nutzer.
