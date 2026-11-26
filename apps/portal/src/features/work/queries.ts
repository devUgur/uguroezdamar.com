import "server-only";

import { AgentsApiError, agentsApi, agentsApiOrigin } from "@/src/adapters/agents-api";
import { getCurrentSession } from "@/src/adapters/auth";
import type { WorkTask } from "./types";

export async function listWorkTasks(): Promise<{ tasks: WorkTask[]; error: string | null }> {
  const session = await getCurrentSession();
  if (!session) throw new Error("Nicht angemeldet.");
  try {
    return { tasks: await agentsApi<WorkTask[]>("/api/tasks?project=uguroezdamar", session.email), error: null };
  } catch (error) {
    const message = error instanceof AgentsApiError && error.status === 404
      ? "Die Agenten-API kennt das Aufgabenboard noch nicht. Bitte API-Dev aktualisieren."
      : error instanceof Error ? error.message : "Das Aufgabenboard konnte nicht geladen werden.";
    return { tasks: [], error: message };
  }
}

export function workLiveOrigin(): string | null {
  return agentsApiOrigin();
}
