/** What a figure in the office shows, derived only from the agent's events. */
export type AgentActivity = "idle" | "working" | "waiting" | "error";

export interface AgentLiveState {
  activity: AgentActivity;
  /** Short speech bubble; empty when the agent has nothing to say. */
  bubble: string;
}

const WORKING = new Set(["user_message", "thinking", "model_result", "tool_call", "tool_result", "stage_paused", "approval_decided"]);

export function activityOf(eventType: string | null): AgentActivity {
  if (!eventType) return "idle";
  if (eventType === "approval_requested") return "waiting";
  if (eventType === "error" || eventType === "budget_blocked") return "error";
  if (WORKING.has(eventType)) return "working";
  return "idle";
}

function short(text: unknown, length = 42): string {
  const value = typeof text === "string" ? text.replace(/\s+/g, " ").trim() : "";
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

/** The bubble for one event; undefined keeps the current one. */
export function bubbleOf(eventType: string, data: Record<string, unknown>): string | undefined {
  switch (eventType) {
    case "user_message":
      return "Neuer Auftrag";
    case "thinking":
      return "denkt …";
    case "tool_call":
      return short(data.tool);
    case "approval_requested":
      return "Freigabe nötig!";
    case "message":
      return short(data.text);
    case "error":
      return "Fehler";
    case "budget_blocked":
      return "Budget aufgebraucht";
    case "stopped":
      return "gestoppt";
    default:
      return undefined;
  }
}

export const ACTIVITY_LABEL: Record<AgentActivity, string> = {
  idle: "bereit",
  working: "arbeitet",
  waiting: "wartet auf Freigabe",
  error: "Fehler",
};
