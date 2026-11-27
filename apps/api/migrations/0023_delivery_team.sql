-- First wave of the delivery team (plan stage 4): Product Owner, Tech Lead, developer and DevOps. Prompts and
-- tools live in src/agents/registry.ts; here each gets its definition in the organization catalog, a desk in the
-- office (four per row) and a daily budget. Chef (1,1) and QA reviewer (4,1) keep their desks.
INSERT OR IGNORE INTO agent_definitions (id, role_id, runtime_key, version) VALUES
  ('product-owner-v1', 'product-analyst', 'product-owner', 1),
  ('tech-lead-v1', 'tech-lead', 'tech-lead', 1),
  ('developer-v1', 'coding-agent', 'developer', 1),
  ('devops-v1', 'devops-release', 'devops', 1);

INSERT OR IGNORE INTO agents (id, name, role, model_alias, tools, daily_budget_usd, desk_x, desk_y, definition_id) VALUES
  ('product-owner', 'Product Owner', 'product-analyst', 'chef-smart', '[]', 0.5, 2, 1, 'product-owner-v1'),
  ('tech-lead', 'Tech Lead', 'tech-lead', 'chef-smart', '[]', 0.5, 3, 1, 'tech-lead-v1'),
  ('developer', 'Entwickler', 'coding-agent', 'coder', '[]', 1.0, 1, 2, 'developer-v1'),
  ('devops', 'DevOps', 'devops-release', 'worker-cheap', '[]', 0.3, 2, 2, 'devops-v1');
