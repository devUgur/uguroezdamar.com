# Plattform-Migration: vom Agenten-Backend zur KI-Entwicklungsorganisation

- Stand: 27.11.2026, geprüft gegen `dev` (Commit nach ADR 0039)
- Entscheidung: [ADR 0040](decisions/0040-platform-core-and-providers.md)
- Fortschritt und Stufen des Produkts: [agent-company-plan.md](../product/agent-company-plan.md)

## Grundsätze

1. **Weiterentwickeln, nicht ersetzen.** Agenten-Schleife, Registry, Modell-Router, GitHub App, Freigaben, Tafel und Office bleiben; sie werden entkoppelt, nicht neu geschrieben.
2. **Jede Phase liefert für sich Nutzen** und läuft danach auf `dev`. Office, Portal und API brechen zwischendurch nicht.
3. **Erst die eigene Firma, dann Open Source.** Dieselbe Codebasis; nur Konfiguration und Adapter unterscheiden sich.
4. **Abstraktion nur an echten Grenzen.** Ein Port entsteht, wo es einen zweiten Adapter gibt oder sicher geben wird, nicht für jede Klasse.

## Was bleibt, was sich ändert

| Modul (`apps/api/src`) | Heute | Weg |
| --- | --- | --- |
| `runtime/loop.ts`, `runtime/context.ts`, `runtime/budget.ts` | plattformfrei | bleibt, wandert in P4 nach `packages/platform` |
| `models/*` | `ModelPort`, Router, Katalog; Workers AI direkt über `env.AI` | Workers AI als Adapter; eigene OpenAI-kompatible Endpunkte (P5) |
| `tools/*` | `Tool`-Port, 20 Werkzeuge | bleibt; die Freigabelogik geht in die Policy-Engine (P2) |
| `agents/registry.ts`, `agents/settings.ts` | Definitionen im Code | Startbestand; Definitionen und Teams in der Datenbank (P3) |
| `work/*` (Tasks, Sprints) | D1 direkt | über `SqlPort` (P1); Abhängigkeiten zwischen Aufgaben (P3) |
| `approvals.ts` | Freigabe je Werkzeug | Teil der Policy-Engine (P2) |
| `agent.ts` | Durable Object mit Speicher und Alarmen | Kern `ThreadRuntime` plus Cloudflare-Hülle (P1) |
| `hub.ts`, `office/presence.ts` | Durable Objects | `EventBusPort` und Präsenz-Kern plus Hüllen (P1) |
| `knowledge/indexer.ts`, `knowledge/store.ts` | Durable Object, Vectorize, Workers AI | `SchedulerPort` und `EmbeddingPort` (P1, P5) |
| `workstation/*` | `WorkstationPort`, Cloudflare Containers (nicht gebunden) | Docker-Adapter (P4), Cloudflare-Adapter mit Workers Paid |
| `github/*` | GitHub App | `GitPort` ab einem zweiten Git-Anbieter (P5) |
| `index.ts` (Routen) | 560 Zeilen, bekommt `Env` | Routen bekommen `Platform` (P1); Aufteilung nach Modulen (P1) |

## Phase P1: Nähte ziehen (ohne Verhaltensänderung)

**Stand 27.11.2026: erledigt.**
- **`Env` ist jetzt das Bündel der Ports**, umbenannt wurde nicht. D1, KV, R2, Workers AI und Vectorize erfüllen die Ports ohne einen einzigen Cast; darum blieben alle 187 Abfragen unverändert (`env.DB` hat jetzt den Typ `SqlPort`).
- **Durable Objects** sind über `ActorDirectory` erreichbar (`env.AGENTS.get(name)`).
- **Gesprächs-Kern:** `ThreadRuntime` (`runtime/thread-runtime.ts`) ist der plattformfreie Kern des Gesprächs. Ebenso sind `OfficePresenceCore` und `KnowledgeIndexerCore` frei; sie erhalten `ActorStatePort`.
- **Hüllen:** Die Durable Objects, `LiveHub`, die Workstation, die Gateways und der Worker-Einstieg liegen in `src/cloudflare/`. Die Klassennamen sind unverändert, keine Durable-Object-Migration nötig.
- **Wächter:** `pnpm guard:no-cloudflare-outside-adapter`.
- **Beleg:** `tests/platform-seams.test.ts` betreibt Gespräch und Büro auf einer Map mit `node:sqlite` statt auf Durable Objects.

