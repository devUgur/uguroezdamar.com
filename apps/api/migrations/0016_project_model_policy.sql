-- Data policy per project (ADR 0033): which model providers may see the repository's content.
-- NULL follows the repository: private repositories are 'strict' (only providers without data evaluation),
-- public ones 'open'. The owner may set 'open' for a private repository deliberately, or 'strict' for a public one.
ALTER TABLE projects ADD COLUMN model_policy TEXT;
