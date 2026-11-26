-- Sprints per project (= repository). A task belongs to at most one sprint; without one it is in the backlog.
CREATE TABLE sprints (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  goal TEXT,
  status TEXT NOT NULL DEFAULT 'planned',
  starts_at INTEGER,
  ends_at INTEGER,
  created_by TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_sprints_project ON sprints(tenant_id, project_id, status);

ALTER TABLE tasks ADD COLUMN sprint_id TEXT REFERENCES sprints(id);
CREATE INDEX idx_tasks_sprint ON tasks(tenant_id, sprint_id);
