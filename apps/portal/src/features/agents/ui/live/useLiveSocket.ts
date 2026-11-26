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
 * service token never reaches the browser. Reconnects on its own and pings every 25 seconds.
 */
export function useLiveSocket(origin: string | null, handlers: Handlers): { connected: boolean } {
  const [connected, setConnected] = useState(false);
  const latest = useRef(handlers);
  latest.current = handlers;

  useEffect(() => {
    if (!origin) return;
    let socket: WebSocket | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let closed = false;
    let first = true;

    const connect = async () => {
      try {
        if (!first) await latest.current.onReconnect?.();
        first = false;
        const ticket = await liveTicket();
        socket = new WebSocket(`${origin.replace(/^http/, "ws")}/api/live?ticket=${encodeURIComponent(ticket)}`);
      } catch {
        if (!closed) retry = setTimeout(connect, 5000);
        return;
      }
      socket.onopen = () => {
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
        if (!closed) retry = setTimeout(connect, 3000);
      };
      heartbeat = setInterval(() => socket?.readyState === WebSocket.OPEN && socket.send("ping"), 25_000);
    };

    void connect();
    return () => {
      closed = true;
      clearInterval(heartbeat);
      clearTimeout(retry);
      socket?.close();
    };
  }, [origin]);

  return { connected };
}
