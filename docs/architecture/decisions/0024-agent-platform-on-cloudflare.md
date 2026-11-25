# ADR 0024: Agenten-Plattform als Cloudflare Worker

- Status: accepted
- Datum: 2026-11-25
- Beteiligte: Projektverantwortliche
- Ergänzt: [ADR 0020](0020-vercel-hosting.md) und [ADR 0023](0023-cloudflare-dns-and-account-boundaries.md)

## Kontext

Der Owner will KI-Agenten, die per Chat gesteuert werden und dieses Monorepo pflegen: Website, Portal und die Plattform selbst. Die Plattform soll ohne laufende Kosten starten, jeden Modellanbieter austauschbar halten und später ein visuelles Agenten-Büro tragen. Site und Portal bleiben unverändert auf Vercel.

## Entscheidung

1. Neue App `apps/platform`: ein Cloudflare Worker unter `platform.uguroezdamar.com` (Custom Domain im Cloudflare-Konto der Zone). Das ist die einzige App dieses Repositories auf Cloudflare; ADR 0023 gilt für alles andere weiter.
2. Laufzeit: Cloudflare Free Plan. Jeder Agent ist ein Durable Object mit eigener SQLite für den Gesprächsverlauf; gemeinsamer Zustand (Projekte, Agenten, Tasks, Events, Freigaben, Notizen) liegt in D1 `uguroezdamar`, Dateien in R2 `uguroezdamar`, Einstellungen in KV `uguroezdamar-config`. Kein Zugriff auf Neon; die Plattform ist vom Datenmodell der Site getrennt.
3. Modelle nur über `ModelPort` (`apps/platform/src/models`). Agenten kennen Aliase (`chef-smart`, `coder`, `worker-cheap`); welcher Anbieter dahinter steht, ist Konfiguration mit Fallback-Kette und per KV-Schlüssel `models` ohne Deploy änderbar. Start: Gemini-API-Free-Tier, Fallback Workers AI.
4. Agenten ändern Code nur über GitHub: Branches mit Präfix `agent/`, Commits und Pull Requests erst nach Freigabe des Owners in der Plattform. Kein Merge, kein Deploy durch Agenten. Die Regeln aus `AGENTS.md` gelten für Agenten wie für Menschen.
5. Deployment: `.github/workflows/platform-deploy.yml` nach Merge auf `main` (Pfad `apps/platform/**`) oder manuell; GitHub-Environment `platform-production`. Migrationen laufen vor dem Deploy.
6. Secrets der Plattform liegen als GitHub-Actions-Secrets und werden beim Deploy als Worker-Secrets gesetzt: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `PLATFORM_ADMIN_TOKEN`, `GEMINI_API_KEY`, `AGENT_GITHUB_TOKEN`. Sie gehören nicht in Infisical, weil keine Vercel-App sie liest. Der Cloudflare-Token ist auf das Portfolio-Konto beschränkt (ADR 0023, Punkt 3).
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
- Nach jedem Deploy prüft der Workflow `https://platform.uguroezdamar.com/api/health`.
- Ohne Token liefert `GET /api/agents` den Status 401.
