-- A portfolio product/project groups repository access records; it does not grant repository access.
CREATE TABLE portfolio_projects (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  summary TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  priority TEXT NOT NULL DEFAULT 'P2' CHECK (priority IN ('P0', 'P1', 'P2', 'P3')),
  created_by TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX idx_portfolio_projects_tenant_name ON portfolio_projects(tenant_id, lower(name));
CREATE INDEX idx_portfolio_projects_tenant_status ON portfolio_projects(tenant_id, status, priority, updated_at DESC);

CREATE TABLE portfolio_project_repositories (
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  portfolio_project_id TEXT NOT NULL REFERENCES portfolio_projects(id),
  repository_project_id TEXT NOT NULL REFERENCES projects(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (tenant_id, portfolio_project_id, repository_project_id)
);
CREATE INDEX idx_portfolio_project_repositories_repository
  ON portfolio_project_repositories(tenant_id, repository_project_id);

ALTER TABLE portfolio_projects ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

CREATE TABLE portfolio_audit (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  portfolio_project_id TEXT NOT NULL,
  repository_project_id TEXT,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_portfolio_audit_tenant_created ON portfolio_audit(tenant_id, created_at DESC);

-- Preserve the existing main repository as the first portfolio entry.
INSERT OR IGNORE INTO portfolio_projects (id, tenant_id, name, summary, priority, created_by)
VALUES ('uguroezdamar-com', 'owner', 'uguroezdamar.com', 'Persönliche Website und Admin-Portal.', 'P1', 'system');
INSERT OR IGNORE INTO portfolio_project_repositories (tenant_id, portfolio_project_id, repository_project_id)
SELECT 'owner', 'uguroezdamar-com', id FROM projects WHERE tenant_id = 'owner' AND id = 'uguroezdamar';
