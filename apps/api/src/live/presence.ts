import type { SqlPort } from "../platform/ports.ts";

/**
 * Who is connected to a live hub, as the hub writes it on connect and close (migration 0029). Reading it is one D1
 * read; calling the hub when nobody listens would be a Durable Object request for nothing (ADR 0025, Nachtrag 2).
 */
export async function liveViewers(db: SqlPort, hub: string): Promise<{ sockets: number; office: number }> {
  const row = await db.prepare("SELECT sockets, office FROM live_presence WHERE hub = ?").bind(hub).first<{ sockets: number; office: number }>();
  return { sockets: row?.sockets ?? 0, office: row?.office ?? 0 };
}

/** The SQL that writes a hub's connections; the hub runs it on every connect and close. */
export const SET_LIVE_VIEWERS =
  "INSERT INTO live_presence (hub, sockets, office, updated_at) VALUES (?, ?, ?, unixepoch()) ON CONFLICT(hub) DO UPDATE SET sockets = excluded.sockets, office = excluded.office, updated_at = excluded.updated_at";
