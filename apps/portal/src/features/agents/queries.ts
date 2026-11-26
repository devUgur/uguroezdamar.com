import "server-only";

import { redirect } from "next/navigation";
import { agentsApi, agentsApiOrigin, isAgentsApiId } from "@/src/adapters/agents-api";
import { getCurrentSession } from "@/src/adapters/auth";
import type { AgentSummary, ModelCatalog, Thread, ThreadDetail } from "./types";

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

export function liveOrigin(): string | null {
  return agentsApiOrigin();
}
