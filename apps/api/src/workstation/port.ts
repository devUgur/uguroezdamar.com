import type { Env } from "../env.ts";
import type { WorkstationCommand } from "./commands.ts";

/** One step of a run as the container executed it. */
export interface StepResult {
  name: string;
  command: string;
  exitCode: number;
  durationMs: number;
  output: string;
  truncated: boolean;
}

/** What a workstation is asked to do (ADR 0036). Everything the container may reach follows from this. */
export interface WorkstationJob {
  runId: string;
  tenantId: string;
  /** owner/name; the only repository the git gateway lets through. */
  repo: string;
  ref: string;
  /** Public repositories are cloned without any credential. */
  private: boolean;
  /** A name from the allowlist, or "preview" for a preview upload; the steps follow from it (commands.ts). */
  command: WorkstationCommand | "preview";
  /** Set for preview uploads: the only Worker the Cloudflare gateway lets through. */
  preview?: { workerName: string; alias: string };
}

export interface WorkstationResult {
  runId: string;
  /** Commit that was actually checked out. */
  commit: string | null;
  ok: boolean;
  /** Clone failed, a step failed, or the run hit its time limit. */
  failedAt: string | null;
  steps: StepResult[];
  durationMs: number;
}

/** The seam to the container. The Durable Object implements it; tests use a fake. */
export interface WorkstationPort {
  run(job: WorkstationJob): Promise<WorkstationResult>;
}

export class WorkstationUnavailable extends Error {
  constructor() {
    super("Workstations sind nicht eingerichtet: Der Container der Agenten-API ist noch nicht aktiviert (ADR 0036).");
  }
}

/** Name of the Durable Object of one run; a new name per run, so no two runs share a container. */
export function workstationName(tenantId: string, runId: string): string {
  return `ws:${tenantId}:${runId}`;
}

/** The workstation of one run, or an error when the container binding is not configured yet. */
export function workstationFor(env: Env, tenantId: string, runId: string): WorkstationPort {
  if (!env.WORKSTATION) throw new WorkstationUnavailable();
  return env.WORKSTATION.get(workstationName(tenantId, runId)) as unknown as WorkstationPort;
}
