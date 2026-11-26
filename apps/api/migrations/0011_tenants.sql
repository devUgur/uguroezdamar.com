-- Tenants (ADR 0032, stage 1). The owner is the first and, for now, only tenant: every existing row
-- belongs to it through the column default, so nothing changes for today's data.

CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  plan TEXT NOT NULL DEFAULT 'owner',
  -- JSON: daily budget, steps, GPU minutes; empty until limits per tenant exist (stage 3).
  limits TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT INTO tenants (id, name, plan) VALUES ('owner', 'Owner', 'owner');

-- GitHub App installations and the tenant each one belongs to (filled by the connect flow, stage 2).
CREATE TABLE tenant_installations (
  installation_id INTEGER PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  account TEXT NOT NULL,
  selection TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_tenant_installations_tenant ON tenant_installations(tenant_id);

ALTER TABLE projects ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'owner';
ALTER TABLE threads ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'owner';
ALTER TABLE tasks ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'owner';
ALTER TABLE task_reviews ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'owner';
ALTER TABLE approvals ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'owner';
ALTER TABLE events ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'owner';
ALTER TABLE memories ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'owner';

CREATE INDEX idx_projects_tenant ON projects(tenant_id, status);
CREATE INDEX idx_threads_tenant ON threads(tenant_id, archived, updated_at);
CREATE INDEX idx_tasks_tenant ON tasks(tenant_id, status);
CREATE INDEX idx_task_reviews_tenant ON task_reviews(tenant_id);
CREATE INDEX idx_approvals_tenant ON approvals(tenant_id, status);
CREATE INDEX idx_events_tenant ON events(tenant_id, id);
CREATE INDEX idx_memories_tenant ON memories(tenant_id, project_id);
