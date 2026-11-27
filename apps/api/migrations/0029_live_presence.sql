-- Who is connected to a live hub (ADR 0025, Nachtrag 2): the hub writes its open sockets here when one connects or
-- closes. Senders read it before calling the hub, so events, streamed text and office updates cost no Durable Object
-- request while nobody watches. No row means nobody has connected since the last deploy.
CREATE TABLE IF NOT EXISTS live_presence (
  hub TEXT PRIMARY KEY,
  sockets INTEGER NOT NULL DEFAULT 0,
  office INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
