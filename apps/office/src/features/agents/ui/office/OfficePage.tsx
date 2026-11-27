import { portalUrl, requireSession } from "@/src/adapters/session";
import { liveOrigin, loadOfficeBoard, loadOfficeRoom } from "../../queries";
import { AgentOffice } from "./AgentOffice";

/**
 * The office page: room and board data in one server pass. The scope (?project=) is read in the browser and only
 * filters this data, so this page renders once per visit, not per scope.
 */
export async function OfficePage() {
  try {
    const [room, board, session] = await Promise.all([loadOfficeRoom(), loadOfficeBoard(), requireSession()]);
    return <AgentOffice room={room} initialBoard={board} liveOrigin={liveOrigin()} portalUrl={portalUrl()} canManage={session.canManage} />;
  } catch (error) {
    const unavailable = error instanceof Error ? error.message : "Agenten-API nicht erreichbar.";
    return <p className="p-8 text-sm text-destructive">{unavailable}</p>;
  }
}
