-- Keep role edits and runtime lifecycle changes versioned and auditable without deleting history.
ALTER TABLE role_profiles ADD COLUMN last_mutation_id TEXT;
ALTER TABLE agents ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE agents ADD COLUMN last_mutation_id TEXT;

CREATE TABLE organization_audit (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  scope TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before_state TEXT,
  after_state TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER))
);

CREATE INDEX idx_organization_audit_entity ON organization_audit(scope, entity_id, created_at DESC);