**Ziel:** Cloudflare steckt nur noch in einem Ordner. Alles andere spricht mit Ports.

**Neu:**
- `apps/api/src/platform/ports.ts`: `SqlPort` (D1-förmig), `KeyValuePort`, `BlobPort`, `ThreadStorePort`, `SchedulerPort`, `EventBusPort`, `EmbeddingPort`, `SecretPort`, und `Platform` als Bündel davon.
- `apps/api/src/cloudflare/`: `platform.ts` baut `Platform` aus `Env`. Die Durable-Object-Hüllen ziehen hierher um:
  - `agent-object.ts` (aus `agent.ts`)
  - `hub-object.ts`
  - `presence-object.ts`
  - `indexer-object.ts`
  - `workstation-object.ts`
- `apps/api/src/runtime/thread-runtime.ts`: der Teil von `agent.ts`, der Läufe staffelt, Freigaben fortsetzt und das Budget prüft. Er nutzt `ThreadStorePort` und `SchedulerPort` statt `ctx.storage`.

**Geändert:**
- **Datenbankaufrufe:** Die 27 Dateien mit `env.DB` erhalten `platform.sql`. Mechanisch: D1 erfüllt den Port bereits, die SQL-Texte bleiben gleich.
- **Durable-Object-Kennungen:** `env.CONFIG`, `env.HUB`, `env.OFFICE`, `env.AGENTS` und `env.INDEXER` laufen über die passenden Ports.
- **Einstiegspunkte:** `index.ts` und `wrangler.jsonc` verweisen auf die neuen Hüllen. Die Klassennamen der Durable Objects bleiben gleich, damit keine Migration nötig ist.
- **Testhilfe:** `tests/_helpers/api-env.ts` baut eine `Platform` aus SQLite und Speicher im Arbeitsspeicher; der Weg bleibt derselbe wie heute.

**Wächter:**
- Neuer Guard `tooling/guards/no-cloudflare-outside-adapter.mjs`: `cloudflare:workers` und `env.DB` nur in `apps/api/src/cloudflare/`.
- Der Tenancy-Guard prüft weiter die SQL-Texte.

**Abnahme:**
- Alle Tests grün, Deploy auf api-dev unverändert, Live-Chat und Office laufen wie vorher.
- `grep cloudflare:workers` trifft nur noch `apps/api/src/cloudflare/`.

**Aufwand und Risiko:** mittel; mechanisch, aber breit. Darum in drei Commits: Ports und SQL, Durable-Object-Hüllen, Guard.

## Phase P2: Policy-Engine und Autonomie je Projekt

**Stand 27.11.2026: erledigt.**
- **Katalog und Entscheidung:** `apps/api/src/policy/catalog.ts` ordnet jedem Aufruf eine Klasse zu; `engine.ts` entscheidet zwischen `allow`, `approve` und `deny`, mit Begründung und Version `POLICY_VERSION`.
  - Ein Commit wird nach Branch und Pfaden beurteilt; der riskanteste Pfad entscheidet.
  - Ein schreibendes Werkzeug, das der Katalog nicht kennt, braucht immer eine Freigabe.
- **Daten:** Migration `0024_policies.sql` mit den Tabellen `project_policies` und `policy_decisions`.
- **Routen:**
  - `GET /api/policies`: Katalog, Stufen und Stufe je Projekt.
  - `PUT /api/projects/:id/policy`: nur der Owner, mit Versionsprüfung.
  - `GET /api/policy/decisions`: das Entscheidungsprotokoll.
- **Schleife:** Die Agenten-Schleife fragt vor jedem Werkzeug die Engine.
  - Automatische Freigaben erscheinen als Ereignis `policy_allowed` im Chat.
  - Freigabekarten nennen die Regel, die gefragt hat.
- **Office:** Im Überblick steht das Widget „Autonomie“ je Projekt. Der Owner wählt die Stufe; das Widget zeigt, was allein läuft und was immer bei ihm bleibt.
- **Standard bis zur Owner-Entscheidung O4:** `manual`, also das Verhalten vor P2. Kein Projekt arbeitet selbstständiger, bevor der Owner es einstellt.

**Ziel:** Der Owner bestimmt je Projekt, wie selbstständig die Agenten arbeiten. Jede automatische Entscheidung ist nachvollziehbar.

