"use client";

import { useEffect, useRef, useState } from "react";
import type { AgentSummary } from "../../types";
import { useLiveSocket } from "../live/useLiveSocket";
import { activityOf, bubbleOf, type AgentLiveState } from "./agentState";

/** How long a reply stays in the bubble after the agent finished. */
const BUBBLE_MS = 8000;

/** Live state per agent id, starting from each agent's last stored event. */
export function useOfficeLive(agents: AgentSummary[], origin: string | null) {
  const [states, setStates] = useState<Record<string, AgentLiveState>>(() =>
    Object.fromEntries(agents.map((agent) => [agent.id, { activity: activityOf(agent.lastEvent), bubble: "" }])),
  );
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => clearTimeout(timer));
  }, []);

  const { connected } = useLiveSocket(origin, {
    onEvent: (event) => {
      const agentId = event.agentId;
      if (!agentId) return;
      const bubble = bubbleOf(event.type, event.data ?? {});
      setStates((current) => ({
        ...current,
        [agentId]: { activity: activityOf(event.type), bubble: bubble ?? current[agentId]?.bubble ?? "" },
      }));
      // Finished agents keep their last words for a moment, then fall quiet.
      if (event.type === "message" || event.type === "stopped") {
        clearTimeout(timers.current.get(agentId));
        timers.current.set(
          agentId,
          setTimeout(() => setStates((current) => ({ ...current, [agentId]: { activity: "idle", bubble: "" } })), BUBBLE_MS),
        );
      }
    },
  });

  return { states, connected };
}
