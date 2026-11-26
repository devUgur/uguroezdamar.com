import "server-only";

import { AgentsApiError, agentsApi, agentsApiOrigin, isAgentsApiId } from "@/src/adapters/agents-api";
import { requireSession } from "@/src/adapters/session";
import type { AgentSummary, Approval, ModelCatalog, OfficeScope, OfficeSnapshot, OfficeTask, OfficeWorkspace, Thread, ThreadDetail, ThreadProject } from "./types";

/** Every chat read runs as the signed-in admin; without a session the portal login takes over. */
export async function requireActor(): Promise<string> {
  return (await requireSession()).email;
}

export async function listThreads(): Promise<Thread[]> {
  return agentsApi<Thread[]>("/api/threads", await requireActor());
}

export async function getThread(threadId: string): Promise<ThreadDetail | null> {
  if (!isAgentsApiId(threadId)) return null;
  const actor = await requireActor();
  try {
    return await agentsApi<ThreadDetail>(`/api/threads/${threadId}`, actor);
  } catch (error) {
    if (error instanceof Error && "status" in error && error.status === 404) return null;
    throw error;
  }
}

export async function getModelCatalog(): Promise<ModelCatalog> {
  return agentsApi<ModelCatalog>("/api/models", await requireActor());
}

/** Registered projects: the inner scopes of the office navigation. */
export async function listProjects(): Promise<ThreadProject[]> {
  return agentsApi<ThreadProject[]>("/api/projects", await requireActor());
}

export async function listAgents(): Promise<AgentSummary[]> {
  return agentsApi<AgentSummary[]>("/api/agents", await requireActor());
}

/** Loads the office's first authoritative frame on the server to avoid a local-preview jump at hydration. */
export async function loadAgentOffice(): Promise<{
  agents: AgentSummary[];
  presence: OfficeSnapshot | null;
  presenceError: string | null;
}> {
  const actor = await requireActor();
  const [agents, officeResult] = await Promise.all([
    agentsApi<AgentSummary[]>("/api/agents", actor),
    agentsApi<OfficeSnapshot>("/api/office/state", actor).then(
      (snapshot) => ({ snapshot, error: null as string | null }),
      (error: unknown) => ({ snapshot: null, error: officeError(error) }),
    ),
  ]);
  return { agents, presence: officeResult.snapshot, presenceError: officeResult.error };
}

/** A widget source that failed shows as empty with its cause logged; the office itself stays usable. */
async function orFallback<T>(what: string, load: Promise<T>, fallback: T): Promise<T> {
  try {
    return await load;
  } catch (error) {
    console.error(`office ${what} load failed`, error instanceof Error ? error.message : error);
    return fallback;
  }
}

/**
 * The fullscreen office for one scope: the company (no project) or one registered project. Unknown projects fall back
 * to the company level, so a stale link never opens a scope that does not exist.
 */
export async function loadOfficeWorkspace(requestedScope: string | null): Promise<OfficeWorkspace> {
  const actor = await requireActor();
  const [office, projects] = await Promise.all([
    loadAgentOffice(),
    orFallback("projects", agentsApi<ThreadProject[]>("/api/projects", actor), []),
  ]);
  const scope: OfficeScope = requestedScope && projects.some((project) => project.id === requestedScope) ? requestedScope : null;
  const project = scope ? `project=${encodeURIComponent(scope)}` : "";
  const today = new Date().toISOString().slice(0, 10);
  const [tasks, approvals, usage] = await Promise.all([
    orFallback("tasks", agentsApi<OfficeTask[]>(`/api/tasks${project ? `?${project}` : ""}`, actor), []),
    orFallback("approvals", agentsApi<Approval[]>("/api/approvals", actor), []),
    orFallback(
      "usage",
      agentsApi<{ totals: { costUsd: number; calls: number } | null; runs: { runs: number; running: number | null } | null }>(`/api/usage/summary?from=${today}${project ? `&${project}` : ""}`, actor).then((summary) => ({
        costUsd: summary.totals?.costUsd ?? 0,
        calls: summary.totals?.calls ?? 0,
        runs: summary.runs?.runs ?? 0,
        running: summary.runs?.running ?? 0,
      })),
      null,
    ),
  ]);
  return { ...office, projects, scope, tasks, approvals, today: usage };
}

function officeError(error: unknown): string {
  if (!(error instanceof AgentsApiError)) return "Der Bürostatus konnte nicht geladen werden.";
  if (error.status === 404) return "Der API-Worker kennt den Büro-Endpunkt noch nicht. Bitte API-Dev aktualisieren.";
  if (error.status === 401 || error.status === 403) return "Die API hat den Bürostatus-Zugriff abgelehnt. API-Zugang prüfen.";
  if (error.status === 502 || error.status === 503) return error.message;
  return `Bürostatus konnte nicht geladen werden (HTTP ${error.status}).`;
}

export function liveOrigin(): string | null {
  return agentsApiOrigin();
}