**Neu:**
- `apps/api/src/policy/catalog.ts`: Aktionen mit Risikoklasse.

  | Aktion | Klasse | `manual` | `balanced` | `high` | `max` |
  | --- | --- | --- | --- | --- | --- |
  | Lesen, Wissen, Tests (`code_verify`) | read | auto | auto | auto | auto |
  | Commit auf `agent/…` | branch | Freigabe | auto | auto | auto |
  | Pull Request nach `dev` | pr | Freigabe | Freigabe | auto | auto |
  | Commit direkt auf `dev` | dev | Freigabe | Freigabe | Freigabe | auto |
  | Abhängigkeiten ändern | deps | Freigabe | Freigabe | Freigabe | auto mit Prüfung |
  | CI/CD- und Deploy-Konfiguration, `.github/` | pipeline | Freigabe | Freigabe | Freigabe | Freigabe |
  | Preview-Deploy | preview | Freigabe | auto | auto | auto |
  | Secrets, Produktion, `main`, Rechte, Löschen | hard | verboten oder Freigabe, **unabhängig von der Stufe** | | | |

- `apps/api/src/policy/engine.ts`: `decide(action, { agent, project, branch, paths, costEstimate })` gibt `allow`, `approve` oder `deny` mit Begründung und Policy-Version zurück.
  - Die Pfadregeln (geschützte Pfade aus `approvals.ts`) und die Datenrichtlinie (ADR 0033) fließen ein.
- **Migration** `0024_policies.sql`: `project_policies` (Stufe, Ausnahmen, Version) und `policy_decisions` (Protokoll).
- **Office:** Projekteinstellungen mit Autonomiestufe und Einzelschaltern; die Tafel zeigt automatische Entscheidungen als Ereignis.

**Geändert:**
- `runtime/loop.ts` ruft vor jedem Werkzeug die Policy-Engine. `requiresApproval` und `requiresProject` an den Werkzeugen werden zu Katalogeinträgen; die Prüfung im Loop entfällt.
- `tools/github.ts`: `repo_commit_files` meldet Branch und Pfade, damit die Engine nach Branch und Pfaden unterscheiden kann.

**Abnahme:**
- Eine Tabelle von Testfällen (Stufe × Aktion × Branch × Pfad) legt das Verhalten fest.
- Mit `balanced` committet der Entwickler auf `agent/…` ohne Rückfrage, ein PR wartet auf Freigabe, `.github/` immer.
- Jede Entscheidung steht im Protokoll und unter `/usage` beim Lauf.

## Phase P3: Ablauf und Team je Projekt (Stufe 4 des Produktplans)

**Stand 27.11.2026: Kern erledigt.**
- **Ablauf `delivery`** (`apps/api/src/workflow/`): Chef (Eingang) → Product Owner (Anforderungen, `task_refine`) → Tech Lead (Plan) → Entwickler (Umsetzung) → QA (die bestehende unabhängige Prüfung) → Chef (Bericht) → Abnahme durch Ugur auf der Tafel.
- **Schritte:** Jeder Schritt ist ein Lauf im eigenen Gespräch und bekommt die Übergaben der vorigen. Das Ende eines Laufs schaltet weiter.
- **Warten und Nacharbeit:**
  - Eine offene Freigabe hält den Schritt an.
  - QA mit „Nacharbeit“ schickt die Aufgabe bis zu zweimal zurück zur Umsetzung.
  - Danach, bei QA ohne Urteil oder einem fehlgeschlagenen Schritt, wartet der Ablauf auf Ugur („Erneut versuchen“, „Abbrechen“).
- **Erster Adapter: Zustand in SQL** (Migration `0025`: `workflow_runs`, `workflow_steps`), nicht Cloudflare Workflows.
  - **Warum:** Er läuft unverändert auf jedem Host und braucht kein weiteres Durable Object.
  - **Port:** `workflow/port.ts` beschreibt die Schnittstelle für einen späteren zweiten Adapter.
- **API:**
  - `POST /api/tasks/:id/delivery`, `…/delivery/retry`, `…/delivery/cancel`
  - `GET /api/deliveries`
  - Die Abnahme einer Aufgabe (`done`) schließt den Ablauf.
- **Office:**
  - Auf einer bereiten Aufgabe startet „Mit dem Team umsetzen“ den Ablauf.
  - Die Detailansicht zeigt jeden Schritt mit Rolle, Zustand, Übergabe und Gespräch; die Karte zeigt den Stand des Teams.
