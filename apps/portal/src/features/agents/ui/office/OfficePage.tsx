import { liveOrigin, loadOfficeWorkspace } from "../../queries";
import { AgentOffice } from "./AgentOffice";
import { OfficeSidebar } from "./OfficeSidebar";
import { OfficeWidgets } from "./OfficeWidgets";

interface OfficePageProps {
  /** ?project=: the inner scope; anything unknown falls back to the company level. */
  project: string | null;
  initialAgentId: string | null;
}

/** The office app on /office (and office.uguroezdamar.com): navigation, room and widgets for one scope. */
export async function OfficePage({ project, initialAgentId }: OfficePageProps) {
  try {
    const workspace = await loadOfficeWorkspace(project);
    const scopeLabel = workspace.projects.find((entry) => entry.id === workspace.scope)?.name ?? "Firma";
    return (
      <AgentOffice
        key={workspace.scope ?? "company"}
        agents={workspace.agents}
        liveOrigin={liveOrigin()}
        initialPresence={workspace.presence}
        initialPresenceError={workspace.presenceError}
        scope={workspace.scope}
        scopeLabel={scopeLabel}
        initialAgentId={initialAgentId}
        sidebar={<OfficeSidebar projects={workspace.projects} scope={workspace.scope} />}
        widgets={<OfficeWidgets workspace={workspace} />}
      />
    );
  } catch (error) {
    const unavailable = error instanceof Error ? error.message : "Agenten-API nicht erreichbar.";
    return <p className="p-8 text-sm text-destructive">{unavailable}</p>;
  }
}
