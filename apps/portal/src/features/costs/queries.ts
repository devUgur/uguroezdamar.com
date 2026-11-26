import "server-only";

import { AgentsApiError, agentsApi } from "@/src/adapters/agents-api";
import { getCurrentSession } from "@/src/adapters/auth";
import type { CostReport } from "./types";

export async function getCostReport(): Promise<{ report: CostReport | null; error: string | null }> {
  const session = await getCurrentSession();
  if (!session) throw new Error("Nicht angemeldet.");
  try {
    return { report: await agentsApi<CostReport>("/api/costs?days=30", session.email), error: null };
  } catch (error) {
    return { report: null, error: error instanceof AgentsApiError && error.status === 404
      ? "Die Agenten-API liefert die Kostenübersicht noch nicht."
      : error instanceof Error ? error.message : "Die Kostenübersicht konnte nicht geladen werden." };
  }
}
