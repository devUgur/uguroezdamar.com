-- Settings of an agent (employee) per tenant (plan stage 2): model, reasoning effort, step limit, daily budget.
-- NULL keeps the default: role alias chain, provider default effort, MAX_STEPS, agents.daily_budget_usd.
CREATE TABLE agent_settings (
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  agent_id TEXT NOT NULL,
  model_provider TEXT,
  model TEXT,
  -- low | medium | high
  reasoning_effort TEXT,
  max_steps INTEGER,
  daily_budget_usd REAL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (tenant_id, agent_id)
);
