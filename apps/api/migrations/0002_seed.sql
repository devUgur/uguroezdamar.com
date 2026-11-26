-- First project and first agent. Agents are configured in src/agents/registry.ts; this row only
-- places the Chef-Agent in the office and sets its budget.
INSERT OR IGNORE INTO projects (id, name, repo, domain, daily_budget_usd)
VALUES ('uguroezdamar', 'uguroezdamar.com', 'devUgur/uguroezdamar.com', 'uguroezdamar.com', 1.0);

INSERT OR IGNORE INTO agents (id, name, role, model_alias, tools, daily_budget_usd, desk_x, desk_y)
VALUES ('chef', 'Chef-Agent', 'ceo', 'chef-smart', '[]', 1.0, 1, 1);
