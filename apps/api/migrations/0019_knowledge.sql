-- Memory and knowledge (plan stage 3).

-- Working memory: one structured document per agent and project that the agent keeps current itself
-- (goals, decisions, open points, conventions). It goes into every run of that agent in that project.
CREATE TABLE working_memory (
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  agent_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  content TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (tenant_id, agent_id, project_id)
);

-- Knowledge index: which sources of a project are indexed (a repository file by its blob sha, or a finished task),
-- and the text of each chunk. The vectors live in Vectorize under the chunk id; the text stays here.
CREATE TABLE knowledge_sources (
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  project_id TEXT NOT NULL,
  -- file:<path> or task:<id>
  source TEXT NOT NULL,
  version TEXT NOT NULL,
  chunks INTEGER NOT NULL DEFAULT 0,
  indexed_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (tenant_id, project_id, source)
);

CREATE TABLE knowledge_chunks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  project_id TEXT NOT NULL,
  source TEXT NOT NULL,
  heading TEXT,
  text TEXT NOT NULL,
  -- 1 once the vector is in Vectorize; chunks without one are still found by full-text search and embedded later.
  embedded INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_knowledge_chunks_source ON knowledge_chunks(tenant_id, project_id, source);
CREATE INDEX idx_knowledge_chunks_pending ON knowledge_chunks(tenant_id, project_id, embedded);

-- Full-text index of the same chunks (BM25). Search combines it with the vectors (hybrid search).
CREATE VIRTUAL TABLE knowledge_fts USING fts5(chunk_id UNINDEXED, tenant_id UNINDEXED, project_id UNINDEXED, heading, text, tokenize = 'unicode61 remove_diacritics 2');
