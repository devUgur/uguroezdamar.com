-- Policy engine (ADR 0040, phase P2): the autonomy level of each project and the log of every decision about a
-- writing action. Without a row a project uses the default level (catalog.ts: manual, as before P2).
CREATE TABLE IF NOT EXISTS project_policies (
  tenant_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('manual', 'balanced', 'high', 'max')),
  version INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (tenant_id, project_id)
);

CREATE TABLE IF NOT EXISTS policy_decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  run_id TEXT,
  thread_id TEXT,
  agent_id TEXT,
  project_id TEXT,
  tool TEXT NOT NULL,
  action_class TEXT NOT NULL,
  level TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('allow', 'approve', 'deny')),
  reason TEXT NOT NULL,
  detail TEXT,
  policy_version TEXT NOT NULL,
  approval_id TEXT,
  ts INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_policy_decisions_tenant_ts ON policy_decisions(tenant_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_policy_decisions_run ON policy_decisions(tenant_id, run_id);
