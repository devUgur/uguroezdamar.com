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
| `src/tools/` | `ToolPort`, GitHub-Werkzeuge, Projekt- und Notiz-Werkzeuge |
| `src/agents/registry.ts` | die Agenten: Prompt, Modell-Alias, Werkzeuge |
| `migrations/` | D1-Schema |

## API

Alle Routen außer `/api/health` und `/api/live` verlangen `Authorization: Bearer <API_SERVICE_TOKEN>`; das Portal schickt dazu `x-portal-actor` mit der E-Mail des angemeldeten Admins.

| Route | Zweck |
| --- | --- |
| `GET /api/threads`, `POST /api/threads` | Threads auflisten, anlegen |
| `GET/PATCH/DELETE /api/threads/:id` | Verlauf, Status, offene Freigaben und Events; Titel oder Modell ändern; archivieren |
| `POST /api/threads/:id/chat`, `…/stop` | Auftrag annehmen, Lauf abbrechen |
| `GET /api/models` | Anbieter, Modelle, Verfügbarkeit, Aliase |
| `GET /api/approvals`, `POST /api/approvals/:id` | offene Freigaben; `{ "decision": "approve" \| "reject" }` |
| `GET /api/events?thread=…&since=…` | Events nachladen |
| `POST /api/live-ticket`, `GET /api/live?ticket=…` | Einmal-Ticket, dann WebSocket für Events und `delta` |

## Ablauf eines Auftrags

1. `POST /api/threads/:id/chat` legt den Auftrag in den Eingang des Threads und kehrt sofort zurück.
2. Ein Alarm startet die erste Etappe. Jede Etappe darf 40 externe Aufrufe machen (Modell, GitHub) und plant vor dem Limit die nächste (`stage_paused`).
3. Text kommt live als `delta` über `/api/live`, jeder Schritt als Event mit `threadId`. Die fertige Antwort ist das Event `message`.
4. Aktionen mit Außenwirkung werden zur Freigabe (`approval_requested`). Nach der Entscheidung führt die API sie aus und gibt das Ergebnis über `resume` an den Thread.

## Lokal

Lokal läuft das Backend mit `pnpm dev` (Wrangler). Werte nur per `--var`, nie als Datei im Repository. Die `ai`-Bindung braucht immer eine Remote-Verbindung zu Cloudflare (`wrangler login` mit dem Konto der Zone). Ohne sie: eine Testkonfiguration ohne `ai` verwenden und das Alias `chef-smart` per KV-Schlüssel `models` (`--local`) auf einen OpenAI-kompatiblen Mock zeigen lassen.

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

`pnpm ugur api secrets` zeigt, was gesetzt ist (nur Namen). Mit `--apply` erzeugt der Befehl je Stage ein Service-Token und setzt es in GitHub und Infisical, setzt `API_URL` in Infisical, fragt die optionalen Schlüssel verdeckt ab und startet den Dev-Deploy. Danach übernimmt `pnpm ugur hosting env --stage dev --apply` die Portal-Werte in Vercel (Preview).

Der Workflow lädt Code und Worker-Secrets mit `wrangler deploy --secrets-file` als eine Version hoch. Der `CLOUDFLARE_API_TOKEN` braucht: Account – Workers Scripts: Edit, D1: Edit, Workers KV Storage: Edit, Workers R2 Storage: Edit; Zone `uguroezdamar.com` – Workers Routes: Edit, DNS: Edit, Zone: Read.
