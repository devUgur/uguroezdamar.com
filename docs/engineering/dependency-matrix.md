# Laufzeiten und Abhängigkeiten

**Zweck:** Festhalten, welche Laufzeiten und direkten Abhängigkeiten für Release R1 vorgesehen sind und welche größeren Upgrades bewusst separat bleiben. **Pflege:** bei jedem Runtime-/Framework-Upgrade sowie mindestens quartalsweise. **Eigentümer:** Projektverantwortliche.

## Unterstützte Laufzeit

| Komponente | Festlegung | Grund |
| --- | --- | --- |
| Node.js | 24.21.0 (`.nvmrc`, CI und Hosting) | Einheitliche LTS-Laufzeit für lokale Entwicklung, CI und Deployment. |
| pnpm | 10.34.2 (`packageManager`) | Einheitlicher Lockfile- und Workspace-Resolver; Install-Skripte sind explizit freigegeben. |
| Paketmanager-Install | `pnpm install --frozen-lockfile` | CI und Deployment dürfen den Lockfile nicht stillschweigend ändern. |

## Release-R1-Upgrade

Inkompatible Minor-/Patch-Updates innerhalb der bestehenden Major-Version wurden auf einen gemeinsamen Stand aktualisiert. Maßgebliche Direktstände: Next.js 16.4.0, React/React DOM 19.3.0, TypeScript 5.9.3, Tailwind CSS 4.3.3, Turbo 2.11.7, Vitest 5.0.4 und Vite 8.3.4. Der Blog-Frontmatter-Parser verwendet `yaml`; `gray-matter` ist entfernt.

Versionen, die mehr als ein Workspace nutzt, stehen einmal im pnpm-Catalog in `pnpm-workspace.yaml` und werden als `"catalog:"` referenziert. Jedes Workspace deklariert, was es importiert; das Root-`package.json` enthält nur Werkzeuge und die Abhängigkeiten der Tests. `tsup` ist entfernt ([ADR 0017](../architecture/decisions/0017-source-first-workspace-packages.md)).

| Bereich | Entscheidung | Verifikation / Folge |
| --- | --- | --- |
| Vitest 1 → 5 und Vite 8 | Major-Upgrade bewusst mit den vorhandenen Tests durchgeführt | Node ≥22.12 ist erforderlich; Release-Laufzeit Node 24 erfüllt dies. Lokale Regression: 38 bestanden, zwei DB-Integrationstests ohne lokale Test-DB übersprungen. |
| Next.js 16.1 → 16.4 und React 19.2 → 19.3 | Aktuelle kompatible Versionen im Release-Zweig | Lint, Typecheck, Tests und Build liefen lokal. Hosting-Preview und GitHub-CI müssen den Stand bestätigen. |
| `gray-matter` Produktionspfad | Durch `yaml` ersetzt; ungenutztes MDX-Projekt-Fallback entfernt | `pnpm audit --prod` muss ohne Befund enden. Migrationstool bleibt separat. |
| Node-Typen 25 → 24 | Auf deklarierte Laufzeit abgestimmt | Änderungen an Node 26 sind ein eigenes Laufzeit-Upgrade. |

## Bewusst separat zu migrieren

Major-Upgrades von TypeScript 5 auf 7, ESLint 9 auf 10, `framer-motion` 12 auf 14 und `lucide-react` 0 auf 1 werden nicht mit dem Release-Hardening gebündelt. Sie benötigen jeweils eine eigene Kompatibilitätsprüfung, gezielte Migration und Regression. Abhängigkeiten ohne aktive Nutzung sind vor einem Upgrade zu entfernen statt zu aktualisieren.

## Pflegeprozess

1. Direkt- und transitive Updates mit Lockfile und Release Notes prüfen.
2. Major-Upgrades einzeln, in einem eigenen Commit oder PR durchführen.
3. `pnpm install --frozen-lockfile`, Guards, Lint, Typecheck, Tests, Build und `pnpm audit --prod` ausführen.
4. Node-/pnpm-Versionen in `.nvmrc`, `package.json`, CI und Hosting gemeinsam halten.
5. Ergebnisse, offene Upstream-Risiken und notwendige Datenmigrationen aktualisieren.

Siehe auch [Engineering-Qualität](quality.md), [Betrieb und Release](../operations/release-and-recovery.md) sowie [Projektplan](../../PLAN.md).
