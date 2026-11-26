import "server-only";

import { redirect } from "next/navigation";
import { AgentsApiError, agentsApi, agentsApiOrigin, isAgentsApiId } from "@/src/adapters/agents-api";
import { getCurrentSession } from "@/src/adapters/auth";
import type { AgentSummary, ModelCatalog, OfficeSnapshot, Thread, ThreadDetail } from "./types";

/** Every chat read runs as the signed-in admin; without a session the portal login takes over. */
export async function requireActor(): Promise<string> {
  const session = await getCurrentSession();
  if (!session) redirect("/login?next=/chat");
  return session.email;
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
