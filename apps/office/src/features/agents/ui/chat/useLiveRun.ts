"use client";

import { useCallback, useRef, useState } from "react";
import { eventsSince } from "../../actions";
import type { AgentEvent, Approval } from "../../types";
import { useLiveSocket } from "../live/useLiveSocket";

export interface ActivityLine {
  key: string;
  label: string;
  detail?: string;
  state: "running" | "ok" | "failed" | "note";
}

export interface LiveRun {
  running: boolean;
  status: string;
  streaming: string;
  activity: ActivityLine[];
  approvals: Approval[];
}

interface Options {
  threadId: string;
  origin: string | null;
  initialRunning: boolean;
  initialApprovals: Approval[];
  lastEventId: number;
  /** Called when a run ends; the page then reloads the stored history. */
  onSettled: () => void;
}

const SETTLED = new Set(["message", "error", "stopped", "budget_blocked"]);

/**
 * Live view of the thread's current run. Events and streamed text arrive over the shared live
 * socket. The stored history comes from the server; once a run settles the caller reloads it
 * (onSettled) and this state starts empty again.
 */
export function useLiveRun(options: Options) {
  const { threadId, origin, onSettled } = options;
  const [run, setRun] = useState<LiveRun>({
    running: options.initialRunning,
    status: options.initialRunning ? "arbeitet …" : "",
    streaming: "",
    activity: [],
    approvals: options.initialApprovals,
  });
  const lastId = useRef(options.lastEventId);
  const settledRef = useRef(onSettled);
  settledRef.current = onSettled;

  const apply = useCallback(
    (event: AgentEvent) => {
      if (event.threadId !== threadId || event.id <= lastId.current) return;
      lastId.current = event.id;
      const data = event.data ?? {};
      setRun((current) => reduce(current, event.type, data));
      if (SETTLED.has(event.type)) settledRef.current();
    },
    [threadId],
  );

  const { connected } = useLiveSocket(origin, {
    onEvent: apply,
    onDelta: (delta) => {
      if (delta.threadId !== threadId) return;
      setRun((current) => ({ ...current, running: true, streaming: current.streaming + delta.text }));
    },
    onReconnect: async () => (await eventsSince(threadId, lastId.current)).forEach(apply),
  });

  const markRunning = useCallback(() => setRun((current) => ({ ...current, running: true, status: "arbeitet …" })), []);
  const reset = useCallback(
    (running: boolean, approvals: Approval[]) =>
      setRun((current) => ({ ...current, running, status: running ? current.status : "", streaming: "", activity: [], approvals })),
    [],
  );
  const dropApproval = useCallback(
    (id: string) => setRun((current) => ({ ...current, approvals: current.approvals.filter((approval) => approval.id !== id) })),
    [],
  );

  return { run, connected, markRunning, reset, dropApproval };
}

function text(value: unknown): string {
  return typeof value === "string" ? value : value === undefined ? "" : JSON.stringify(value);
}

function reduce(current: LiveRun, type: string, data: Record<string, unknown>): LiveRun {
  switch (type) {
    case "user_message":
      return { ...current, running: true, status: "arbeitet …" };
    case "thinking":
      return { ...current, running: true, status: `denkt · Schritt ${text(data.step)}` };
    case "stage_paused":
      return { ...current, status: `Etappe ${text(data.stage)} fertig, geht weiter …` };
    case "tool_call": {
      // Text streamed before a tool call is the agent thinking aloud; keep it as a note.
      const note: ActivityLine[] = current.streaming.trim()
        ? [{ key: `note-${current.activity.length}`, label: current.streaming.trim(), state: "note" }]
        : [];
      const line: ActivityLine = { key: `tool-${current.activity.length + note.length}`, label: text(data.tool), detail: text(data.args), state: "running" };
      return { ...current, streaming: "", status: `nutzt ${text(data.tool)}`, activity: [...current.activity, ...note, line] };
    }
    case "tool_result": {
      const index = current.activity.findLastIndex((line) => line.label === text(data.tool) && line.state === "running");
      if (index < 0) return current;
      const activity = current.activity.slice();
      const line = activity[index];
      if (line) activity[index] = { ...line, state: data.ok ? "ok" : "failed", detail: text(data.preview) };
      return { ...current, activity };
    }
    case "approval_requested": {
      const approval: Approval = {
        id: text(data.approvalId),
        agentId: "",
        threadId: null,
        action: text(data.tool),
        summary: text(data.summary),
        risk: data.risk ? text(data.risk) : null,
        warnings: Array.isArray(data.warnings) ? data.warnings.map(text) : [],
        expiresAt: null,
      };
      return { ...current, status: "wartet auf deine Freigabe", approvals: [...current.approvals.filter((a) => a.id !== approval.id), approval] };
    }
    case "policy_allowed": {
      const policy = (data.policy ?? {}) as Record<string, unknown>;
      const line: ActivityLine = { key: `policy-${current.activity.length}`, label: `Automatisch erlaubt: ${text(data.detail)}`, detail: text(policy.reason), state: "note" };
      return { ...current, activity: [...current.activity, line] };
    }
    case "approval_decided":
      return { ...current, running: true, status: "verarbeitet die Freigabe …", approvals: current.approvals.filter((a) => a.id !== text(data.approvalId)) };
    default:
      return SETTLED.has(type) ? { ...current, running: false, status: "" } : current;
  }
}
