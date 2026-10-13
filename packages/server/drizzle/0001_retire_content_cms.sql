-- Destructive: drops the tables of the retired content CMS (ADR 0019).
-- Content now lives in apps/site/content. Apply per stage only after the owner approved it
-- and a restore point exists: pnpm ugur db migrate --stage <stage>
DROP TABLE "career_entries" CASCADE;--> statement-breakpoint
DROP TABLE "profiles" CASCADE;--> statement-breakpoint
DROP TABLE "projects" CASCADE;