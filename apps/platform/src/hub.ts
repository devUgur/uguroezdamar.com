import { DurableObject } from "cloudflare:workers";
import type { Env } from "./env.ts";

/**
 * One instance ("main") fans every platform event out to open browsers. Uses the WebSocket
 * hibernation API, so idle connections cost nothing.
 */
export class LiveHub extends DurableObject<Env> {
  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get("upgrade") !== "websocket") {
      return new Response("Expected a WebSocket upgrade", { status: 426 });
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
