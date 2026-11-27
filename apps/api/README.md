# apps/api

Agenten-Backend des Admin-Portals: Threads, Agentenschleife, Modelle, Werkzeuge, Freigaben, Live-Events. Cloudflare Worker, Free Plan ([ADR 0024](../../docs/architecture/decisions/0024-agent-platform-on-cloudflare.md)). Die Oberfläche ist die Office-App (`apps/office`, ADR 0039) mit Büro und Chats; der Worker selbst hat keine.

| Pfad | Zweck |
| --- | --- |
| `src/platform/ports.ts` | Die Ports des Kerns (ADR 0040): `SqlPort`, `KeyValuePort`, `BlobPort`, `ActorStatePort`, `ActorDirectory`, `VectorIndexPort`, `InferencePort`. `src/env.ts` bündelt sie mit Konfiguration und Secrets. |
| `src/cloudflare/` | Der einzige Ort mit Cloudflare-Code: Worker-Einstieg (`worker.ts`), Ports aus den Bindings (`platform.ts`), Durable-Object-Hüllen für Gespräche, Büro und Wissen, `LiveHub`, Workstation-Container und Gateways. Ein Wächter (`pnpm guard`) verbietet Cloudflare-Typen außerhalb. |
| `src/index.ts` | HTTP-API (`/api/*`), Threads, Freigabe-Entscheidungen; auf jedem Host derselbe Fetch-Handler |
| `src/auth.ts` | Service-Token des Portals, fail closed |
| `src/runtime/thread-runtime.ts` | `ThreadRuntime`: ein Gespräch, führt Aufträge in Etappen aus; Zustand und Wecker über `ActorStatePort` (auf Cloudflare ein Durable Object je Thread) |
| `src/runtime/` | `AgentRuntimePort`, die Schleife ohne Cloudflare-APIs (`loop.ts`), Subrequest-Budget pro Etappe, Context Builder (`context.ts`): laufender Lauf vollständig, davor Zusammenfassung plus zehn Nachrichten |
| `src/approvals.ts` | Text, Risiko und Ablauf der Freigaben; geschützte Pfade |
| `src/workflow/` | Team-Ablauf je Aufgabe (ADR 0040, P3): Schritte und Rollen (`delivery.ts`), Start eines Schritts mit den Übergaben (`steps.ts`), Steuerung in SQL (`engine.ts`, Migration `0025`), Port für weitere Adapter |
| `src/policy/` | Policy-Engine (ADR 0040, P2): Aktionskatalog mit Risikoklassen, Autonomiestufen `manual`, `balanced`, `high` und `max`, globale Grenzen, Entscheidung und Protokoll (Migration `0024`) |
| `src/cloudflare/hub-object.ts` | `LiveHub`: verteilt Events und gestreamten Text per WebSocket, Einmal-Tickets |
| `src/events.ts` | Event-Log in D1, Tagesbudget |
| `src/models/` | `ModelPort`, Router mit Fallback, Modellwahl je Thread und je Rolle, Katalog aller Anbieter, Adapter (Anthropic über das SDK, OpenAI-kompatibel, Workers AI), verschlüsselte Schlüssel je Mandant ([ADR 0033](../../docs/architecture/decisions/0033-model-providers-and-tenant-keys.md)) |
| `src/work/sprints.ts` | Sprints je Projekt; Aufgaben tragen `sprint_id` |
| `src/knowledge/` | Wissensindex je Projekt (Doku und erledigte Aufgaben, hybride Suche über FTS5 und Vectorize), Indexer über `ActorStatePort`, Arbeitsgedächtnis je Mitarbeiter ([ADR 0037](../../docs/architecture/decisions/0037-agent-memory-and-knowledge.md)) |
| `src/usage/` | Verbrauchsprotokoll: `runs`, `model_calls`, `tool_calls` (Migration `0017`), Auswertung, Lauf-Trace, CSV; das Tagesbudget zählt daraus |
| `src/tools/` | `ToolPort`, GitHub-Werkzeuge, Projekt- und Notiz-Werkzeuge, `sandbox_run` und `preview_deploy` (`sandbox.ts`), `code_verify` (`verify.ts`: Workstation oder CI des Repositories, ADR 0038), `tasks_list` und `task_create` (`work.ts`: Tafel lesen, Backlog-Aufgaben anlegen); PR-Diff lesen ist nur dem read-only QA-Reviewer freigegeben |
| `src/workstation/` | Workstations ([ADR 0036](../../docs/architecture/decisions/0036-isolated-workstations-and-previews.md)): `WorkstationPort`, Befehle, Previews; der Container je Lauf und die Gateways für `github.com`, `registry.npmjs.org` und `api.cloudflare.com` (Zugangsdaten nur im Worker), Befehls-Allowlist, Preview-Regeln; Container und Gateways in `src/cloudflare/` |
| `workstation/Dockerfile` | Image der Workstations (Node, pnpm, git); wird erst gebaut, wenn `wrangler.jsonc` es nennt |
| `src/agents/registry.ts` | die Agenten: Chef, Product Owner, Tech Lead, Entwickler, QA-Reviewer, DevOps; Prompt, Modell-Alias, Werkzeuge (Schreibtisch und Budget: Migrationen 0002, 0008, 0023) |
| `src/agents/describe.ts` | Konfigurationsansicht eines Agenten für das Portal |
| `src/runtime/limits.ts` | Grenzwerte eines Laufs, von Laufzeit und Ansicht gemeinsam genutzt |
| `src/organization/` | Organisationskatalog und owner-geschützte Verwaltung über die D1-Control-Plane |
| `migrations/` | D1-Schema für Organisation, Work-Items, Review- und Organisationsaudit |
| `modal/llm.py` | eigene Open-Weight-Modelle auf Modal (vLLM, OpenAI-kompatibel), nicht Teil des Worker-Bundles |

