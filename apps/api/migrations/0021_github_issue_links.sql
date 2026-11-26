ALTER TABLE tasks ADD COLUMN github_issue_number INTEGER;
ALTER TABLE tasks ADD COLUMN github_issue_url TEXT;
ALTER TABLE tasks ADD COLUMN github_issue_state TEXT;
ALTER TABLE tasks ADD COLUMN github_issue_updated_at INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_github_issue ON tasks(project_id, github_issue_number) WHERE github_issue_number IS NOT NULL;
