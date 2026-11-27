-- Initiatives and the planning lifecycle (ADR 0041). An initiative is a task of kind 'initiative'; epics hang below it,
-- stories and tasks below epics (parent_id). The planning workflow keeps every step's result as an artifact and asks
-- the owner where it cannot decide on its own.
ALTER TABLE tasks ADD COLUMN kind TEXT NOT NULL DEFAULT 'task' CHECK (kind IN ('initiative', 'epic', 'story', 'task'));
-- The role (agent id) the planner suggests for the work; assignment stays a separate decision.
ALTER TABLE tasks ADD COLUMN role TEXT;
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(tenant_id, parent_id);

CREATE TABLE IF NOT EXISTS task_dependencies (
  tenant_id TEXT NOT NULL,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  depends_on TEXT NOT NULL REFERENCES tasks(id),
  PRIMARY KEY (tenant_id, task_id, depends_on)
);

CREATE TABLE IF NOT EXISTS planning_artifacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  initiative_id TEXT NOT NULL REFERENCES tasks(id),
  kind TEXT NOT NULL,
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  agent_id TEXT,
  thread_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_planning_artifacts_initiative ON planning_artifacts(tenant_id, initiative_id, kind, version DESC);

CREATE TABLE IF NOT EXISTS owner_questions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  initiative_id TEXT NOT NULL REFERENCES tasks(id),
  question TEXT NOT NULL,
  why TEXT,
  proposal TEXT,
  answer TEXT,
  asked_by TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  answered_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_owner_questions_initiative ON owner_questions(tenant_id, initiative_id, answered_at);

-- The Scrum Master structures backlog and sprints (role profile from migration 0007).
INSERT OR IGNORE INTO agent_definitions (id, role_id, runtime_key, version) VALUES ('scrum-master-v1', 'scrum-master', 'scrum-master', 1);
INSERT OR IGNORE INTO agents (id, name, role, model_alias, tools, daily_budget_usd, desk_x, desk_y, definition_id)
VALUES ('scrum-master', 'Scrum Master', 'scrum-master', 'chef-smart', '[]', 0.5, 3, 2, 'scrum-master-v1');
