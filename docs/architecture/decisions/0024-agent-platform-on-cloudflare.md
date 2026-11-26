# ADR 0024: Agenten-Plattform als Cloudflare Worker

- Status: accepted
- Datum: 2026-11-25
- Beteiligte: Projektverantwortliche
- Fortgeschrieben: 2026-11-25 – zwei Umgebungen (`dev`, Produktion), Agenten arbeiten auf `dev`
- Ergänzt: [ADR 0020](0020-vercel-hosting.md) und [ADR 0023](0023-cloudflare-dns-and-account-boundaries.md)

## Kontext

Der Owner will KI-Agenten, die per Chat gesteuert werden und dieses Monorepo pflegen: Website, Portal und die Plattform selbst. Die Plattform soll ohne laufende Kosten starten, jeden Modellanbieter austauschbar halten und später ein visuelles Agenten-Büro tragen. Site und Portal bleiben unverändert auf Vercel.

## Entscheidung

1. Neue App `apps/platform`: Cloudflare Worker in zwei Umgebungen, jeweils mit Custom Domain im Cloudflare-Konto der Zone:
   - Produktion: Worker `uguroezdamar-platform`, `platform.uguroezdamar.com`, Branch `main`, D1 `uguroezdamar`, KV `uguroezdamar-config`
   - Dev: Worker `uguroezdamar-platform-dev`, `platform-dev.uguroezdamar.com`, Branch `dev`, D1 `uguroezdamar-dev`, KV `uguroezdamar-config-dev` (Wrangler-Umgebung `dev`)

   Beide teilen den R2-Bucket; Dev-Dateien liegen unter `platform-dev/`. Das ist die einzige App dieses Repositories auf Cloudflare; ADR 0023 gilt für alles andere weiter.
2. Laufzeit: Cloudflare Free Plan. Jeder Agent ist ein Durable Object mit eigener SQLite für den Gesprächsverlauf; gemeinsamer Zustand (Projekte, Agenten, Tasks, Events, Freigaben, Notizen) liegt in D1 `uguroezdamar`, Dateien in R2 `uguroezdamar`, Einstellungen in KV (je Umgebung, siehe Punkt 1). Kein Zugriff auf Neon; die Plattform ist vom Datenmodell der Site getrennt.
3. Modelle nur über `ModelPort` (`apps/platform/src/models`). Agenten kennen Aliase (`chef-smart`, `coder`, `worker-cheap`); welcher Anbieter dahinter steht, ist Konfiguration mit Fallback-Kette und per KV-Schlüssel `models` ohne Deploy änderbar. Start: Gemini-API-Free-Tier, Fallback Workers AI.
4. Agenten ändern Code nur über GitHub: Commits auf `dev` (Standard) oder auf `agent/…`, nie auf `main`. Commits und Pull Requests laufen erst nach Freigabe des Owners in der Plattform. Pull Requests gehen von `agent/…` nach `dev` oder von `dev` nach `main`. Agenten mergen nie. Ein freigegebener Commit auf `dev` wird automatisch in die Dev-Umgebung ausgeliefert; Produktion erreicht er nur über den Merge des Owners. Die Regeln aus `AGENTS.md` gelten für Agenten wie für Menschen.
5. Deployment: `.github/workflows/platform-deploy.yml` bei Push auf `dev` (GitHub-Environment `platform-dev`, ohne Freigabe) und nach Merge auf `main` (`platform-production`), jeweils nur bei Änderungen unter `apps/platform/**`, oder manuell. Migrationen laufen vor dem Deploy; Code und Worker-Secrets gehen mit `wrangler deploy --secrets-file` als eine Version hoch.
6. Secrets der Plattform liegen als GitHub-Actions-Secrets und werden beim Deploy in beiden Umgebungen als Worker-Secrets gesetzt: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `PLATFORM_ADMIN_TOKEN`, `GEMINI_API_KEY`, `AGENT_GITHUB_TOKEN`. Sie gehören nicht in Infisical, weil keine Vercel-App sie liest. Einzige Ausnahme ist eine Kopie von `PLATFORM_ADMIN_TOKEN` in Infisical, damit der Owner sein Login nachsehen kann; Quelle für den Deploy bleibt GitHub. Der Cloudflare-Token ist auf das Portfolio-Konto beschränkt (ADR 0023, Punkt 3).
7. Zugang: fail closed. Ohne gültiges Cloudflare-Access-Token oder `PLATFORM_ADMIN_TOKEN` antwortet die API nur auf `/api/health`. Das Token wird nur im `Authorization`-Header angenommen, nie in der URL. Der Live-WebSocket nutzt ein Einmal-Ticket (`POST /api/live-ticket`, 60 s gültig, im `LiveHub` gespeichert und beim Verbinden verbraucht). Sobald Cloudflare Access vor der Subdomain steht, werden `ACCESS_TEAM_DOMAIN` und `ACCESS_AUD` gesetzt.

