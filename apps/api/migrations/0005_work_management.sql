-- Persisted work items for the agent platform. Existing `open` rows become backlog items.
ALTER TABLE tasks ADD COLUMN description TEXT;
ALTER TABLE tasks ADD COLUMN acceptance_criteria TEXT;
ALTER TABLE tasks ADD COLUMN priority TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE tasks ADD COLUMN story_points REAL;
ALTER TABLE tasks ADD COLUMN created_by TEXT;
UPDATE tasks SET status = 'backlog' WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_tasks_project_status_updated ON tasks(project_id, status, updated_at DESC);
