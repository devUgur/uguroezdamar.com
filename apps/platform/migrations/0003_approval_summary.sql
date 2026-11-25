-- Approval cards show what an action does and whether it touches protected paths; pending
-- approvals expire (expires_at, unixepoch seconds) so stale proposals cannot be executed later.
ALTER TABLE approvals ADD COLUMN summary TEXT;
ALTER TABLE approvals ADD COLUMN risk TEXT;
ALTER TABLE approvals ADD COLUMN warnings TEXT;
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status, created_at);
