-- Persist the organization catalog separately from executable runtime configuration and staff.
CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  purpose TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS role_profiles (
  id TEXT PRIMARY KEY,
  department_id TEXT NOT NULL REFERENCES departments(id),
  name TEXT NOT NULL,
  purpose TEXT NOT NULL,
  responsibilities TEXT NOT NULL DEFAULT '[]',
  capabilities TEXT NOT NULL DEFAULT '[]',
  version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS agent_definitions (
  id TEXT PRIMARY KEY,
  role_id TEXT NOT NULL REFERENCES role_profiles(id),
  runtime_key TEXT NOT NULL UNIQUE,
  version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

ALTER TABLE agents ADD COLUMN definition_id TEXT REFERENCES agent_definitions(id);
UPDATE agents SET role = 'chief' WHERE id = 'chef' AND role = 'ceo';

INSERT OR IGNORE INTO departments (id, name, purpose, sort_order) VALUES
  ('leadership', 'Geschäftsführung', 'Ziele, Prioritäten, Freigaben und Ergebnisverantwortung.', 10),
  ('product', 'Product & Planning', 'Anforderungen klären und Arbeitsfluss koordinieren.', 20),
  ('engineering', 'Engineering', 'Technische Planung und Umsetzung.', 30),
  ('quality', 'Quality Assurance', 'Änderungen unabhängig anhand von Kriterien prüfen.', 40),
  ('platform', 'Platform & Operations', 'Laufzeit, Infrastruktur und kontrollierte Lieferung.', 50);

INSERT OR IGNORE INTO role_profiles (id, department_id, name, purpose, responsibilities, capabilities) VALUES
  ('chief', 'leadership', 'Chief Agent', 'Zentraler Eingang und Koordination von Aufträgen.', '["Aufträge einordnen","Fortschritt zusammenfassen","Freigaben beim Owner belassen"]', '["intake","coordination","reporting"]'),
  ('product-analyst', 'product', 'Product Analyst', 'Ziele in überprüfbare Anforderungen übersetzen.', '["Problem und Ziel klären","Akzeptanzkriterien formulieren","Abhängigkeiten und Nichtziele benennen"]', '["requirements","acceptance-criteria"]'),
  ('scrum-master', 'product', 'Scrum Master', 'Arbeit priorisieren und den tatsächlichen Fluss koordinieren.', '["Backlog strukturieren","Blockaden sichtbar machen","Übergaben nachvollziehen"]', '["planning","flow-coordination"]'),
  ('tech-lead', 'engineering', 'Tech Lead / Architect', 'Technischen Umfang und sichere Schnittstellen planen.', '["Codepfade untersuchen","Arbeitspakete abgrenzen","Risiken und Verträge dokumentieren"]', '["architecture","technical-planning"]'),
  ('coding-agent', 'engineering', 'Coding Agent', 'Einen klar abgegrenzten und zugewiesenen Task umsetzen.', '["Zugewiesene Änderungen implementieren","Ergebnis und Verifikation dokumentieren"]', '["implementation","repository-work"]'),
  ('qa-reviewer', 'quality', 'QA / Code Reviewer', 'Ergebnisse unabhängig gegen Kriterien und Änderungen prüfen.', '["Akzeptanzkriterien prüfen","Regressionen und Risiken melden","Nacharbeit begründet zurückgeben"]', '["quality-review","verification"]'),
  ('devops-release', 'platform', 'DevOps / Release', 'Betriebs- und Release-Reife vorbereiten; Freigaben bleiben beim Owner.', '["CI und Deployment-Status prüfen","Risiken und Rollback vorbereiten","keine eigenständige Produktionsfreigabe"]', '["operations","release-readiness"]');

INSERT OR IGNORE INTO agent_definitions (id, role_id, runtime_key, version)
VALUES ('chef-v1', 'chief', 'chef', 1);

UPDATE agents SET definition_id = 'chef-v1' WHERE id = 'chef' AND definition_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_agents_definition_active ON agents(definition_id, active);
