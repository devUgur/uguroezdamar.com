-- A project is one GitHub repository the agents may work on. Only registered projects are readable
-- or writable by agents; the token may see more than that.
--   visibility:     'public' | 'private'. Content of private repositories never goes to a model provider
--                   that may train on it (see trainsOnData in models/config.ts).
--   default_branch: the branch pull requests target.
--   write_mode:     'dev-first' commits to `dev` and releases by pull request dev -> main (this repository);
--                   'pr-only' writes only to agent/... branches and opens pull requests into default_branch.
ALTER TABLE projects ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private';
ALTER TABLE projects ADD COLUMN default_branch TEXT NOT NULL DEFAULT 'main';
ALTER TABLE projects ADD COLUMN write_mode TEXT NOT NULL DEFAULT 'pr-only';
UPDATE projects SET visibility = 'public', write_mode = 'dev-first' WHERE id = 'uguroezdamar';
