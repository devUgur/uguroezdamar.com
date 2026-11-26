import type { Metadata } from "next";
import { AgentOffice, loadAgentOffice, liveOrigin } from "@/src/features/agents";

export const metadata: Metadata = { title: "Agenten" };

/** `?agent=<id>` opens the office with that agent's sheet, so the board and the organization can point at a person. */
export default async function AgentsPage({ searchParams }: { searchParams: Promise<{ agent?: string | string[] }> }) {
  const { agent } = await searchParams;
  const initialAgentId = typeof agent === "string" ? agent : null;
  try {
    const office = await loadAgentOffice();
    return <AgentOffice agents={office.agents} liveOrigin={liveOrigin()} initialPresence={office.presence} initialPresenceError={office.presenceError} initialAgentId={initialAgentId} />;
  } catch (error) {
    const unavailable = error instanceof Error ? error.message : "Agenten-API nicht erreichbar.";
    return <p className="p-8 text-sm text-destructive">{unavailable}</p>;
  }
}