- **Vorhaben und Planung ([ADR 0041](decisions/0041-initiatives-and-planning-lifecycle.md), 27.11.2026):**
  - **Planungsablauf `planning`:** Ugur beschreibt einen Wunsch. Das Team arbeitet ihn in dieser Reihenfolge ab:
    1. Eingang (Chef)
    2. Anforderungen (Product Owner)
    3. Architektur (Tech Lead)
    4. Konzeptprüfung (QA)
    5. Backlog (neuer Scrum Master)
    6. Sprintplanung
    7. Zusammenfassung
  - **Artefakte:** Jede Ausgabe ist ein versioniertes Artefakt (`planning_artifacts`).
  - **Rückfragen:** `ask_owner` lässt den Ablauf warten; mit den Antworten läuft der Schritt erneut.
  - **Backlog:** Aufgaben haben eine Art (`initiative`, `epic`, `story`, `task`), eine Rolle und Abhängigkeiten (`task_dependencies`, Migration `0026`).
  - **Freigabe:** Danach wird der Sprint aktiv. Das Team arbeitet die Tickets nacheinander in der Reihenfolge der Abhängigkeiten ab (`continueSprint`).
  - **Office:** Bereich „Vorhaben“ mit neuem Wunsch, Rückfragen, Artefakten, Planungsstand und „Planung freigeben“.
- **Noch offen aus P3:**
  - Sprint-Review und nächste Iteration automatisch
  - `project_members` (Teams je Projekt, mehrere Entwickler parallel)
  - Agenten-Definitionen in der Datenbank
  - Besprechungen im Büro aus den Übergaben (Stufe 5)

**Ziel:** Ein Auftrag läuft vom Eingang bis zur Abnahme durch das Team, mit Übergaben statt freier Chats.

**Neu:**
- `apps/api/src/workflow/port.ts`: `WorkflowPort` mit `start`, `signal` (Freigabe, Abnahme), `status` und `cancel`.
- `apps/api/src/workflow/delivery.ts`: der `DeliveryWorkflow` als Folge von Schritten, gegen den Port geschrieben:
  1. Chef: Eingang und Plan
  2. Product Owner: Anforderungen
  3. Tech Lead: Architektur und Zerlegung in Teilaufgaben
  4. Entwickler: Umsetzung, je Teilaufgabe parallel möglich
  5. QA: Prüfung
  6. Chef: Bericht
  7. Owner: Abnahme
- `apps/api/src/cloudflare/delivery-workflow.ts`: Adapter auf Cloudflare Workflows (`step.do`, `step.waitForEvent`).
- **Migration** `0025_workflows_and_teams.sql`:
  - `workflow_runs` und `handoffs` (versionierte Übergaben: Ergebnis, Befund, nächste Rolle)
  - `task_dependencies`
  - `project_members`: Rolleninstanzen je Projekt
  - `agent_definitions` um Prompt-Vorlage, Werkzeuge, Modellprofil und Version erweitert
- **Ereignis-Verträge:** `apps/api/src/events.ts` bekommt `schemaVersion` je Typ; Übergaben sind eigene Ereignisse, die das Office als Besprechung zeigt (Stufe 5).

**Geändert:**
- `agents/registry.ts` wird zum Startbestand: Beim Deploy schreibt es fehlende Definitionen; geladen wird aus der Datenbank.
- Die Tafel im Office zeigt den Ablauf einer Aufgabe: Schritt, wer dran ist, Übergaben.

**Abnahme:** Ein kleiner Auftrag in einem Testrepository läuft auf Dev vom Eingang bis zum PR mit grüner CI. Jede Übergabe steht in `handoffs`, jeder Lauf unter `/usage`; der Owner gibt nur das frei, was die Policy verlangt.

## P4 neu: zweite Runtime

**Anlass:** Das erschöpfte Durable-Objects-Kontingent hat am 27.11.2026 den Agenten-Chat stillgelegt. Entscheidung: [ADR 0045](decisions/0045-agent-runtime-independent-of-durable-objects.md). Der zweite Host kommt deshalb vor dem Docker-Paket. Die Phasen bauen aufeinander auf. Jede ist für sich auslieferbar und ändert das Verhalten für Nutzer nicht, bis R4 umschaltet.

