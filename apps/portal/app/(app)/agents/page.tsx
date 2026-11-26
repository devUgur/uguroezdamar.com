import type { Metadata } from "next";
import { AgentOffice, listAgents, liveOrigin, type AgentSummary } from "@/src/features/agents";

export const metadata: Metadata = { title: "Agenten" };

export default async function AgentsPage() {
  let agents: AgentSummary[] = [];
  let unavailable: string | null = null;
  try {
    agents = await listAgents();
  } catch (error) {
    unavailable = error instanceof Error ? error.message : "Agenten-API nicht erreichbar.";
  }
  if (unavailable) return <p className="p-8 text-sm text-destructive">{unavailable}</p>;
  return <AgentOffice agents={agents} liveOrigin={liveOrigin()} />;
}
