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
6. Secrets der Plattform liegen als GitHub-Actions-Secrets und werden beim Deploy in beiden Umgebungen als Worker-Secrets gesetzt: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `PLATFORM_ADMIN_TOKEN`, `GEMINI_API_KEY`, `AGENT_GITHUB_TOKEN`. Sie gehören nicht in Infisical, weil keine Vercel-App sie liest. Der Cloudflare-Token ist auf das Portfolio-Konto beschränkt (ADR 0023, Punkt 3).
7. Zugang: fail closed. Ohne gültiges Cloudflare-Access-Token oder `PLATFORM_ADMIN_TOKEN` antwortet die API nur auf `/api/health`. Sobald Cloudflare Access vor der Subdomain steht, werden `ACCESS_TEAM_DOMAIN` und `ACCESS_AUD` gesetzt.

## Alternativen

- **Plattform im Portal (Next.js auf Vercel):** abgelehnt, weil lang laufende Agentenschleifen, Live-Verbindungen und Agenten-Zustand dort kostenpflichtige Zusatzdienste bräuchten.
- **Google Cloud (Cloud Run, Vertex):** zurückgestellt; erfordert ein Abrechnungskonto. Bleibt hinter den Ports möglich.
- **LiteLLM als Gateway:** abgelehnt für den Start; braucht eigenen Server und Postgres. Der Router im Worker plus optional AI Gateway deckt den Bedarf.

## Konsequenzen

- Free-Plan-Grenzen (u. a. 100.000 Anfragen/Tag, 10 ms CPU pro Worker-Aufruf) stoppen bei Überschreitung, statt abzurechnen. Der nächste Schritt ist Workers Paid.
- Gratis-Gemini-Anfragen dürfen von Google ausgewertet werden; vertrauliche Daten gehören nicht in Aufträge an die Plattform, solange kein bezahltes Modell konfiguriert ist.
- Der Plattform-GitHub-Token kann Branches und Pull Requests anlegen. Er wird fein granular auf die verwalteten Repositories beschränkt (Contents, Pull requests: read/write; Checks, Metadata: read).

## Verifikation

- `pnpm --filter @ugur/platform typecheck` und `pnpm --filter @ugur/platform build` (Wrangler-Dry-Run) laufen in CI.
- Nach jedem Deploy prüft der Workflow `/api/health` der jeweiligen Umgebung; die Antwort nennt die Umgebung (`env`).
- Ohne Token liefert `GET /api/agents` den Status 401.
