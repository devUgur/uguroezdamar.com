import { PROTECTED_PATHS } from "../approvals.ts";

/**
 * The action catalog of the policy engine (ADR 0040, phase P2). Every tool call is one action of a risk class;
 * the project's autonomy level decides per class whether it runs, waits for Ugur or is refused.
 */
export const AUTONOMY_LEVELS = ["manual", "balanced", "high", "max"] as const;
export type AutonomyLevel = (typeof AUTONOMY_LEVELS)[number];

/**
 * Until the owner chooses a level for a project, it works as before P2: every write waits for approval.
 * ADR 0040, O4 recommends "balanced"; that is the owner's call per project.
 */
export const DEFAULT_AUTONOMY: AutonomyLevel = "manual";

export type ActionClass =
  | "read"
  | "work"
  | "branch"
  | "preview"
  | "pr"
  | "dev"
  | "deps"
  | "pipeline"
  | "release"
  | "project";

export type Verdict = "allow" | "approve";

interface ClassRule {
  label: string;
  /** What happens at manual, balanced, high and max. */
  levels: Record<AutonomyLevel, Verdict>;
  /** Never automatic, whatever the project says: the global limit of ADR 0040. */
  hard?: boolean;
}

export const CLASSES: Record<ActionClass, ClassRule> = {
  read: { label: "Lesen, Wissen, Prüfen", levels: { manual: "allow", balanced: "allow", high: "allow", max: "allow" } },
  work: { label: "Aufgaben im Backlog anlegen", levels: { manual: "allow", balanced: "allow", high: "allow", max: "allow" } },
  branch: { label: "Commit auf agent/…", levels: { manual: "approve", balanced: "allow", high: "allow", max: "allow" } },
  preview: { label: "Preview-Deploy", levels: { manual: "approve", balanced: "allow", high: "allow", max: "allow" } },
  pr: { label: "Pull Request nach dev", levels: { manual: "approve", balanced: "approve", high: "allow", max: "allow" } },
  dev: { label: "Commit direkt auf dev", levels: { manual: "approve", balanced: "approve", high: "approve", max: "allow" } },
  deps: { label: "Abhängigkeiten ändern", levels: { manual: "approve", balanced: "approve", high: "approve", max: "allow" } },
  pipeline: { label: "CI/CD, Deploy-Konfiguration, Anmeldung, Freigaberegeln", levels: { manual: "approve", balanced: "approve", high: "approve", max: "approve" }, hard: true },
  release: { label: "Release-PR nach main", levels: { manual: "approve", balanced: "approve", high: "approve", max: "approve" }, hard: true },
  project: { label: "Repositories anlegen oder registrieren", levels: { manual: "approve", balanced: "approve", high: "approve", max: "approve" }, hard: true },
};

const DEPENDENCY_FILES = /(^|\/)(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|package-lock\.json|yarn\.lock|requirements[^/]*\.txt|pyproject\.toml|poetry\.lock|go\.mod|go\.sum|Cargo\.(toml|lock))$/;

export interface ClassifiedAction {
  class: ActionClass;
  /** Short and concrete, for the decision log and the approval card. */
  detail: string;
}

function commitPaths(args: Record<string, unknown>): string[] {
  const files = Array.isArray(args.files) ? (args.files as { path?: unknown }[]) : [];
  return files.map((file) => (typeof file.path === "string" ? file.path.replace(/^\/+/, "") : "?"));
}

/**
 * Which class a call belongs to. Tools that change nothing outside the platform are "read"; the classes of writing
 * tools depend on their arguments: a commit is judged by its branch and the paths it touches, the riskiest wins.
 */
export function classify(tool: string, args: Record<string, unknown>, writeMode: "pr-only" | "dev-first" = "pr-only"): ClassifiedAction {
  switch (tool) {
    case "task_create":
      return { class: "work", detail: `Aufgabe „${String(args.title ?? "")}“` };
    case "task_refine":
      return { class: "work", detail: "Ziel und Abnahmekriterien der Aufgabe" };
    case "repo_commit_files": {
      const paths = commitPaths(args);
      const branch = typeof args.branch === "string" && args.branch ? args.branch : writeMode === "dev-first" ? "dev" : "?";
      const guarded = paths.filter((path) => PROTECTED_PATHS.some((entry) => entry.pattern.test(path)));
      if (guarded.length) return { class: "pipeline", detail: `Commit auf ${branch}: ${guarded.join(", ")}` };
      const dependencies = paths.filter((path) => DEPENDENCY_FILES.test(path));
      if (dependencies.length) return { class: "deps", detail: `Commit auf ${branch}: ${dependencies.join(", ")}` };
      if (branch === "dev") return { class: "dev", detail: `Commit auf dev: ${paths.length} Datei(en)` };
      if (branch.startsWith("agent/")) return { class: "branch", detail: `Commit auf ${branch}: ${paths.length} Datei(en)` };
      // Any other branch is refused by the tool itself (main, production); still never automatic.
      return { class: "release", detail: `Commit auf ${branch}` };
    }
    case "repo_open_pull_request": {
      const branch = String(args.branch ?? "?");
      return branch === "dev" ? { class: "release", detail: "Pull Request dev → main" } : { class: "pr", detail: `Pull Request ${branch} → dev` };
    }
    case "preview_deploy":
      return { class: "preview", detail: `Preview von ${String(args.ref ?? args.pullRequest ?? "?")}` };
    case "project_register":
      return { class: "project", detail: `Projekt registrieren: ${String(args.repo ?? "?")}` };
    case "repo_create":
      return { class: "project", detail: `Repository anlegen: ${String(args.name ?? "?")}` };
    default:
      return { class: "read", detail: tool };
  }
}
