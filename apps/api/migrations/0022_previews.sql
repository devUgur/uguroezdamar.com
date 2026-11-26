-- Preview URLs per project (ADR 0036): one row per branch or pull request alias, the newest upload wins.
CREATE TABLE previews (
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  project_id TEXT NOT NULL,
  alias TEXT NOT NULL,
  ref TEXT NOT NULL,
  url TEXT NOT NULL,
  version_id TEXT,
  status TEXT NOT NULL,
  commit_sha TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (tenant_id, project_id, alias)
);