| Phase | Inhalt | Ergebnis |
| --- | --- | --- |
| **R0 Audit** (erledigt) | Lokale Läufe starten keine API und nutzen `API_URL` aus Infisical `dev` = api-dev auf Cloudflare (ADR 0045, Befund). | Ursache der lokalen Kontingent-Fehler geklärt |
| **R1 Lokaler Node-Host** (erledigt) | `apps/node-host`: Node 24, derselbe Fetch-Handler, `ActorDirectory` im Prozess für Threads, Hub und Office, Scheduler-Schleife statt Alarmen. `pnpm dev:office` startet ihn mit und setzt `API_URL` auf `http://localhost:3103`. Ein Integrationstest führt einen Agenten-Chat mit gesperrtem Cloudflare-Zugriff aus. | Agenten lokal ohne Cloudflare |
| **R2 Postgres lokal** (erledigt) | `SqlPort` auf PostgreSQL (Docker), Migrationen der API für Postgres, Übersetzung der SQLite-Stellen (`unixepoch()`, `INSERT OR IGNORE`, FTS5). SQLite bleibt Testhilfe. | Eine Datenbanktechnologie überall |
| **R3 ThreadStore und Scheduler** | `ThreadStorePort` (asynchron: Nachrichten, Laufzustand, Eingang, Zusammenfassung, Privat-Markierung) und `SchedulerPort` mit Aufträgen und Lease (`scheduled_jobs`). `ThreadRuntime` nutzt nur noch diese beiden Ports. Bestehende Verläufe aus Durable Objects werden beim ersten Zugriff übernommen. | Agentenläufe hostunabhängig |
| **R4 Docker Compose** | `deployments/docker/`: Node-Host, Portal, Office, Postgres; ein Befehl startet alles. Die Anbieterwahl (Betriebsart local, cloud-dev, cloud) wird an einer Stelle beim Start geprüft. | Selbsthosting-Grundlage (alte P4) |
| **R5 Cloud-Host** | Dasselbe Image auf Northflank (Test) und Railway Hobby, gemeinsames Neon Postgres. Portal und Office schalten `API_URL` nach Gesundheitsprüfung um, Rückfall auf SSE oder Polling ab der letzten Ereignis-ID. | Zweite Cloud-Runtime, Node primär |
| **R6 Cloudflare-Adapter und Failover** | Der Worker nutzt dieselbe Datenbank und denselben Scheduler, Gespräche laufen nicht mehr in Durable Objects. Werkzeuge mit Außenwirkung bekommen Idempotenzschlüssel. Probe: Cloudflare mitten im Lauf abschalten, Node übernimmt, der Host-Wechsel steht im Ereignisprotokoll. | Kein Single Point of Failure |

**Stand R1 (27.11.2026):**
- **Adapter:** Sie liegen in `apps/api/src/node/` und sind das Gegenstück zu `src/cloudflare/`:
  - `sql.ts`: `SqlPort` auf node:sqlite, Migrationen mit `_migrations`. Die Tests nutzen denselben Adapter.
  - `actors.ts`: eine SQLite-Datei je Actor. Timer ersetzen Alarme und werden nach einem Neustart neu gesetzt.
  - `hub.ts`: Live-Hub mit Einmal-Ticket und `live_presence`.
  - `storage.ts`: KV in SQLite, Dateien auf der Platte.
- **Prozess:** `apps/node-host` ist der Prozess, Node 24 mit `--experimental-transform-types`, `ws` für die WebSocket-Verbindung.
- **Lokaler Lauf:** `pnpm dev:portal` und `pnpm dev:office` starten ihn mit und setzen `API_URL` auf `http://localhost:3103`. Mit `UGUR_API=dev` geht ein lokaler Lauf bewusst an api-dev.
- **Noch nicht lokal:** Wissenssuche (kein Vektorindex, keine Workers-AI-Embeddings; kommt mit pgvector in R2), Workstation (ADR 0036) und Ausführungs-Nodes (ADR 0042). Modellschlüssel kommen aus der Umgebung oder werden im lokalen Portal eingetragen. Den Schlüssel dafür erzeugt der Host einmal je Datenordner.

