# apps/platform

Agenten-Plattform unter `platform.uguroezdamar.com`: Chat mit dem Chef-Agenten, Live-Aktivität, Freigaben. Cloudflare Worker, Free Plan ([ADR 0024](../../docs/architecture/decisions/0024-agent-platform-on-cloudflare.md)).

| Pfad | Zweck |
| --- | --- |
| `src/index.ts` | API (`/api/*`), Auth, Freigabe-Entscheidungen |
| `src/agent.ts` | `AgentRuntime`: ein Durable Object pro Agent, Denk-/Werkzeug-Schleife |
| `src/hub.ts` | `LiveHub`: verteilt Events per WebSocket |
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

## Erweitern

- **Neues Modell oder neuer Anbieter:** Alias in `src/models/config.ts` ergänzen oder ohne Deploy als JSON unter dem KV-Schlüssel `models` überschreiben. OpenAI-kompatible Anbieter brauchen nur Basis-URL und den Namen ihres Secrets.
- **Neues Werkzeug:** ein `Tool` in `src/tools/` und in `registry.ts` eintragen. Alles, was außerhalb der Plattform etwas ändert, bekommt `requiresApproval: true`.
- **Neuer Agent:** Eintrag in `src/agents/registry.ts` plus eine Zeile in der Tabelle `agents` (Schreibtisch, Budget).

## Deploy

| Branch | Worker | Adresse | D1 / KV |
| --- | --- | --- | --- |
| `dev` | `uguroezdamar-platform-dev` (`--env dev`) | `platform-dev.uguroezdamar.com` | `uguroezdamar-dev` / `uguroezdamar-config-dev` |
| `main` | `uguroezdamar-platform` | `platform.uguroezdamar.com` | `uguroezdamar` / `uguroezdamar-config` |

Jeder Push auf `dev`, der `apps/platform/**` ändert, deployt nach Dev; der Merge `dev` → `main` deployt Produktion. Beides übernimmt `.github/workflows/platform-deploy.yml`. Die Oberfläche zeigt in Dev ein `DEV`-Abzeichen. Agenten lesen und schreiben standardmäßig auf `dev`. Benötigte Repository-Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `PLATFORM_ADMIN_TOKEN`, `GEMINI_API_KEY`, `AGENT_GITHUB_TOKEN`.

Der Workflow lädt Code und Worker-Secrets mit `wrangler deploy --secrets-file` als eine Version hoch; so klappt auch der allererste Deploy, bevor der Worker existiert. Der `CLOUDFLARE_API_TOKEN` braucht dafür: Account – Workers Scripts: Edit, D1: Edit, Workers KV Storage: Edit, Workers R2 Storage: Edit; Zone `uguroezdamar.com` – Workers Routes: Edit, DNS: Edit (für beide Custom Domains), Zone: Read.