## API

Alle Routen außer `/api/health` und `/api/live` verlangen `Authorization: Bearer <API_SERVICE_TOKEN>`; das Portal schickt dazu `x-portal-actor` mit der E-Mail des angemeldeten Admins.

| Route | Zweck |
| --- | --- |
| `GET /api/agents` | Agenten mit Rolle, Modell-Alias, letztem Event und neuestem Thread (für das Büro) |
| `GET /api/organization` | geschützter, read-only Katalog von Abteilungen, Rollen, Definitionen und Instanzen |
| `POST /api/organization/roles`, `PATCH /api/organization/roles/:id` | Owner-Scope: versionierte, nicht ausführbare Rollenprofile anlegen und pflegen |
| `PATCH /api/organization/instances/:id`, `GET /api/organization/audit` | Owner-Scope: registrierte Instanzen begrenzt pflegen und die letzten 50 Auditänderungen lesen |
| `GET/PUT /api/agents/:id/settings` | Einstellungen eines Mitarbeiters je Mandant: Modell, Denkaufwand (`low`/`medium`/`high`), Schritte je Lauf (4–60), Tagesbudget; Schreiben mit Scope `organization:write` und erwarteter `version` |
| `GET /api/agents/:id/config` | Konfiguration eines Agenten, nur lesend: Modell-Kette mit Verfügbarkeit, Werkzeuge, Systemprompt, Grenzen, Speicher (D1, KV, R2), Schutzregeln, Zugangsdaten (nur ob gesetzt) |
| `GET /api/threads`, `POST /api/threads` | Threads auflisten, anlegen; ohne `projectId` auf Firmenebene ohne Repository (ADR 0038) |
| `GET/PATCH/DELETE /api/threads/:id` | Verlauf, Status, offene Freigaben und Events; Titel, Modell oder Bereich ändern (`projectId: null` = Firma); archivieren |
| `POST /api/threads/:id/chat`, `…/stop` | Auftrag annehmen, Lauf abbrechen |
| `GET /api/github/repositories` | Repositories des Kontos, die der Token sieht (nur freigegebene Besitzer, `GITHUB_OWNERS`), mit ihrem Projekt |
| `POST /api/github/connect`, `GET /api/github/setup`, `GET /api/github/status` | „GitHub verbinden“: Link zur App-Installation, Rücksprung (Setup URL der App, ohne Dienst-Token, mit signiertem Einmal-`state`), Stand der Verbindung. [ADR 0032](../../docs/architecture/decisions/0032-multi-tenant-github-connect.md) |
| `GET /api/projects/:id/previews` | Preview-URLs der Branches und Pull Requests eines Projekts und ob Previews eingerichtet sind ([ADR 0036](../../docs/architecture/decisions/0036-isolated-workstations-and-previews.md)) |
| `POST /webhooks/github` | Webhook der App: Signatur, Wiederholungsschutz, Installationsstand |
| `GET/POST /api/projects`, `DELETE /api/projects/:id` | Projekte auflisten; ein Repository als Projekt registrieren (`{ "repo": "owner/name" }`); entfernen. [ADR 0029](../../docs/architecture/decisions/0029-projects-as-repository-access.md) |
| `GET /api/models` | Anbieter, Modelle, Verfügbarkeit, Herkunft des Schlüssels, Aliase und Wahl je Rolle |
| `GET /api/providers/credentials` | hinterlegte Schlüssel ohne Wert: Anbieter, letzte vier Zeichen, Test, Modelle |
| `PUT/DELETE /api/providers/:id/key`, `POST /api/providers/:id/verify` | Scope `providers:write`: Schlüssel speichern (testet sofort und lädt die Modelle), löschen, erneut prüfen; `custom-…` mit `label`, `baseUrl`, `trainsOnData` |
| `PUT/DELETE /api/models/defaults/:alias` | Scope `providers:write`: Standardmodell einer Rolle `{ provider, model }` |
| `GET /api/projects/:id/knowledge`, `POST …/knowledge/reindex`, `GET …/knowledge/search?q=`, `GET /api/projects/:id/memory` | Wissensindex: Status, Neuaufbau im Hintergrund, Testsuche; Arbeitsgedächtnis der Mitarbeiter |
| `GET/POST /api/projects/:id/sprints`, `PATCH /api/sprints/:id` | Sprints eines Projekts; `planned → active → done`, ein aktiver Sprint je Projekt |
| `GET /api/approvals`, `POST /api/approvals/:id` | offene Freigaben; `{ "decision": "approve" \| "reject" }` |
| `GET /api/events?thread=…&since=…` | Events nachladen |
| `GET /api/usage/summary`, `…/calls`, `…/runs`, `…/runs/:id`, `…/export.csv` | Verbrauch je Mitarbeiter, Modell, Projekt, Anbieter und Tag; Läufe; Trace eines Laufs; CSV. Filter: `from`, `to` (YYYY-MM-DD, UTC), `project`, `agent`, `provider`, `model`, `status` |
| `POST /api/live-ticket`, `GET /api/live?ticket=…` | Einmal-Ticket, dann WebSocket für Events und `delta` |
| `POST /api/tasks/:id/delivery`, `…/delivery/retry`, `…/delivery/cancel`, `GET /api/deliveries` | Team-Ablauf einer bereiten Aufgabe starten, nach einem Halt erneut versuchen, abbrechen; offene und kürzliche Abläufe mit ihren Schritten |
| `GET /api/policies`, `PUT /api/projects/:id/policy`, `GET /api/policy/decisions` | Policy-Engine (ADR 0040, P2): Katalog und Autonomie je Projekt, Stufe setzen (Owner, Versionsprüfung), Entscheidungsprotokoll |
| `POST /api/auth/handoff`, `POST /api/auth/handoff/redeem` | Anmeldung Portal → Office: Einmal-Ticket (60 s) für die angemeldete Person, vom Office-Server genau einmal eingelöst (ADR 0039) |
| `GET/POST /api/tasks`, `PATCH /api/tasks/:id` | persistente Tasks, validierte Statusübergänge und Owner-Abnahme |
| `POST /api/tasks/:id/run`, `POST /api/tasks/:id/review` | Chef-Ausführung bzw. getrennte, read-only QA-Übergabe |

