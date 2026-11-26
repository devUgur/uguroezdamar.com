-- QA runs are first-class audit records, independent from the coding agent's output.
CREATE TABLE IF NOT EXISTS task_reviews (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  reviewer_agent_id TEXT NOT NULL REFERENCES agents(id),
  thread_id TEXT NOT NULL UNIQUE REFERENCES threads(id),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  verdict TEXT CHECK (verdict IN ('pass', 'changes_requested', 'needs_human')),
  summary TEXT,
  findings TEXT NOT NULL DEFAULT '[]',
  evidence TEXT NOT NULL DEFAULT '[]',
  raw_output TEXT,
  error TEXT,
  created_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  completed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_task_reviews_task_created ON task_reviews(task_id, created_at DESC);

ALTER TABLE tasks ADD COLUMN completion_note TEXT;
ALTER TABLE tasks ADD COLUMN completed_by TEXT;
ALTER TABLE tasks ADD COLUMN completed_at INTEGER;

INSERT OR IGNORE INTO agent_definitions (id, role_id, runtime_key, version)
VALUES ('qa-reviewer-v1', 'qa-reviewer', 'reviewer', 1);

INSERT OR IGNORE INTO agents (id, name, role, model_alias, tools, daily_budget_usd, desk_x, desk_y, definition_id)
VALUES ('reviewer', 'QA-Reviewer', 'qa-reviewer', 'chef-smart', '[]', 0.5, 4, 1, 'qa-reviewer-v1');