8. Ausführung in Etappen: Die API spricht Agenten über `AgentRuntimePort` an (`src/runtime/port.ts`); `chat` und `resume` nehmen Arbeit nur an. Die Schleife (`src/runtime/loop.ts`, ohne Cloudflare-APIs testbar) läuft in Durable-Object-Alarmen. Jede Etappe hat ein eigenes Budget von 40 externen Subrequests; Grund ist die Grenze des Free Plans von 50 pro Aufruf. Vor dem Limit hält sie an und plant die nächste Etappe. Höchstens 24 Schritte pro Auftrag. Nachrichten, die während eines Laufs kommen, warten im Eingang bis zur nächsten Etappe.
9. Antworten werden gestreamt: Der OpenAI-kompatible Adapter liest Server-Sent Events, und der Live-Hub verteilt den Text gebündelt alle 250 ms (`delta`, nicht gespeichert). Gespeichert wird die fertige Antwort als Event `message`.
10. Freigaben tragen eine Zusammenfassung, eine Risikostufe (`security` für Workflows, Plattform-Konfiguration, Auth, Freigaberegeln und Secret-Manifest; `release` für PRs `dev` → `main`), Warnungen und laufen nach 24 Stunden ab (`src/approvals.ts`, Migration 0003).

## Alternativen

- **Plattform im Portal (Next.js auf Vercel):** abgelehnt, weil lang laufende Agentenschleifen, Live-Verbindungen und Agenten-Zustand dort kostenpflichtige Zusatzdienste bräuchten.
- **Google Cloud (Cloud Run, Vertex):** zurückgestellt; erfordert ein Abrechnungskonto. Bleibt hinter den Ports möglich.
- **LiteLLM als Gateway:** abgelehnt für den Start; braucht eigenen Server und Postgres. Der Router im Worker plus optional AI Gateway deckt den Bedarf.

## Konsequenzen

- Free-Plan-Grenzen (u. a. 100.000 Anfragen/Tag, 50 externe Subrequests pro Aufruf, CPU-Zeit pro Aufruf) stoppen bei Überschreitung, statt abzurechnen. Die Etappen aus Punkt 8 halten die Subrequests ein; CPU-Zeit zählt nur reine Rechenzeit, nicht das Warten auf Modell oder GitHub. Reicht das nachweislich nicht, ist Workers Paid eine Entscheidung des Owners.
- Gratis-Gemini-Anfragen dürfen von Google ausgewertet werden; vertrauliche Daten gehören nicht in Aufträge an die Plattform, solange kein bezahltes Modell konfiguriert ist.
- Der Plattform-GitHub-Token kann Branches und Pull Requests anlegen. Er wird fein granular auf die verwalteten Repositories beschränkt (Contents, Pull requests: read/write; Checks, Metadata: read).

## Verifikation

- `pnpm --filter @ugur/platform typecheck` und `pnpm --filter @ugur/platform build` (Wrangler-Dry-Run) laufen in CI.
- Nach jedem Deploy prüft der Workflow `/api/health` der jeweiligen Umgebung; die Antwort nennt die Umgebung (`env`).
- Ohne Token liefert `GET /api/agents` den Status 401; ein Token in der Query wird abgelehnt.
- `tests/platform-agent-loop.test.ts` prüft die Kernschleife mit gefälschtem Modell und Werkzeug (Tool-Call, Freigabe, Pause vor dem Budget, Schrittgrenze).
