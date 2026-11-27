import type { ReactNode } from "react";
import { portalUrl } from "@/src/adapters/session";
import { liveOrigin, loadOfficeRoom } from "../../queries";
import { AgentOffice } from "./AgentOffice";
import { OfficeSidebar } from "./OfficeSidebar";

/**
 * The room around every scope page, rendered by the office layout. Layouts persist across navigations, so agents,
 * presence and the 3D scene are loaded once; a scope switch only renders the page (the widgets) again.
 */
export async function OfficeShell({ children }: { children: ReactNode }) {
  try {
    const room = await loadOfficeRoom();
    return (
      <AgentOffice
        agents={room.agents}
        liveOrigin={liveOrigin()}
        initialPresence={room.presence}
        initialPresenceError={room.presenceError}
        projects={room.projects}
        sidebar={<OfficeSidebar projects={room.projects} portalUrl={portalUrl()} />}
      >
        {children}
      </AgentOffice>
    );
  } catch (error) {
    const unavailable = error instanceof Error ? error.message : "Agenten-API nicht erreichbar.";
    return <p className="p-8 text-sm text-destructive">{unavailable}</p>;
  }
}
