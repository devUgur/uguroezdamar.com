CREATE TABLE "portfolio_github_repositories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"github_repository_id" text NOT NULL,
	"owner" text NOT NULL,
	"name" text NOT NULL,
	"visibility" text NOT NULL,
	"description" text,
	"homepage_url" text,
	"topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"default_branch" text,
	"is_fork" boolean DEFAULT false NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"remote_updated_at" timestamp with time zone,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portfolio_github_repositories_github_repository_id_unique" UNIQUE("github_repository_id")
);
--> statement-breakpoint
CREATE INDEX "portfolio_github_repositories_owner_name_idx" ON "portfolio_github_repositories" USING btree ("owner","name");