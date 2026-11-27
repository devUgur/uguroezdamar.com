import type { LiveHubPort } from "../env.ts";
import { SET_LIVE_VIEWERS } from "../live/presence.ts";
import type { SqlPort } from "../platform/ports.ts";

const TICKET_TTL_MS = 60_000;

/** What the hub needs of a browser connection; the Node server wraps its WebSocket in this. */
export interface LiveSocket {
  send(text: string): void;
  close(): void;
}

/**
 * The live hub in the Node process (ADR 0045, R1), the counterpart of cloudflare/hub-object.ts with the same
 * protocol: a one-time ticket from POST /api/live-ticket, then /api/live?ticket=…; "ping" is answered with "pong";
 * "subscribe:office" marks an office view. Open connections are written to `live_presence` like on Cloudflare, so the
 * core sends only while someone listens.
 */
export class NodeLiveHub implements LiveHubPort {
  private readonly tickets = new Map<string, number>();
  private readonly sockets = new Map<LiveSocket, { office: boolean }>();

  private readonly db: SqlPort;
  private readonly name: string;

  constructor(db: SqlPort, name = "main") {
    this.db = db;
    this.name = name;
  }

  async issueTicket(): Promise<string> {
    const now = Date.now();
    for (const [ticket, expires] of this.tickets) if (expires <= now) this.tickets.delete(ticket);
    const ticket = crypto.randomUUID();
    this.tickets.set(ticket, now + TICKET_TTL_MS);
    return ticket;
  }

  /** Consumes a ticket; true when it was issued here and has not expired. */
  redeem(ticket: string | null): boolean {
    if (!ticket) return false;
    const expires = this.tickets.get(ticket);
    this.tickets.delete(ticket);
    return expires !== undefined && expires > Date.now();
  }

  /** The upgrade is the Node server's job; a plain request is refused as on Cloudflare. */
  async fetch(): Promise<Response> {
    return new Response("Expected a WebSocket upgrade", { status: 426 });
  }

  async broadcast(message: string): Promise<number> {
    let delivered = 0;
    for (const socket of this.sockets.keys()) {
      try {
        socket.send(message);
        delivered += 1;
      } catch {
        this.sockets.delete(socket);
      }
    }
    return delivered;
  }

  /** A browser connected with a valid ticket. */
  async connect(socket: LiveSocket): Promise<void> {
    this.sockets.set(socket, { office: false });
    socket.send(JSON.stringify({ type: "hello", ts: Date.now() }));
    await this.sync();
  }

  async message(socket: LiveSocket, text: string): Promise<void> {
    const attachment = this.sockets.get(socket);
    if (!attachment) return;
    if (text === "ping") {
      socket.send("pong");
      return;
    }
    const office = text === "subscribe:office" ? true : text === "unsubscribe:office" ? false : attachment.office;
    if (office === attachment.office) return;
    attachment.office = office;
    await this.sync();
  }

  async disconnect(socket: LiveSocket): Promise<void> {
    if (!this.sockets.delete(socket)) return;
    await this.sync();
  }

  /** Closes every connection, e.g. when the host stops. */
  closeAll(): void {
    for (const socket of this.sockets.keys()) socket.close();
    this.sockets.clear();
  }

  private async sync(): Promise<void> {
    const office = [...this.sockets.values()].filter((attachment) => attachment.office).length;
    await this.db.prepare(SET_LIVE_VIEWERS).bind(this.name, this.sockets.size, office).run();
  }
}
