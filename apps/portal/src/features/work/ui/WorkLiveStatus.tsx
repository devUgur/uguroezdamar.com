"use client";

import { useEffect, useState } from "react";
import { workLiveTicket } from "../actions";

interface Props { origin: string | null; onRefresh: () => void }

/** After this many failed attempts the board refreshes on every retry instead (ADR 0045, R5). */
const FAILURES_BEFORE_POLLING = 3;
const POLL_MS = 5_000;

export function WorkLiveStatus({ origin, onRefresh }: Props) {
  const [connected, setConnected] = useState(false);
  const [polling, setPolling] = useState(false);
  useEffect(() => {
    if (!origin) return;
    let socket: WebSocket | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let closed = false;
    let failed = 0;
    let opened = false;
    const fail = () => {
      failed += 1;
      if (failed >= FAILURES_BEFORE_POLLING) {
        setPolling(true);
        onRefresh();
      }
    };
    const connect = async () => {
      try {
        const { origin: apiOrigin, ticket } = await workLiveTicket();
        if (!apiOrigin || !ticket) throw new Error("Live-Verbindung nicht verfügbar");
        socket = new WebSocket(`${apiOrigin.replace(/^http/, "ws")}/api/live?ticket=${encodeURIComponent(ticket)}`);
        opened = false;
        socket.onopen = () => {
          opened = true;
          failed = 0;
          setPolling(false);
          setConnected(true);
          onRefresh();
        };
        socket.onmessage = (message) => {
          if (message.data === "pong") return;
          try {
            const payload = JSON.parse(String(message.data)) as { type?: string; event?: { type?: string; taskId?: string } };
            if (payload.type === "event" && payload.event?.taskId && (payload.event.type === "task_created" || payload.event.type === "task_updated")) onRefresh();
          } catch { /* Ignore malformed messages; reconnect refresh restores authoritative state. */ }
        };
        socket.onclose = () => {
          setConnected(false);
          clearInterval(heartbeat);
          if (!opened) fail();
          if (!closed) retry = setTimeout(() => void connect(), failed >= FAILURES_BEFORE_POLLING ? POLL_MS : 3000);
        };
        heartbeat = setInterval(() => socket?.readyState === WebSocket.OPEN && socket.send("ping"), 25_000);
      } catch {
        fail();
        if (!closed) retry = setTimeout(() => void connect(), POLL_MS);
      }
    };
    void connect();
    return () => { closed = true; clearTimeout(retry); clearInterval(heartbeat); socket?.close(); };
  }, [origin, onRefresh]);

  return <span role="status" aria-live="polite" className="text-xs text-muted-foreground">{connected ? "Live verbunden" : polling ? "Live getrennt, Abgleich alle 5 s" : origin ? "Live-Verbindung wird aufgebaut …" : "Live-API nicht konfiguriert"}</span>;
}
