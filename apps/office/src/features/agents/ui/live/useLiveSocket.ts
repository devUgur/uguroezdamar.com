"use client";

import { useEffect, useRef, useState } from "react";
import { liveTicket } from "../../actions";
import type { AgentEvent, OfficeSnapshot } from "../../types";

export interface LiveDelta {
  agentId?: string;
  threadId?: string;
  step?: number;
  text: string;
}

interface Handlers {
  onEvent: (event: AgentEvent) => void;
  onOffice?: (snapshot: OfficeSnapshot) => void;
  onOpen?: () => void | Promise<void>;
  onDelta?: (delta: LiveDelta) => void;
  /** Runs before every reconnect, to catch up on what happened while the socket was down. */
  onReconnect?: () => Promise<void>;
}

/**
 * One WebSocket to the agent API's live hub. The portal server hands out a one-time ticket, so the
 * service token never reaches the browser. Reconnects on its own and pings every 30 seconds; the hub answers the ping
 * automatically without waking its Durable Object, so the heartbeat costs no request.
 *
 * Without a socket the view still follows (ADR 0045, R5): every attempt to reconnect first catches up through
 * `onReconnect`; after three failed attempts `polling` is true and the attempts come every 5 seconds.
 */
const FAILURES_BEFORE_POLLING = 3;
const POLL_MS = 5_000;

export function useLiveSocket(origin: string | null, handlers: Handlers): { connected: boolean; polling: boolean } {
  const [connected, setConnected] = useState(false);
  const [failures, setFailures] = useState(0);
  const latest = useRef(handlers);
  latest.current = handlers;

  useEffect(() => {
    if (!origin) return;
    let socket: WebSocket | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let closed = false;
    let first = true;
    let failed = 0;
    let opened = false;
    const fail = () => {
      failed += 1;
      setFailures(failed);
    };

    const connect = async () => {
      try {
        if (!first) await latest.current.onReconnect?.();
        first = false;
        const ticket = await liveTicket();
        socket = new WebSocket(`${origin.replace(/^http/, "ws")}/api/live?ticket=${encodeURIComponent(ticket)}`);
      } catch {
        fail();
        if (!closed) retry = setTimeout(connect, POLL_MS);
        return;
      }
      opened = false;
      socket.onopen = () => {
        opened = true;
        failed = 0;
        setFailures(0);
        setConnected(true);
        if (latest.current.onOffice) socket?.send("subscribe:office");
        void Promise.resolve(latest.current.onOpen?.()).catch(() => undefined);
      };
      socket.onmessage = (message) => {
        if (message.data === "pong") return;
        const payload = JSON.parse(String(message.data)) as { type: string; event?: AgentEvent; snapshot?: OfficeSnapshot } & Partial<LiveDelta>;
        if (payload.type === "event" && payload.event) latest.current.onEvent(payload.event);
        if (payload.type === "office" && payload.snapshot) latest.current.onOffice?.(payload.snapshot);
        if (payload.type === "delta" && payload.text) {
          latest.current.onDelta?.({ agentId: payload.agentId, threadId: payload.threadId, step: payload.step, text: payload.text });
        }
      };
      socket.onclose = () => {
        setConnected(false);
        clearInterval(heartbeat);
        if (!opened) fail();
        if (!closed) retry = setTimeout(connect, failed >= FAILURES_BEFORE_POLLING ? POLL_MS : 3000);
      };
      heartbeat = setInterval(() => socket?.readyState === WebSocket.OPEN && socket.send("ping"), 30_000);
    };

    void connect();
    return () => {
      closed = true;
      clearInterval(heartbeat);
      clearTimeout(retry);
      socket?.close();
    };
  }, [origin]);

  return { connected, polling: !connected && failures >= FAILURES_BEFORE_POLLING };
}
