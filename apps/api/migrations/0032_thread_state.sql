-- The state of a conversation in shared SQL (ADR 0045, R3): messages, keyed values (run, inbox, summary) and the
-- wake-up for its next stage. Any host can continue a thread from here; a lease decides which one does. Keyed by the
-- thread's actor name (tenancy.ts, threadObjectName). Cloudflare keeps using Durable Object storage until R6.
CREATE TABLE IF NOT EXISTS thread_messages (
  thread_key TEXT NOT NULL,
  id INTEGER NOT NULL,
  tenant_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT,
  tool_calls TEXT,
  tool_call_id TEXT,
  raw TEXT,
  ts INTEGER NOT NULL,
  PRIMARY KEY (thread_key, id)
);

CREATE TABLE IF NOT EXISTS thread_values (
  thread_key TEXT NOT NULL,
  key TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (thread_key, key)
);

CREATE TABLE IF NOT EXISTS scheduled_jobs (
  thread_key TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  due_at INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  lease_owner TEXT,
  lease_until INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_due ON scheduled_jobs(due_at);
