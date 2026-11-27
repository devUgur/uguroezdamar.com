-- Delivery workflow (ADR 0040, phase P3; plan stage 4): one run per task carries it through the team. Each step is an
-- agent run in its own conversation; its result is the handoff the next role reads. State lives here, so the
-- workflow survives restarts on any host.
CREATE TABLE IF NOT EXISTS workflow_runs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  project_id TEXT,
  kind TEXT NOT NULL DEFAULT 'delivery',
  -- running: a step works; waiting_owner: needs Ugur (QA undecided, too many rework rounds, a failed step);
  -- awaiting_acceptance: report written, Ugur accepts on the board; done; cancelled.
  status TEXT NOT NULL CHECK (status IN ('running', 'waiting_owner', 'awaiting_acceptance', 'done', 'cancelled')),
  step TEXT NOT NULL,
  rework INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  started_by TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Only one open workflow per task.
CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_runs_open_task ON workflow_runs(tenant_id, task_id) WHERE status IN ('running', 'waiting_owner', 'awaiting_acceptance');
CREATE INDEX IF NOT EXISTS idx_workflow_runs_tenant_updated ON workflow_runs(tenant_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS workflow_steps (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  run_id TEXT NOT NULL REFERENCES workflow_runs(id),
  step TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  attempt INTEGER NOT NULL DEFAULT 1,
  -- waiting_approval: the agent proposed an action that needs Ugur; the step goes on after his decision.
  status TEXT NOT NULL CHECK (status IN ('running', 'waiting_approval', 'done', 'failed', 'cancelled')),
  summary TEXT,
  started_at INTEGER NOT NULL DEFAULT (unixepoch()),
  finished_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_workflow_steps_run ON workflow_steps(tenant_id, run_id, started_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_steps_thread ON workflow_steps(thread_id);
