import { DurableObject } from "cloudflare:workers";
import type { Env } from "./env.ts";

const TICKET_TTL_MS = 60_000;

/**
 * One instance ("main") fans every platform event out to open browsers. Uses the WebSocket
 * hibernation API, so idle connections cost nothing.
 *
 * Browsers cannot send headers on a WebSocket, so they first fetch a one-time ticket with their
 * credentials (POST /api/live-ticket) and open /api/live?ticket=… with it. The ticket lives 60 s
 * in this object's storage and is consumed on use; no long-lived token ever appears in a URL.
 */
export class LiveHub extends DurableObject<Env> {
  async issueTicket(): Promise<string> {
    const ticket = crypto.randomUUID();
    await this.ctx.storage.put(`ticket:${ticket}`, Date.now() + TICKET_TTL_MS);
    return ticket;
  }

  private async redeem(ticket: string | null): Promise<boolean> {
    if (!ticket) return false;
    const key = `ticket:${ticket}`;
    const expires = await this.ctx.storage.get<number>(key);
    if (expires === undefined) return false;
    await this.ctx.storage.delete(key);
    return expires > Date.now();
  }

  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get("upgrade") !== "websocket") {
      return new Response("Expected a WebSocket upgrade", { status: 426 });
    }
    if (!(await this.redeem(new URL(request.url).searchParams.get("ticket")))) {
      return new Response("Ticket ungültig oder abgelaufen", { status: 401 });
    }
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    pair[1].send(JSON.stringify({ type: "hello", ts: Date.now() }));
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  broadcast(message: string): number {
    let delivered = 0;
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(message);
        delivered += 1;
      } catch {
        // A closed socket is removed by the runtime; nothing to do.
      }
    }
    return delivered;
  }

  override webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): void {
    if (message === "ping") socket.send("pong");
  }

  override webSocketClose(socket: WebSocket, code: number): void {
    socket.close(code, "closed");
  }
}
