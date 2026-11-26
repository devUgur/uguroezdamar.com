-- Usage ledger (plan stage 1, docs/product/agent-company-plan.md): every run, model call and tool call as a row.
-- Costs, budgets and the run trace read these tables; events stay the live stream.

CREATE TABLE runs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  agent_id TEXT NOT NULL,
  project_id TEXT,
  thread_id TEXT,
  task_id TEXT,
  -- chat | task | review
  kind TEXT NOT NULL,
  -- running | done | failed | stopped | step_limit
  status TEXT NOT NULL DEFAULT 'running',
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  steps INTEGER NOT NULL DEFAULT 0,
  stages INTEGER NOT NULL DEFAULT 0,
  model_calls INTEGER NOT NULL DEFAULT 0,
  tool_calls INTEGER NOT NULL DEFAULT 0,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  -- First characters of the final answer or the error, for the run list.
  outcome TEXT
);
CREATE INDEX idx_runs_tenant_started ON runs(tenant_id, started_at DESC);
CREATE INDEX idx_runs_tenant_thread ON runs(tenant_id, thread_id);

CREATE TABLE model_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  run_id TEXT,
  agent_id TEXT,
  project_id TEXT,
  thread_id TEXT,
  task_id TEXT,
  step INTEGER,
  -- Role alias the agent asked for, and the provider/model that answered (or the last one tried on failure).
  alias TEXT,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  -- ok | error
  status TEXT NOT NULL,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  cache_write_tokens INTEGER NOT NULL DEFAULT 0,
  -- The price used, so a later price change never rewrites history. price_source: catalog | provider_default | paid_default | free
  input_usd_per_m REAL NOT NULL DEFAULT 0,
  output_usd_per_m REAL NOT NULL DEFAULT 0,
  price_source TEXT NOT NULL DEFAULT 'catalog',
  cost_usd REAL NOT NULL DEFAULT 0,
  latency_ms INTEGER,
  first_token_ms INTEGER,
  -- tenant | environment | builtin
  key_source TEXT,
  strict_policy INTEGER NOT NULL DEFAULT 0,
  attempts TEXT,
  error TEXT,
  ts INTEGER NOT NULL
);
CREATE INDEX idx_model_calls_tenant_ts ON model_calls(tenant_id, ts DESC);
CREATE INDEX idx_model_calls_run ON model_calls(tenant_id, run_id);
CREATE INDEX idx_model_calls_agent_ts ON model_calls(tenant_id, agent_id, ts);

CREATE TABLE tool_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  run_id TEXT,
  agent_id TEXT,
  project_id TEXT,
  step INTEGER,
  tool TEXT NOT NULL,
  -- Shortened arguments as the event shows them; secrets never reach tool arguments.
  args_preview TEXT,
  ok INTEGER NOT NULL,
  -- Approval requested instead of running.
  approval_id TEXT,
  duration_ms INTEGER,
  result_preview TEXT,
  ts INTEGER NOT NULL
);
CREATE INDEX idx_tool_calls_run ON tool_calls(tenant_id, run_id);
