"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentSummary, OfficeSnapshot } from "../../types";
import { loadOfficeState } from "../../actions";
import { useLiveSocket } from "../live/useLiveSocket";
import { activityOf, bubbleOf, type AgentLiveState } from "./agentState";

/** How long a reply stays in the bubble after the agent finished. */
const BUBBLE_MS = 8000;

/** Live state per agent id, starting from each agent's last stored event. */
export function useOfficeLive(
  agents: AgentSummary[],
  origin: string | null,
  initialPresence: OfficeSnapshot | null,
  initialPresenceError: string | null,
) {
  const [states, setStates] = useState<Record<string, AgentLiveState>>(() =>
    Object.fromEntries(agents.map((agent) => [agent.id, { activity: activityOf(agent.lastEvent), bubble: "" }])),
  );
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [presence, setPresence] = useState<OfficeSnapshot | null>(initialPresence);
  const [presenceError, setPresenceError] = useState<string | null>(initialPresenceError);
  const [serverOffsetMs, setServerOffsetMs] = useState(() => initialPresence ? initialPresence.serverTime - Date.now() : 0);
  const snapshotRef = useRef<OfficeSnapshot | null>(initialPresence);
  const latestEventIds = useRef<Record<string, number>>({});

  const applySnapshot = useCallback((snapshot: OfficeSnapshot) => {
    if (snapshotRef.current && snapshotRef.current.revision > snapshot.revision) return;
    snapshotRef.current = snapshot;
    setPresence(snapshot);
    setPresenceError(null);
    setServerOffsetMs(snapshot.serverTime - Date.now());
    setStates((current) => {
      const next = { ...current };
      for (const [agentId, motion] of Object.entries(snapshot.agents)) {
        if ((latestEventIds.current[agentId] ?? 0) <= motion.lastEventId) {
          next[agentId] = { activity: motion.activity, bubble: current[agentId]?.bubble ?? "" };
        }
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => clearTimeout(timer));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const result = await loadOfficeState();
      if (cancelled) return;
      if (result.ok) applySnapshot(result.snapshot);
      else if (!snapshotRef.current) setPresenceError(result.error);
    };
    if (!snapshotRef.current) void refresh();
    const retry = setInterval(() => {
      if (!snapshotRef.current) void refresh();
    }, 10_000);
    return () => {
      cancelled = true;
      clearInterval(retry);
    };
  }, [applySnapshot]);

  const { connected } = useLiveSocket(origin, {
    onOpen: async () => {
      const result = await loadOfficeState();
      if (result.ok) applySnapshot(result.snapshot);
      else if (!snapshotRef.current) setPresenceError(result.error);
    },
    onOffice: applySnapshot,
    onEvent: (event) => {
      const agentId = event.agentId;
      if (!agentId) return;
      latestEventIds.current[agentId] = Math.max(latestEventIds.current[agentId] ?? 0, event.id);
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

  return { states, connected, presence, presenceError, serverOffsetMs };
}
