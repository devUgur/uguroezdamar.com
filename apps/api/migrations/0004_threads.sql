-- Conversations in the portal chat. Each thread has its own agent instance (Durable Object
-- "thread:<id>") and its own history; events and approvals point at the thread they belong to.
-- model: NULL uses the agent's alias; otherwise JSON {"provider": "...", "model": "..."}.
CREATE TABLE IF NOT EXISTS threads (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  project_id TEXT REFERENCES projects(id),
  title TEXT,
  model TEXT,
  created_by TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_threads_updated ON threads(archived, updated_at);

ALTER TABLE events ADD COLUMN thread_id TEXT;
CREATE INDEX IF NOT EXISTS idx_events_thread ON events(thread_id, id);

ALTER TABLE approvals ADD COLUMN thread_id TEXT;