**Stand R2 (27.11.2026):**
- **Übersetzung:** Der Kern schreibt weiter SQLite-SQL. `apps/api/src/postgres/dialect.ts` übersetzt jede Anweisung einmal und hält sie vor:
  - Platzhalter
  - `unixepoch()`
  - `INSERT OR IGNORE`
  - `json_object`
  - skalare `MAX`/`MIN`
  - `LIKE` → `ILIKE`
  - `? IS NULL`
  - camelCase-Aliase
  - FTS5 der Wissenssuche → `tsvector`

  `apps/api/src/postgres/sql.ts` ist der `SqlPort` für jeden Treiber.
- **Schema:** `apps/api/migrations-postgres/0000_baseline.sql` wird aus dem Endstand der SQLite-Migrationen erzeugt, mit Tabellen, Checks, Schlüsseln, Indizes und Startdaten. `pnpm --filter @ugur/node-host pg:schema` schreibt sie neu, ein Test meldet ein veraltetes Schema. Inkrementelle Postgres-Migrationen gibt es erst, wenn Postgres Daten hält (R5).
- **Node-Host:** Die Daten der API liegen jetzt in Postgres:
  - ohne Angabe in PGlite unter `apps/node-host/.data/pg`;
  - mit `NODE_HOST_DATABASE_URL` in einem Postgres in Docker (`apps/node-host/compose.yaml`, nur 127.0.0.1) oder bei Neon.

  Nur die eigenen Kleinigkeiten des Hosts bleiben in lokalem SQLite: Tickets, Caches, Actor-Dateien.
- **Tests:** `pnpm test:pg` führt die API-Tests auf PGlite aus. Am 27.11.2026 waren es 202 von 202. Die Tests schreiben ihre Testdaten über den Port (`db.exec`, `db.one`, `db.rows`), nicht mehr über SQLite direkt.
- **Offen:**
  - Ein Docker-Lauf mit postgres.js ist erst typgeprüft, nicht ausgeführt.
  - Die Reihenfolge von `NULL` in `ORDER BY` unterscheidet sich (SQLite zuerst, Postgres zuletzt).
  - `INSERT OR REPLACE` hat keine allgemeine Übersetzung.

**Bis R5 trägt:** die Verbrauchssenkung aus ADR 0025 (Nachträge 1 und 2) und, falls der Owner sie bucht, Workers Paid als Brücke (O-R4).

**Docker (alte P4)** ist jetzt R4; die Docker-Workstation folgt danach.

## Phase P4: Selbst gehostet mit Docker (aufgegangen in R4)

**Ziel:** `docker compose up` startet API, Office und Portal ohne Cloudflare-Konto.

**Neu:**
- `packages/platform`: Kern aus `apps/api/src` ohne `cloudflare/`, als TypeScript-Quellcode wie die anderen Pakete (ADR 0017). Dazu gehören Runtime, Tools, Policy, Workflow-Definitionen, Work und Modelle.
- `apps/api/src/cloudflare/` bleibt der Worker-Host.
- `apps/node-host` (Name offen): Node-24-Server mit demselben Fetch-Handler. Die Adapter:

  | Port | Adapter im Node-Host |
  | --- | --- |
  | `SqlPort` | `node:sqlite`; der Adapter aus `tests/_helpers/sqlite-d1.ts` wird Produktionscode |
  | `ThreadStorePort`, `SchedulerPort` | SQLite-Tabellen und ein Scheduler, der beim Start fällige Wecker nachholt |
  | `EventBusPort` | WebSocket im Prozess |
  | `WorkflowPort` | Schrittprotokoll in SQL, Wiederaufnahme nach Neustart |
  | `ExecutionPort` | `DockerWorkstation`: ein Container je Lauf; Netz nur über einen Proxy für GitHub (nur lesen) und npm; kein Token im Container (gleiche Regeln wie ADR 0036) |

- `deployments/docker/`: Dockerfiles, `docker-compose.yml` mit API, Office, Portal und PostgreSQL (für das Portal) und eine Beispiel-Konfiguration ohne Secrets.
- **Office auf Node:** dieselbe App mit `next start`; `API_URL` und `PORTAL_URL` aus der Umgebung.

**Abnahme:** Auf einem frischen Rechner mit Docker startet die Plattform. Ein Gespräch mit einem lokalen oder eigenen Modellschlüssel läuft, und eine Aufgabe lässt sich in der Docker-Workstation prüfen.

## Phase P5: Anbieter, Skills, Vorlagen

