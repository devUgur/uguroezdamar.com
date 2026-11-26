# apps/api

Agenten-Backend des Admin-Portals: Threads, Agentenschleife, Modelle, Werkzeuge, Freigaben, Live-Events. Cloudflare Worker, Free Plan ([ADR 0024](../../docs/architecture/decisions/0024-agent-platform-on-cloudflare.md)). Die Oberfläche ist `/chat` im Portal (`apps/portal/src/features/chat`); der Worker selbst hat keine.

| Pfad | Zweck |
| --- | --- |
| `src/index.ts` | HTTP-API (`/api/*`), Threads, Freigabe-Entscheidungen |
| `src/auth.ts` | Service-Token des Portals, fail closed |
| `src/agent.ts` | `AgentRuntime`: ein Durable Object pro Thread, führt Aufträge in Alarm-Etappen aus |
| `src/runtime/` | `AgentRuntimePort`, die Schleife ohne Cloudflare-APIs (`loop.ts`), Subrequest-Budget pro Etappe |
| `src/approvals.ts` | Text, Risiko und Ablauf der Freigaben; geschützte Pfade |
| `src/hub.ts` | `LiveHub`: verteilt Events und gestreamten Text per WebSocket, Einmal-Tickets |
| `src/events.ts` | Event-Log in D1, Tagesbudget |
| `src/models/` | `ModelPort`, Router mit Fallback und Modellwahl je Thread, Katalog, Adapter (OpenAI-kompatibel, Workers AI) |
| `src/tools/` | `ToolPort`, GitHub-Werkzeuge, Projekt- und Notiz-Werkzeuge; PR-Diff lesen ist nur dem read-only QA-Reviewer freigegeben |
| `src/agents/registry.ts` | die Agenten: Prompt, Modell-Alias, Werkzeuge |
| `src/agents/describe.ts` | Konfigurationsansicht eines Agenten für das Portal |
| `src/runtime/limits.ts` | Grenzwerte eines Laufs, von Laufzeit und Ansicht gemeinsam genutzt |
| `src/organization/` | read-only Organisationskatalog über die D1-Control-Plane |
| `migrations/` | D1-Schema für Organisation, Work-Items und Review-Audit |
| `modal/llm.py` | eigene Open-Weight-Modelle auf Modal (vLLM, OpenAI-kompatibel), nicht Teil des Worker-Bundles |

## API

Alle Routen außer `/api/health` und `/api/live` verlangen `Authorization: Bearer <API_SERVICE_TOKEN>`; das Portal schickt dazu `x-portal-actor` mit der E-Mail des angemeldeten Admins.

| Route | Zweck |
| --- | --- |
| `GET /api/agents` | Agenten mit Rolle, Modell-Alias, letztem Event und neuestem Thread (für das Büro) |
| `GET /api/organization` | geschützter, read-only Katalog von Abteilungen, Rollen, Definitionen und Instanzen |
| `GET /api/agents/:id/config` | Konfiguration eines Agenten, nur lesend: Modell-Kette mit Verfügbarkeit, Werkzeuge, Systemprompt, Grenzen, Speicher (D1, KV, R2), Schutzregeln, Zugangsdaten (nur ob gesetzt) |
| `GET /api/threads`, `POST /api/threads` | Threads auflisten, anlegen |
| `GET/PATCH/DELETE /api/threads/:id` | Verlauf, Status, offene Freigaben und Events; Titel oder Modell ändern; archivieren |
| `POST /api/threads/:id/chat`, `…/stop` | Auftrag annehmen, Lauf abbrechen |
| `GET /api/github/repositories` | Repositories des Kontos, die der Token sieht (nur freigegebene Besitzer, `GITHUB_OWNERS`), mit ihrem Projekt |
| `GET/POST /api/projects`, `DELETE /api/projects/:id` | Projekte auflisten; ein Repository als Projekt registrieren (`{ "repo": "owner/name" }`); entfernen. [ADR 0029](../../docs/architecture/decisions/0029-projects-as-repository-access.md) |
| `GET /api/models` | Anbieter, Modelle, Verfügbarkeit, Aliase |
| `GET /api/approvals`, `POST /api/approvals/:id` | offene Freigaben; `{ "decision": "approve" \| "reject" }` |
| `GET /api/events?thread=…&since=…` | Events nachladen |
| `POST /api/live-ticket`, `GET /api/live?ticket=…` | Einmal-Ticket, dann WebSocket für Events und `delta` |
| `GET/POST /api/tasks`, `PATCH /api/tasks/:id` | persistente Tasks, validierte Statusübergänge und Owner-Abnahme |
| `POST /api/tasks/:id/run`, `POST /api/tasks/:id/review` | Chef-Ausführung bzw. getrennte, read-only QA-Übergabe |

