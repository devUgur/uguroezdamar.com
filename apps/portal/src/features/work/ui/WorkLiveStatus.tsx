"use client";

import { useEffect, useState } from "react";
import { workLiveTicket } from "../actions";

interface Props { origin: string | null; onRefresh: () => void }

export function WorkLiveStatus({ origin, onRefresh }: Props) {
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    if (!origin) return;
    let socket: WebSocket | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let closed = false;
    const connect = async () => {
      try {
        const { origin: apiOrigin, ticket } = await workLiveTicket();
        if (!apiOrigin || !ticket) throw new Error("Live-Verbindung nicht verfügbar");
        socket = new WebSocket(`${apiOrigin.replace(/^http/, "ws")}/api/live?ticket=${encodeURIComponent(ticket)}`);
        socket.onopen = () => { setConnected(true); onRefresh(); };
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
          if (!closed) retry = setTimeout(() => void connect(), 3000);
        };
        heartbeat = setInterval(() => socket?.readyState === WebSocket.OPEN && socket.send("ping"), 25_000);
      } catch {
        if (!closed) retry = setTimeout(() => void connect(), 5000);
      }
    };
    void connect();
    return () => { closed = true; clearTimeout(retry); clearInterval(heartbeat); socket?.close(); };
  }, [origin, onRefresh]);

  return <span role="status" aria-live="polite" className="text-xs text-muted-foreground">{connected ? "Live verbunden" : origin ? "Live-Verbindung wird aufgebaut …" : "Live-API nicht konfiguriert"}</span>;
}
