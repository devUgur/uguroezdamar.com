"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { organizationLiveTicket } from "../actions";

export function OrganizationLiveSync() {
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    let socket: WebSocket | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let closed = false;
    const connect = async () => {
      try {
        const { origin, ticket } = await organizationLiveTicket();
        if (!origin || !ticket) throw new Error("Live-Verbindung nicht verfügbar");
        if (closed) return;
        socket = new WebSocket(`${origin.replace(/^http/, "ws")}/api/live?ticket=${encodeURIComponent(ticket)}`);
        socket.onopen = () => { setConnected(true); router.refresh(); };
        socket.onmessage = (message) => {
          if (message.data === "pong") return;
          try {
            const payload = JSON.parse(String(message.data)) as { type?: string; event?: { type?: string } };
            if (payload.type === "event" && payload.event?.type === "organization_updated") router.refresh();
          } catch { /* Reconnect refreshes the authoritative server read model. */ }
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
  }, [router]);
  return <span role="status" aria-live="polite" className="text-xs text-muted-foreground">{connected ? "Organisationsdaten live synchronisiert" : "Organisationsdaten verbinden …"}</span>;
}
