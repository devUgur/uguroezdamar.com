import type { Metadata } from "next";
import { AgentOffice, loadAgentOffice, liveOrigin } from "@/src/features/agents";

export const metadata: Metadata = { title: "Agenten" };

export default async function AgentsPage() {
  try {
    const office = await loadAgentOffice();
    return <AgentOffice agents={office.agents} liveOrigin={liveOrigin()} initialPresence={office.presence} initialPresenceError={office.presenceError} />;
  } catch (error) {
    const unavailable = error instanceof Error ? error.message : "Agenten-API nicht erreichbar.";
    return <p className="p-8 text-sm text-destructive">{unavailable}</p>;
  }
}
