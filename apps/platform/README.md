# apps/platform

Agenten-Plattform unter `platform.uguroezdamar.com`: Chat mit dem Chef-Agenten, Live-Aktivität, Freigaben. Cloudflare Worker, Free Plan ([ADR 0024](../../docs/architecture/decisions/0024-agent-platform-on-cloudflare.md)).

| Pfad | Zweck |
| --- | --- |
| `src/index.ts` | API (`/api/*`), Auth, Freigabe-Entscheidungen |
| `src/agent.ts` | `AgentRuntime`: ein Durable Object pro Agent, führt Aufträge in Alarm-Etappen aus |
| `src/runtime/` | `AgentRuntimePort`, die Schleife ohne Cloudflare-APIs (`loop.ts`), Subrequest-Budget pro Etappe |
| `src/approvals.ts` | Text, Risiko und Ablauf der Freigaben; geschützte Pfade |
| `src/hub.ts` | `LiveHub`: verteilt Events und gestreamten Text per WebSocket, Einmal-Tickets |
| `src/events.ts` | Event-Log in D1, Tagesbudget |
| `src/models/` | `ModelPort`, Router mit Fallback, Adapter (OpenAI-kompatibel, Workers AI), Alias-Konfiguration |
| `src/tools/` | `ToolPort`, GitHub-Werkzeuge, Plattform-Werkzeuge |
| `src/agents/registry.ts` | die Agenten: Prompt, Modell-Alias, Werkzeuge |
| `public/` | Oberfläche ohne Build-Schritt |
| `migrations/` | D1-Schema |

## Lokal

```sh
printf 'PLATFORM_ADMIN_TOKEN=local\nGEMINI_API_KEY=...\n' > .dev.vars   # nicht committen
pnpm exec wrangler d1 migrations apply uguroezdamar --local
pnpm dev
```

## Ablauf eines Auftrags

1. `POST /api/agents/chef/chat` legt den Auftrag in den Eingang des Agenten und kehrt sofort zurück.
2. Ein Alarm startet die erste Etappe. Jede Etappe darf 40 externe Aufrufe machen (Modell, GitHub) und plant vor dem Limit die nächste (`stage_paused`).
3. Text kommt live als `delta` über `/api/live`, jeder Schritt als Event. Die fertige Antwort ist das Event `message`.
4. Aktionen mit Außenwirkung werden zur Freigabe (`approval_requested`). Nach der Entscheidung (`POST /api/approvals/:id`) führt die API sie aus und gibt das Ergebnis über `resume` an den Agenten.
5. `POST /api/agents/chef/stop` bricht ab, `GET …/status` zeigt den Lauf.

Lokal ohne echtes Modell testen: das Alias `chef-smart` per KV-Schlüssel `models` (lokal, `--env dev --local`) auf einen OpenAI-kompatiblen Mock zeigen lassen. Die `ai`-Bindung braucht immer eine Remote-Verbindung zu Cloudflare; dazu `wrangler login` mit dem Konto der Plattform.

## Erweitern

- **Neues Modell oder neuer Anbieter:** Alias in `src/models/config.ts` ergänzen oder ohne Deploy als JSON unter dem KV-Schlüssel `models` überschreiben. OpenAI-kompatible Anbieter brauchen nur Basis-URL und den Namen ihres Secrets.
- **Neues Werkzeug:** ein `Tool` in `src/tools/` und in `registry.ts` eintragen. Alles, was außerhalb der Plattform etwas ändert, bekommt `requiresApproval: true`.
- **Neuer Agent:** Eintrag in `src/agents/registry.ts` plus eine Zeile in der Tabelle `agents` (Schreibtisch, Budget).

## Deploy

| Branch | Worker | Adresse | D1 / KV |
| --- | --- | --- | --- |
| `dev` | `uguroezdamar-platform-dev` (`--env dev`) | `platform-dev.uguroezdamar.com` | `uguroezdamar-dev` / `uguroezdamar-config-dev` |
| `main` | `uguroezdamar-platform` | `platform.uguroezdamar.com` | `uguroezdamar` / `uguroezdamar-config` |

Jeder Push auf `dev`, der `apps/platform/**` ändert, deployt nach Dev; der Merge `dev` → `main` deployt Produktion. Beides übernimmt `.github/workflows/platform-deploy.yml`. Die Oberfläche zeigt in Dev ein `DEV`-Abzeichen. Agenten lesen und schreiben standardmäßig auf `dev`. Repository-Secrets (GitHub → Repository → Settings → Secrets and variables → Actions):

| Name | Pflicht | Wofür |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | ja | Deploy und Migrationen |
| `PLATFORM_ADMIN_TOKEN` | für die Anmeldung | Login, bis Cloudflare Access davor steht |
| `GEMINI_API_KEY` | nein | Gemini; ohne Schlüssel antwortet Workers AI |
| `AGENT_GITHUB_TOKEN` | nein | Repo-Werkzeuge des Agenten |

`pnpm ugur platform secrets` zeigt, was gesetzt ist. Mit `--apply` erzeugt der Befehl das Admin-Token (zum Nachsehen in Infisical unter `PLATFORM_ADMIN_TOKEN` und in der Zwischenablage), fragt die optionalen Schlüssel verdeckt ab, beschreibt, woher sie kommen, und startet den Dev-Deploy.

Der Workflow lädt Code und Worker-Secrets mit `wrangler deploy --secrets-file` als eine Version hoch; so klappt auch der allererste Deploy, bevor der Worker existiert. Der `CLOUDFLARE_API_TOKEN` braucht dafür: Account – Workers Scripts: Edit, D1: Edit, Workers KV Storage: Edit, Workers R2 Storage: Edit; Zone `uguroezdamar.com` – Workers Routes: Edit, DNS: Edit (für beide Custom Domains), Zone: Read.
