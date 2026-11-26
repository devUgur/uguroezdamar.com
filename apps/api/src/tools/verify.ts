import { githubToken } from "../github/credentials.ts";
import { assertRef, COMMAND_NAMES, isCommand } from "../workstation/commands.ts";
import { gh, readTarget, repoMeta } from "./github.ts";
import type { Tool, ToolContext } from "./port.ts";
import { str, ToolInputError } from "./port.ts";
import { executeInWorkstation } from "./sandbox.ts";

/**
 * Checking a change, independent of where it runs (plan stage 4). Two interchangeable ways:
 * - workstation: build and test in an own container (ADR 0036), fast, before a commit; needs Workers Paid;
 * - ci: the repository's own GitHub Actions after a push; free (public repositories, 2,000 minutes for private ones).
 * The agent only knows code_verify; which way runs is configuration, so switching costs no prompt or tool change.
 */
const CI_POLLS = 3;
const CI_POLL_MS = 10_000;
const LOG_CHARS = 4_000;
const GITHUB = "https://api.github.com";

interface CheckRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  app?: { slug?: string };
  output?: { title?: string | null; summary?: string | null; text?: string | null };
}

export type VerifyState = "passed" | "failed" | "pending" | "no_ci";

export interface CiFailure {
  check: string;
  url: string;
  /** The end of the job log, or the check's annotations and summary when the log is not readable. */
  log: string;
  source: "job_log" | "annotations";
}

/** Summarises check runs: failed beats pending beats passed; none at all means the repository has no CI. */
export function ciState(runs: Pick<CheckRun, "status" | "conclusion">[]): VerifyState {
  if (!runs.length) return "no_ci";
  if (runs.some((run) => run.status === "completed" && run.conclusion && !["success", "neutral", "skipped"].includes(run.conclusion))) return "failed";
  if (runs.some((run) => run.status !== "completed")) return "pending";
  return "passed";
}

/** Last part of a log (the errors are at the end), with GitHub's timestamps removed and secrets-like tokens masked. */
export function logTail(log: string, max = LOG_CHARS): string {
  const clean = log
    .replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z /gm, "")
    .replace(/\b(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g, "[geschwärzt]");
  return clean.length > max ? `…${clean.slice(-max)}` : clean;
}

async function failureDetail(context: ToolContext, repo: string, run: CheckRun): Promise<CiFailure> {
  // GitHub Actions: the check run id is the job id. Reading job logs needs the app permission "Actions: Read".
  if (run.app?.slug === "github-actions") {
    try {
      context.budget.take();
      const token = await githubToken(context.env, context.tenantId, repo.split("/")[0] ?? "", () => context.budget.take());
      const response = await fetch(`${GITHUB}/repos/${repo}/actions/jobs/${run.id}/logs`, {
        headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "user-agent": "uguroezdamar-api", "x-github-api-version": "2022-11-28" },
      });
      if (response.ok) return { check: run.name, url: run.html_url, log: logTail(await response.text()), source: "job_log" };
    } catch {
      // Fall through to the annotations, which only need "Checks: Read".
    }
  }
  const annotations = await gh<{ path: string; start_line: number; annotation_level: string; message: string }[]>(context, `/repos/${repo}/check-runs/${run.id}/annotations?per_page=30`).catch(() => []);
  const lines = [
    run.output?.title ?? "",
    run.output?.summary ?? "",
    ...annotations.map((note) => `${note.annotation_level}: ${note.path}:${note.start_line} ${note.message}`),
    run.output?.text ?? "",
  ].filter(Boolean);
  return {
    check: run.name,
    url: run.html_url,
    log: logTail(lines.join("\n") || "Keine Details verfügbar. Für vollständige Logs braucht die GitHub App das Recht „Actions: Read“."),
    source: "annotations",
  };
}

async function verifyInCi(context: ToolContext, repo: string, ref: string) {
  let runs: CheckRun[] = [];
  for (let poll = 0; poll < CI_POLLS; poll += 1) {
    runs = (await gh<{ check_runs: CheckRun[] }>(context, `/repos/${repo}/commits/${encodeURIComponent(ref)}/check-runs?per_page=50`)).check_runs;
    const state = ciState(runs);
    if (state !== "pending" || poll === CI_POLLS - 1) break;
    // Waiting costs no external call; the run stays within its stage budget.
    await new Promise((resolve) => setTimeout(resolve, CI_POLL_MS));
  }
  const state = ciState(runs);
  const failed = runs.filter((run) => run.status === "completed" && run.conclusion && !["success", "neutral", "skipped"].includes(run.conclusion)).slice(0, 2);
  const failures = state === "failed" ? await Promise.all(failed.map((run) => failureDetail(context, repo, run))) : [];
  return {
    way: "ci" as const,
    repo,
    ref,
    state,
    checks: runs.map((run) => ({ name: run.name, status: run.status, conclusion: run.conclusion })),
    failures,
    next:
      state === "pending"
        ? "CI läuft noch. Arbeite an etwas anderem weiter oder rufe code_verify gleich erneut auf."
        : state === "failed"
          ? "Fehler beheben, auf denselben Branch committen und erneut prüfen."
          : state === "no_ci"
            ? "Das Repository hat keine CI. Schlage einen Workflow vor (.github/workflows/ci.yml mit install und check) oder bitte um die Workstation."
            : "Alle Checks grün.",
  };
}

const codeVerify: Tool = {
  spec: {
    name: "code_verify",
    description: `Prüft einen Branch oder Commit: in der Workstation (${COMMAND_NAMES.join(", ")}), sonst über die CI des Repositories nach dem Push. Liefert Ergebnis und bei Fehlern das Log-Ende.`,
    parameters: {
      type: "object",
      properties: {
        ref: { type: "string", description: "Branch/Commit, z. B. agent/…" },
        command: { type: "string", enum: COMMAND_NAMES, description: "nur Workstation, Standard check" },
        repo: { type: "string", description: "owner/name, nur lesend; leer = dieses Projekt" },
      },
      required: ["ref"],
    },
  },
  async run(args, context) {
    const target = await readTarget(args, context);
    const ref = assertRef(str(args, "ref", target.ref));
    const command = typeof args.command === "string" ? args.command : "check";
    if (!isCommand(command)) throw new ToolInputError(`Befehl muss einer von ${COMMAND_NAMES.join(", ")} sein.`);
    const meta = await repoMeta(context, target.repo);
    if (meta.private) await context.markPrivate?.([meta.full_name]);
    if (context.env.WORKSTATION) {
      const result = await executeInWorkstation(context, { repo: meta.full_name, ref, private: meta.private, command });
      return { way: "workstation" as const, repo: meta.full_name, ref, state: result.ok ? "passed" : "failed", ...result };
    }
    return verifyInCi(context, meta.full_name, ref);
  },
};

export const verifyTools: Tool[] = [codeVerify];