`task_reviews` speichert Ergebnis und Evidence jedes Prüflaufs. `Done` wird nie durch das Modell gesetzt; ein Owner muss eine Abschlussnotiz hinterlegen. Der QA-Reviewer kann weder Commits noch Pull Requests erzeugen.

Organisationsänderungen prüfen zusätzlich `organization:write`, die Portal-Owner-Session und eine erwartete Versionsnummer. Rollen- und Instanzänderungen werden mit Vorher-/Nachher-Zustand in `organization_audit` gespeichert. Runtime-Definitionen, Tools, Modelle und harte Löschungen sind keine Portalaktionen.

## Ablauf eines Auftrags

1. `POST /api/threads/:id/chat` legt den Auftrag in den Eingang des Threads und kehrt sofort zurück.
2. Ein Alarm startet die erste Etappe. Jede Etappe darf 40 externe Aufrufe machen (Modell, GitHub) und plant vor dem Limit die nächste (`stage_paused`).
3. Text kommt live als `delta` über `/api/live`, jeder Schritt als Event mit `threadId`. Die fertige Antwort ist das Event `message`.
4. Aktionen mit Außenwirkung werden zur Freigabe (`approval_requested`). Nach der Entscheidung führt die API sie aus und gibt das Ergebnis über `resume` an den Thread.

