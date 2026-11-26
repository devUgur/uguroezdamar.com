# ADR 0024: Agenten-Backend auf Cloudflare, Chat im Portal

- Status: accepted
- Datum: 2026-11-25
- Beteiligte: Projektverantwortliche
- Fortgeschrieben:
  - 2026-11-25: zwei Umgebungen (`dev`, Produktion), Agenten arbeiten auf `dev`
  - 2026-11-26: Die Oberfläche zieht als `/chat` ins Admin-Portal, der Worker wird zum reinen Backend `apps/api`, es gibt Threads und eine Modellwahl je Thread. Bis dahin hieß der Worker „Plattform“ (`apps/platform`, `platform-dev.uguroezdamar.com`) und hatte eine eigene Oberfläche mit Admin-Token; beides ist ersetzt.
- Ergänzt: [ADR 0020](0020-vercel-hosting.md) und [ADR 0023](0023-cloudflare-dns-and-account-boundaries.md)

## Kontext

Der Owner will KI-Agenten, die per Chat gesteuert werden und dieses Monorepo pflegen: Website, Portal und das Agenten-Backend selbst. Das soll ohne laufende Kosten starten, jeden Modellanbieter austauschbar halten und später ein visuelles Agenten-Büro tragen.

Das Admin-Portal (`portal.uguroezdamar.com`) hat bereits Login, Sessions und Admin-Konten. Eine zweite Oberfläche mit eigenem Token erwies sich als verwirrend und doppelt.

## Entscheidung

1. **Oberfläche im Portal.** Feature `apps/portal/src/features/agents` mit zwei Ansichten und dem Portal-Login: `/chat` (Threads links, gewählter Thread rechts) und `/agents`, ein Büro, in dem jeder konfigurierte Agent als Figur zu sehen ist. Freie Agenten laufen umher, arbeitende sitzen am Platz, wartende zeigen ein Ausrufezeichen; die Zustände stammen nur aus Live-Events. Ein Klick öffnet Details und einen Chat im Dialog, derselbe Chat wie auf `/chat`. Der Portal-Server spricht das Backend über einen Adapter an (`src/adapters/agents-api.ts`), alle Schreibvorgänge laufen über Server Actions, die die Session prüfen.
2. **Backend `apps/api`.** Ein Cloudflare Worker in zwei Umgebungen, jeweils mit Custom Domain im Cloudflare-Konto der Zone:
   - Produktion: Worker `uguroezdamar-api`, `api.uguroezdamar.com`, Branch `main`, D1 `uguroezdamar`, KV `uguroezdamar-config`
   - Dev: Worker `uguroezdamar-api-dev`, `api-dev.uguroezdamar.com`, Branch `dev`, D1 `uguroezdamar-dev`, KV `uguroezdamar-config-dev` (Wrangler-Umgebung `dev`)

   Beide teilen den R2-Bucket. Das Backend hat keine eigene Oberfläche und keine `*.workers.dev`-Adresse. Es ist die einzige App dieses Repositories auf Cloudflare; ADR 0023 gilt für alles andere weiter.
