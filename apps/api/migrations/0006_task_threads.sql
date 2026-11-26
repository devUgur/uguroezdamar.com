-- Link a work item to the thread created to execute it; each run and event can then be traced back.
ALTER TABLE threads ADD COLUMN task_id TEXT REFERENCES tasks(id);
CREATE INDEX IF NOT EXISTS idx_threads_task_updated ON threads(task_id, archived, updated_at DESC);