## Lokal

**Portal lokal, Backend in Dev (Standard):** `pnpm dev:portal` startet das Portal auf `http://localhost:3101` mit den Infisical-Werten der Stage `dev`. `API_URL` zeigt auf `https://api-dev.uguroezdamar.com`, `API_SERVICE_TOKEN` ist das Dev-Token. Der Chat und das Agenten-Büro sprechen also lokal mit dem deployten Dev-Backend; Cloudflare-Login oder Modell-Schlüssel braucht es lokal nicht. Nach einer Änderung an Infisical-Werten den Dev-Server neu starten, Werte werden nur beim Start gelesen.

**Cloudflare-Anmeldung:** `pnpm ugur cf login` bindet ein eigenes Wrangler-Profil (`uguroezdamar`) an diesen Checkout und prüft, dass es das Konto aus `CF_ACCOUNT_ID` ist; `pnpm ugur cf whoami` prüft erneut. Die globale Wrangler-Anmeldung auf dem Rechner (z. B. ViralSync) bleibt davon unberührt. Ressourcen der API (z. B. der Vectorize-Index) legt der Deploy-Workflow an, nicht ein lokaler Befehl.

**Backend lokal (optional):** Lokal läuft das Backend mit `pnpm dev` (Wrangler). Werte nur per `--var`, nie als Datei im Repository. Die `ai`-Bindung braucht immer eine Remote-Verbindung zu Cloudflare (`wrangler login` mit dem Konto der Zone). Ohne sie: eine Testkonfiguration ohne `ai` verwenden und das Alias `chef-smart` per KV-Schlüssel `models` (`--local`) auf einen OpenAI-kompatiblen Mock zeigen lassen.

## Modal

Eigene Modelle laufen auf Modal (Workspace `ugur44ist`), App `uguroezdamar-llm`. Im Portal stehen sie unter „Modal (eigene GPUs)“:

| Funktion | Modell | GPU | ca. Preis |
| --- | --- | --- | --- |
| `ministral` | Ministral 3 8B (FP8) | L40S | 1,95 $/h |
| `gemma` | Gemma 4 26B-A4B | H100 | 3,95 $/h |

Warum Kaltstart: Modal fährt die GPU nach fünf Minuten ohne Anfrage herunter, und der nächste Start lädt die Gewichte neu in den GPU-Speicher. Eine dauerhaft warme GPU (`min_containers=1`) kostet bei der L40S rund 1.400 $ im Monat. Für Chat und Agenten sind bezahlte APIs (Claude, OpenAI, DeepSeek …) deshalb günstiger und schneller. Modal ist für Batch-Arbeit, Bild-, Audio- und Videoerzeugung und eigene Modelle gedacht ([ADR 0033](../../docs/architecture/decisions/0033-model-providers-and-tenant-keys.md)).

Freigeschaltet wird Modal mit der Variable `MODAL_ENABLED` in `wrangler.jsonc` (je Umgebung), erst wenn die Modelle laufen. Abgerechnet wird pro Sekunde; nach 5 Minuten ohne Anfrage fährt die GPU herunter. Die erste Anfrage danach wartet auf einen Kaltstart von 1 bis 3 Minuten. Modal-Modelle stehen in keiner Alias-Kette, sie laufen nur auf ausdrückliche Wahl im Thread. Schlüssel: Modal-Secret `uguroezdamar-llm` (`LLM_API_KEY`), gleicher Wert als GitHub-Secret `MODAL_LLM_API_KEY`. Deploy: `MODAL_PROFILE=ugur44ist modal deploy apps/api/modal/llm.py`. Details im Skill `.claude/skills/modal-llm`.

