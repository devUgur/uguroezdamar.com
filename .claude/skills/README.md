# Projekt-Skills

Agent Skills (offener Standard, `SKILL.md` je Ordner) für dieses Repository. Claude Code lädt sie automatisch, wenn die Beschreibung zur Aufgabe passt; Skills mit `disable-model-invocation: true` laufen nur auf Aufruf (`/grill-me`).

Regeln für Skills:

- `AGENTS.md` hat immer Vorrang vor einem Skill.
- Fremde Skills werden vor der Übernahme gelesen, geprüft und mit Commit-Stand festgehalten. Kein automatisches Nachladen (`find-skills`, Plugin-Marktplätze ohne festen Stand).
- Kein Skill darf Werkzeuge pauschal freigeben (`allowed-tools`) oder beim Laden Befehle ausführen (`` !`…` ``). Solche Zeilen werden beim Übernehmen entfernt.
- Aktualisieren: Quelle am neuen Commit holen, Diff lesen, Tabelle unten anpassen.

## Eigene Skills

| Skill | Wofür |
| --- | --- |
| `design-system` | Rangfolge Briefing → Tokens → Design-Skills, Regeln aus `AGENTS.md` |
| `release` | Push, PR `dev` → `main`, Deploy-Wirkung, Prüfung danach |
| `modal-llm` | Eigene Modelle auf Modal: Workspace, Kosten, Schlüssel, Deploy, neues Modell |

## Übernommene Skills

| Skill | Quelle (Commit) | Lizenz | Lokale Änderung |
| --- | --- | --- | --- |
| `frontend-design` | anthropics/skills `e4bb5d9` | Apache-2.0 (`LICENSE.txt`) | – |
| `shadcn` | shadcn-ui/ui `0e5b2e6` | MIT | `allowed-tools` und automatisches `npx shadcn info` entfernt; Hinweis auf `pnpm ui:add` und `packages/ui`; `evals/` und Bilder weggelassen |
| `web-design-guidelines` | vercel-labs/agent-skills `5a37a63` | MIT | – |
| `vercel-react-best-practices` | vercel-labs/agent-skills `5a37a63` (`react-best-practices`) | MIT | – |
| `vercel-composition-patterns` | vercel-labs/agent-skills `5a37a63` (`composition-patterns`) | MIT | – |
| `workers-best-practices`, `durable-objects`, `wrangler`, `agents-sdk` | cloudflare/skills `ff191de` | Apache-2.0 | – |
| `grill-me`, `grilling` | mattpocock/skills `6f7f783` | MIT | – |
| `improve-codebase-architecture`, `codebase-design`, `domain-modeling` | mattpocock/skills `6f7f783` | MIT | – |
| `agentic-actions-auditor`, `differential-review` | trailofbits/skills `149d7b2` | CC BY-SA 4.0, © Trail of Bits | `allowed-tools` entfernt |

Hinweis zu `domain-modeling` und `improve-codebase-architecture`: Sie erwarten ADRs unter `docs/adr/`. In diesem Repository liegen sie unter `docs/architecture/decisions/`; neue ADRs gehören dorthin, mit der dortigen Nummerierung.