3. **Zugang.** Fail closed: Nur der Portal-Server ruft die API auf, mit `API_SERVICE_TOKEN` im `Authorization`-Header und der E-Mail des angemeldeten Admins in `x-portal-actor` (für das Protokoll). Jede Umgebung hat ein eigenes Token. Ohne Token antwortet die API nur auf `/api/health`. Der Browser bekommt nie ein Token: Für den Live-WebSocket holt der Portal-Server ein Einmal-Ticket (`POST /api/live-ticket`, 60 s gültig, beim Verbinden verbraucht), mit dem der Browser `wss://…/api/live` öffnet.
4. **Threads.** Jeder Thread ist ein eigenes Durable Object (`thread:<id>`) mit eigenem Verlauf in SQLite. D1 hält die Threads (Titel, Agent, Modellwahl, Ersteller); Events und Freigaben tragen die Thread-ID (Migration 0004). Der erste Auftrag benennt den Thread.
5. **Modelle.** Agenten erreichen Modelle nur über `ModelPort` (`apps/api/src/models`). Agenten kennen Aliase (`chef-smart`, `coder`, `worker-cheap`) mit Fallback-Kette, per KV-Schlüssel `models` ohne Deploy änderbar. Ein Katalog nennt je Anbieter Name und Modelle. Im Portal wählt man pro Thread aus einer Liste aller Anbieter („Anbieter · Modell“) „Automatisch“ (Alias) oder ein bestimmtes Modell; die Alias-Kette bleibt dahinter als Fallback. Anbieter ohne Schlüssel erscheinen, sind aber nicht wählbar. Start: Gemini-Free-Tier und Workers AI. Dazu eigene Open-Weight-Modelle auf Modal (`apps/api/modal/llm.py`, Workspace `ugur44ist`, vLLM mit Tool-Calls, Schlüssel `MODAL_LLM_API_KEY`). Sie kosten GPU-Zeit pro Sekunde, fahren im Leerlauf auf null und stehen deshalb in keiner Alias-Kette, sondern laufen nur auf ausdrückliche Wahl.
6. **Code-Änderungen durch Agenten** nur über GitHub: Commits auf `dev` (Standard) oder `agent/…`, nie auf `main`, jeweils erst nach Freigabe des Owners im Chat. Pull Requests gehen von `agent/…` nach `dev` oder von `dev` nach `main`. Agenten mergen nie. Ein freigegebener Commit auf `dev` geht automatisch in die Dev-Umgebung; Produktion erreicht er nur über den Merge des Owners. Die Regeln aus `AGENTS.md` gelten für Agenten wie für Menschen.
7. **Deployment.** `.github/workflows/api-deploy.yml` bei Push auf `dev` (GitHub-Environment `api-dev`, ohne Freigabe) und nach Merge auf `main` (`api-production`), nur bei Änderungen unter `apps/api/**`, oder manuell. Migrationen laufen vor dem Deploy; Code und Worker-Secrets gehen mit `wrangler deploy --secrets-file` als eine Version hoch. Das Portal deployt wie bisher über Vercel (ADR 0020).
8. **Secrets.** Das Backend liest aus GitHub Actions: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `GEMINI_API_KEY`, `AGENT_GITHUB_TOKEN` (Repository) und `API_SERVICE_TOKEN` (je Environment). Das Portal liest `API_URL` und `API_SERVICE_TOKEN` aus Infisical (dev bzw. prod), wie jede andere Portal-Variable. `pnpm ugur api secrets --apply` erzeugt die Tokens und setzt beide Seiten. Der Cloudflare-Token ist auf das Portfolio-Konto beschränkt (ADR 0023, Punkt 3).
9. **Ausführung in Etappen.** Die API spricht Agenten über `AgentRuntimePort` an (`src/runtime/port.ts`); `chat` und `resume` nehmen Arbeit nur an. Die Schleife (`src/runtime/loop.ts`, ohne Cloudflare-APIs testbar) läuft in Durable-Object-Alarmen. Jede Etappe hat ein eigenes Budget von 40 externen Subrequests; Grund ist die Grenze des Free Plans von 50 pro Aufruf. Vor dem Limit hält sie an und plant die nächste. Höchstens 24 Schritte pro Auftrag; Nachrichten während eines Laufs warten bis zur nächsten Etappe.
10. **Streaming.** Der OpenAI-kompatible Adapter liest Server-Sent Events; der Live-Hub verteilt den Text gebündelt alle 250 ms (`delta`, nicht gespeichert). Gespeichert wird die fertige Antwort als Event `message`. Das Portal zeigt den laufenden Schritt live und lädt nach dessen Ende den gespeicherten Verlauf neu.
11. **Freigaben** tragen eine Zusammenfassung, eine Risikostufe (`security` für Workflows, API-Konfiguration, Auth, Freigaberegeln und Secret-Manifest; `release` für PRs `dev` → `main`), Warnungen und laufen nach 24 Stunden ab (`src/approvals.ts`, Migration 0003).

## Alternativen

- **Alles im Portal (Next.js auf Vercel), auch die Agentenschleife:** abgelehnt. Lang laufende Schleifen, Live-Verbindungen und Agenten-Zustand bräuchten dort kostenpflichtige Zusatzdienste. Deshalb liegt nur die Oberfläche im Portal.
- **Eigene Oberfläche im Worker mit Admin-Token** (Stand bis 2026-11-26): ersetzt. Zweiter Login, eigene Domain, Token zum Abtippen.
- **shadcn-Chat-Bausteine (`message-scroller`, `message`):** zurückgestellt. Sie brauchen `@shadcn/react` und den shadcn-Button v4; `packages/ui` hat einen eigenen Button. Die Umstellung ist eine eigene Entscheidung.
- **Cloudflare Agents SDK** (`AIChatAgent`, `useAgentChat`): zurückgestellt. Die eigene Laufzeit mit Etappen, Freigaben und Budget ist getestet; ein Wechsel lohnt sich erst, wenn das SDK nachweislich Arbeit spart.
- **Google Cloud (Cloud Run, Vertex):** zurückgestellt; erfordert ein Abrechnungskonto. Bleibt hinter den Ports möglich.
- **LiteLLM als Gateway:** abgelehnt für den Start; braucht eigenen Server und Postgres.

## Konsequenzen

- Free-Plan-Grenzen (u. a. 100.000 Anfragen/Tag, 50 externe Subrequests pro Aufruf, CPU-Zeit pro Aufruf) stoppen bei Überschreitung, statt abzurechnen. Die Etappen halten die Subrequests ein; CPU-Zeit zählt nur reine Rechenzeit. Reicht das nachweislich nicht, ist Workers Paid eine Entscheidung des Owners.
- Gratis-Gemini-Anfragen dürfen von Google ausgewertet werden; vertrauliche Daten gehören nicht in Aufträge, solange kein bezahltes Modell konfiguriert ist.
- Der GitHub-Token der Agenten kann Branches und Pull Requests anlegen. Er wird fein granular auf die verwalteten Repositories beschränkt (Contents, Pull requests: read/write; Checks, Metadata: read).
- Die Portal-Preview auf `dev` spricht `api-dev`, Produktion spricht `api`. Ein Live-Test des Chats braucht deshalb beide: einen Deploy der API und einen des Portals.

## Verifikation

- `pnpm --filter @ugur/api typecheck` und `pnpm --filter @ugur/api build` (Wrangler-Dry-Run) laufen in CI, ebenso Lint und Typecheck des Portals.
- Nach jedem Deploy prüft der Workflow `/api/health` der jeweiligen Umgebung; die Antwort nennt die Umgebung (`env`).
- Ohne Service-Token liefert `GET /api/threads` den Status 401; ein Token in der Query wird abgelehnt.
- `tests/api-agent-loop.test.ts` prüft die Kernschleife mit gefälschtem Modell und Werkzeug (Tool-Call, Freigabe, Pause vor dem Budget, Schrittgrenze).