`task_reviews` speichert Ergebnis und Evidence jedes Prüflaufs. `Done` wird nie durch das Modell gesetzt; ein Owner muss eine Abschlussnotiz hinterlegen. Der QA-Reviewer kann weder Commits noch Pull Requests erzeugen.

## Ablauf eines Auftrags

1. `POST /api/threads/:id/chat` legt den Auftrag in den Eingang des Threads und kehrt sofort zurück.
2. Ein Alarm startet die erste Etappe. Jede Etappe darf 40 externe Aufrufe machen (Modell, GitHub) und plant vor dem Limit die nächste (`stage_paused`).
3. Text kommt live als `delta` über `/api/live`, jeder Schritt als Event mit `threadId`. Die fertige Antwort ist das Event `message`.
4. Aktionen mit Außenwirkung werden zur Freigabe (`approval_requested`). Nach der Entscheidung führt die API sie aus und gibt das Ergebnis über `resume` an den Thread.

## Lokal

**Portal lokal, Backend in Dev (Standard):** `pnpm dev:portal` startet das Portal auf `http://localhost:3101` mit den Infisical-Werten der Stage `dev`. `API_URL` zeigt auf `https://api-dev.uguroezdamar.com`, `API_SERVICE_TOKEN` ist das Dev-Token. Der Chat und das Agenten-Büro sprechen also lokal mit dem deployten Dev-Backend; Cloudflare-Login oder Modell-Schlüssel braucht es lokal nicht. Nach einer Änderung an Infisical-Werten den Dev-Server neu starten, Werte werden nur beim Start gelesen.

**Backend lokal (optional):** Lokal läuft das Backend mit `pnpm dev` (Wrangler). Werte nur per `--var`, nie als Datei im Repository. Die `ai`-Bindung braucht immer eine Remote-Verbindung zu Cloudflare (`wrangler login` mit dem Konto der Zone). Ohne sie: eine Testkonfiguration ohne `ai` verwenden und das Alias `chef-smart` per KV-Schlüssel `models` (`--local`) auf einen OpenAI-kompatiblen Mock zeigen lassen.

## Modal

Eigene Modelle laufen auf Modal (Workspace `ugur44ist`), App `uguroezdamar-llm`. Im Portal stehen sie unter „Modal (eigene GPUs)“:

| Funktion | Modell | GPU | ca. Preis |
| --- | --- | --- | --- |
| `ministral` | Ministral 3 8B (FP8) | L40S | 1,95 $/h |
| `gemma` | Gemma 4 26B-A4B | H100 | 3,95 $/h |

Freigeschaltet wird Modal mit der Variable `MODAL_ENABLED` in `wrangler.jsonc` (je Umgebung), erst wenn die Modelle laufen. Abgerechnet wird pro Sekunde; nach 5 Minuten ohne Anfrage fährt die GPU herunter. Die erste Anfrage danach wartet auf einen Kaltstart von 1 bis 3 Minuten. Modal-Modelle stehen in keiner Alias-Kette, sie laufen nur auf ausdrückliche Wahl im Thread. Schlüssel: Modal-Secret `uguroezdamar-llm` (`LLM_API_KEY`), gleicher Wert als GitHub-Secret `MODAL_LLM_API_KEY`. Deploy: `MODAL_PROFILE=ugur44ist modal deploy apps/api/modal/llm.py`. Details im Skill `.claude/skills/modal-llm`.

## Erweitern

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
| `AGENT_GITHUB_TOKEN` | Repository | nein | Repo-Werkzeuge des Agenten |
| `MODAL_LLM_API_KEY` | Repository, gleicher Wert im Modal-Secret `uguroezdamar-llm` | nein | eigene Modelle auf Modal |

`pnpm ugur api secrets` zeigt, was gesetzt ist (nur Namen). Mit `--apply` erzeugt der Befehl je Stage ein Service-Token und setzt es in GitHub und Infisical, setzt `API_URL` in Infisical, fragt die optionalen Schlüssel verdeckt ab und startet den Dev-Deploy. Danach übernimmt `pnpm ugur hosting env --stage dev --apply` die Portal-Werte in Vercel (Preview).

Der Workflow lädt Code und Worker-Secrets mit `wrangler deploy --secrets-file` als eine Version hoch. Der `CLOUDFLARE_API_TOKEN` braucht: Account – Workers Scripts: Edit, D1: Edit, Workers KV Storage: Edit, Workers R2 Storage: Edit; Zone `uguroezdamar.com` – Workers Routes: Edit, DNS: Edit, Zone: Read.
