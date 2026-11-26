---
name: release
description: Pushen, Releasen und Ausliefern in uguroezdamar.com. Verwenden vor jedem git push, bevor ein Pull Request dev → main entsteht, und wenn es um Deploys von Site, Portal oder Agenten-API geht.
---

# Release in uguroezdamar.com

Veröffentlichen, Mergen und Ausliefern sind drei getrennte Entscheidungen des Owners.

## Branches

- Gearbeitet wird direkt auf `dev`, ohne Feature-Branches.
- `main` ist Produktion und ändert sich nur per Pull Request `dev` → `main` mit grüner CI (`validate`).
- Nie direkt auf `main` pushen, nie selbst mergen.

## Vor jedem Push

1. `pnpm check` muss grün sein (Lint, Migrationscheck, Typecheck, Tests). Bei Änderungen an `apps/api` zusätzlich `pnpm --filter @ugur/api build` (Wrangler-Dry-Run).
2. Anzahl der Commits nennen: `git log --oneline origin/dev..HEAD`.
3. Deploy-Wirkung nennen:

| Änderung auf `dev` | Wirkung |
| --- | --- |
| `apps/api/**` oder `.github/workflows/api-deploy.yml` | Deploy nach `api-dev` (Dev-Umgebung, ohne Freigabe) |
| `apps/site`, `apps/portal`, `packages/**` | Vercel-Preview-Deployments, keine Produktion |
| alles | CI läuft |

4. Nur eigene Dateien committen. Fremde, uncommittete Änderungen des Owners bleiben unangetastet.

## Release nach Produktion

1. PR `dev` → `main` öffnen: `gh pr create --base main --head dev`. Inhalt: was sich ändert, wie man es prüft, welche Doku nachgezogen ist.
2. Der Owner merged. Der Merge löst aus:
   - Agenten-API: Deploy nach `api.uguroezdamar.com` (GitHub-Environment `api-production`)
   - Site und Portal: Vercel baut ein *Staged*-Deployment; live geht es erst nach manuellem *Promote* durch den Owner ([`docs/operations/preview.md`](../../../docs/operations/preview.md))
3. Danach prüfen: `pnpm ugur smoke --site <url> --portal <url>` bzw. `https://api.uguroezdamar.com/api/health`. Nichts als erledigt melden, was nicht live geprüft ist.

## Doku im selben Commit

Änderungen an Deployment, Datenmodell, Auth, Publishing oder Paketgrenzen aktualisieren die betroffene Doku mit: ADR, App-README, `docs/operations/*.md`, `PLAN.md`. ADRs liegen unter `docs/architecture/decisions/`.