- **Modelle:**
  - Anbieter `custom` für beliebige OpenAI-kompatible Endpunkte (Ollama, vLLM, LM Studio) mit Basis-URL und Schlüssel je Mandant.
  - Modellprofile je Rolle; der Router trennt Anbieter, Profil und Routing-Regel.
- **Wissen:** `EmbeddingPort` mit Workers AI, OpenAI, Ollama und Voyage; Vektorspeicher sqlite-vec oder pgvector im Node-Host.
- **Skills:** `.claude/skills` und die Projekt-Skills werden versionierte Skills, die Rollen zugeordnet und in den Prompt geladen werden. Eine Quelle, kein zweites Regelwerk.
- **Projektvorlagen:** Next.js-SaaS, API-Backend, Python-KI, Monorepo, jeweils mit Team, Autonomiestufe, Skills und Workflow. `repo_create` und `project_register` können eine Vorlage anwenden (Stufe 6b).
- **Git:** `GitPort` wird aus `github/*` herausgelöst, sobald ein zweiter Anbieter (Gitea/GitLab) ansteht.
- **PostgreSQL-Adapter für die API**, wenn mehrere Instanzen gebraucht werden. Übersetzt wird:
  - `unixepoch()` → `extract(epoch …)`
  - `INSERT OR IGNORE` → `ON CONFLICT DO NOTHING`
  - FTS5 → `tsvector`

## Phase P6: Open Source

- `LICENSE` (Owner-Entscheidung O1), Lizenzfeld in allen `package.json`.
- README neu: was die Plattform ist, Schnellstart mit Docker, Cloudflare als Option, Architektur in einem Bild.
- `CONTRIBUTING.md`, `SECURITY.md` (Meldeweg, Grenzen der Agenten, Datenrichtlinie), `docs/self-hosting.md`.
- Persönliche Inhalte (`apps/site/content`, Profil) und die Plattform trennen. Wahrscheinlich wird die Plattform ein eigenes Repository mit diesem Monorepo als erster Nutzerin (Owner-Entscheidung O5).
- Installations-CLI: `pnpm ugur` bekommt `init` für Selbsthoster: Konfiguration erzeugen, Schlüssel abfragen, ohne Infisical.

## Reihenfolge und Begründung

| Phase | Wann | Warum in dieser Reihenfolge |
| --- | --- | --- |
| P1 Nähte | zuerst | Klein und mechanisch. Danach schreibt jede neue Funktion gegen Ports statt gegen Cloudflare. |
| P2 Policy | danach | Größter Nutzen für die eigene Firma: echte Autonomie je Projekt; Voraussetzung für Abläufe ohne ständige Rückfrage. |
| P3 Ablauf und Team | danach | Macht aus Einzelagenten ein Team (Stufe 4); braucht P2, damit Übergaben nicht an jeder Freigabe hängen. |
| P4 neu R0–R6 | jetzt | Ein erschöpftes Kontingent darf die Agenten nicht stilllegen (ADR 0045). Lokal zuerst, dann Postgres, dann Cloud-Host. |
| P5 Anbieter und Skills | laufend ab P3 | Einzelne Punkte (eigene Endpunkte, Skills) können früher kommen, wenn sie gebraucht werden. |
| P6 Open Source | zuletzt | Erst veröffentlichen, wenn Selbsthosting wirklich funktioniert. |

Die bisherigen Stufen des Produktplans bleiben gültig:
- Stufe 4 entspricht P3.
- Stufe 5 (Büro 2.0) läuft mit P3 mit (Besprechungen aus `handoffs`).
- Stufe 6 entspricht dem `ExecutionPort` mit beiden Adaptern.
- Stufe 6b nutzt die Projektvorlagen aus P5.
- Stufe 7 (Mandanten) bleibt nach P4.

## Was bewusst nicht passiert

- Kein zweites Agenten-Framework (Mastra, LangGraph): Die Konzepte sind übernommen, die Laufzeit bleibt eigene (Plan, Abschnitt 3.1).
- Kein Temporal und kein Kubernetes für den Start; Hatchet nur, wenn der eigene Ablauf nachweislich nicht reicht.
- Keine Pakete `domain/`, `application/`, `infrastructure/` und `providers/` auf Vorrat. Die Schichten sind Ordner in `packages/platform`, bis ein zweiter Nutzer sie braucht.
- Keine Autonomiestufe hebt die globalen Grenzen auf: Secrets, Produktion, `main`, Rechte und Löschen.