## Erweitern

- **Schlüssel eines Anbieters:** im Portal unter „Modelle & Schlüssel“ (`/models`). Dort auch eigene OpenAI-kompatible Anbieter. Kein Deploy nötig.
- **Neues Modell oder neuer Anbieter:** in `src/models/config.ts` eintragen (Anbieter mit `label`, `models`, Secret-Name) oder ohne Deploy als JSON unter dem KV-Schlüssel `models` überschreiben. Es erscheint danach in der Modellwahl des Portals.
- **Neues Werkzeug:** ein `Tool` in `src/tools/` und in `registry.ts` eintragen. Alles mit Außenwirkung bekommt `requiresApproval: true`.
- **Neuer Agent:** Eintrag in `src/agents/registry.ts` plus eine Zeile in der Tabelle `agents` (Schreibtisch, Budget).

## Deploy

| Branch | Worker | Adresse | GitHub-Environment | D1 / KV |
| --- | --- | --- | --- | --- |
| `dev` | `uguroezdamar-api-dev` (`--env dev`) | `api-dev.uguroezdamar.com` | `api-dev` | `uguroezdamar-dev` / `uguroezdamar-config-dev` |
| `main` | `uguroezdamar-api` | `api.uguroezdamar.com` | `api-production` | `uguroezdamar` / `uguroezdamar-config` |

Jeder Push auf `dev`, der `apps/api/**` ändert, deployt nach Dev; der Merge `dev` → `main` deployt Produktion. Beides übernimmt `.github/workflows/api-deploy.yml`.

| Secret | Ort | Pflicht | Wofür |
| --- | --- | --- | --- |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | Repository | ja | Deploy und Migrationen |
| `API_SERVICE_TOKEN` | Environment `api-dev` bzw. `api-production`, gleicher Wert in Infisical dev bzw. prod | ja | Zugang des Portals |
| `GEMINI_API_KEY` | Repository | nein | Gemini; ohne Schlüssel antwortet Workers AI |
| `AGENT_GH_APP_ID`, `AGENT_GH_APP_PRIVATE_KEY` | Repository | nein | GitHub App der Agenten ([ADR 0031](../../docs/architecture/decisions/0031-github-app-access.md)); ersetzt den Token, wo sie installiert ist |
| `AGENT_GITHUB_TOKEN` | Repository | nein | Rückfall zur App und Anlegen von Repositories |
| `MODAL_LLM_API_KEY` | Repository, gleicher Wert im Modal-Secret `uguroezdamar-llm` | nein | eigene Modelle auf Modal |
| `AGENT_CF_PREVIEW_TOKEN` | Repository, Sicherung in Infisical (prod) | nein | Preview-Uploads der Workstations (Workers Scripts: Edit); bleibt im Worker ([ADR 0036](../../docs/architecture/decisions/0036-isolated-workstations-and-previews.md)) |
| `PROVIDER_KEYS_SECRET` | Repository, erzeugt von `pnpm ugur api secrets --apply`, Sicherung in Infisical (prod) | für `/models` | verschlüsselt die im Portal hinterlegten Modellschlüssel; nie rotieren |

`pnpm ugur api secrets` zeigt, was gesetzt ist (nur Namen). Mit `--apply` erzeugt der Befehl je Stage ein Service-Token und setzt es in GitHub und Infisical, setzt `API_URL` in Infisical, fragt die optionalen Schlüssel verdeckt ab und startet den Dev-Deploy. Danach übernimmt `pnpm ugur hosting env --stage dev --apply` die Portal-Werte in Vercel (Preview).

Der Workflow lädt Code und Worker-Secrets mit `wrangler deploy --secrets-file` als eine Version hoch. Der `CLOUDFLARE_API_TOKEN` braucht: Account – Workers Scripts: Edit, D1: Edit, Workers KV Storage: Edit, Workers R2 Storage: Edit; Zone `uguroezdamar.com` – Workers Routes: Edit, DNS: Edit, Zone: Read.
