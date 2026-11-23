import { sql } from "drizzle-orm";
import {
	bigint,
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const id = () => uuid("id").primaryKey().default(sql`gen_random_uuid()`);

export const admins = pgTable("admins", {
	id: id(),
	email: text("email").notNull().unique(),
	passwordHash: text("password_hash").notNull(),
	name: text("name"),
	invitedBy: text("invited_by"),
	status: text("status", { enum: ["active", "invited"] }).notNull().default("active"),
	role: text("role", { enum: ["owner", "admin", "editor"] }).notNull().default("editor"),
	createdAt: timestamptz("created_at").notNull().defaultNow(),
	lastLogin: timestamptz("last_login"),
});

export const adminSessions = pgTable(
	"admin_sessions",
	{
		id: id(),
		adminId: uuid("admin_id")
			.notNull()
			.references(() => admins.id, { onDelete: "cascade" }),
		email: text("email").notNull(),
		createdAt: timestamptz("created_at").notNull().defaultNow(),
		expiresAt: timestamptz("expires_at").notNull(),
		userAgent: text("user_agent"),
		ip: text("ip"),
	},
	(table) => [index("admin_sessions_expires_at_idx").on(table.expiresAt)],
);

export const adminInvites = pgTable(
	"admin_invites",
	{
		id: id(),
		email: text("email").notNull(),
		role: text("role", { enum: ["owner", "admin", "editor"] }).notNull().default("editor"),
		tokenHash: text("token_hash").notNull().unique(),
		expiresAt: timestamptz("expires_at").notNull(),
		createdBy: text("created_by").notNull(),
		createdAt: timestamptz("created_at").notNull().defaultNow(),
		usedAt: timestamptz("used_at"),
	},
	(table) => [index("admin_invites_email_idx").on(table.email)],
);

export const adminLoginAttempts = pgTable(
	"admin_login_attempts",
	{
		id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
		ip: text("ip").notNull(),
		createdAt: timestamptz("created_at").notNull().defaultNow(),
	},
	(table) => [index("admin_login_attempts_ip_created_at_idx").on(table.ip, table.createdAt)],
);

export const contactRequests = pgTable("contact_requests", {
	// Monotonic so the admin list can page by "older than this id".
	id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
	name: text("name").notNull(),
	email: text("email").notNull(),
	message: text("message").notNull(),
	source: text("source").notNull().default("website"),
	createdAt: timestamptz("created_at").notNull().defaultNow(),
	expiresAt: timestamptz("expires_at").notNull().default(sql`now() + interval '90 days'`),
}, (table) => [index("contact_requests_expires_at_idx").on(table.expiresAt)]);

export const contactRateLimits = pgTable(
	"contact_rate_limits",
	{
		key: text("key").primaryKey(),
		count: integer("count").notNull().default(0),
		expiresAt: timestamptz("expires_at").notNull(),
	},
	(table) => [index("contact_rate_limits_expires_at_idx").on(table.expiresAt)],
);

/** Internal source catalog for GitHub discovery; it is not read by the public site. */
export const portfolioGithubRepositories = pgTable(
	"portfolio_github_repositories",
	{
		id: id(),
		githubRepositoryId: text("github_repository_id").notNull().unique(),
		owner: text("owner").notNull(),
		name: text("name").notNull(),
		visibility: text("visibility", { enum: ["public", "private"] }).notNull(),
		description: text("description"),
		homepageUrl: text("homepage_url"),
		topics: jsonb("topics").$type<string[]>().notNull().default([]),
		defaultBranch: text("default_branch"),
		isFork: boolean("is_fork").notNull().default(false),
		isArchived: boolean("is_archived").notNull().default(false),
		remoteUpdatedAt: timestamptz("remote_updated_at"),
		discoveredAt: timestamptz("discovered_at").notNull().defaultNow(),
		syncedAt: timestamptz("synced_at").notNull().defaultNow(),
	},
	(table) => [index("portfolio_github_repositories_owner_name_idx").on(table.owner, table.name)],
);

// Retired with the content CMS (ADR 0019): no code reads or writes these three tables any more.
// They stay defined until their data has been backed up and a restore has been tested; a
// separate migration then drops them.
export const profiles = pgTable("profiles", {
	id: id(),
	handle: text("handle").notNull().unique(),
	headline: text("headline").notNull(),
	subheadline: text("subheadline"),
	bio: text("bio").notNull(),
	location: text("location"),
	email: text("email"),
	links: jsonb("links")
		.$type<{ github?: string | null; linkedin?: string | null; website?: string | null }>()
		.notNull()
		.default({}),
	createdAt: timestamptz("created_at").notNull().defaultNow(),
	updatedAt: timestamptz("updated_at").notNull().defaultNow(),
});

export const careerEntries = pgTable(
	"career_entries",
	{
		id: id(),
		type: text("type").notNull(),
		slug: text("slug").notNull(),
		title: text("title").notNull(),
		organization: text("organization"),
		location: text("location"),
		dateStart: timestamptz("date_start").notNull(),
		dateEnd: timestamptz("date_end"),
		isCurrent: boolean("is_current").notNull().default(false),
		summary: text("summary"),
		highlights: jsonb("highlights").$type<string[]>().notNull().default([]),
		tags: jsonb("tags").$type<string[]>().notNull().default([]),
		links: jsonb("links").$type<{ label: string; url: string }[]>().notNull().default([]),
		isFeatured: boolean("is_featured").notNull().default(false),
		sortKey: integer("sort_key").notNull().default(0),
		visibility: jsonb("visibility").$type<{ about: boolean; education: boolean; career: boolean }>(),
		status: text("status", { enum: ["draft", "published"] }).notNull().default("draft"),
		role: text("role"),
		degree: text("degree"),
		field: text("field"),
		issuer: text("issuer"),
		createdAt: timestamptz("created_at").notNull().defaultNow(),
		updatedAt: timestamptz("updated_at").notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex("career_entries_slug_idx").on(table.slug),
		index("career_entries_listing_idx").on(table.dateStart.desc(), table.sortKey),
	],
);

export const projects = pgTable(
	"projects",
	{
		id: id(),
		slug: text("slug").notNull(),
		title: text("title").notNull(),
		summary: text("summary"),
		content: text("content"),
		tags: jsonb("tags").$type<string[]>().notNull().default([]),
		tech: jsonb("tech").$type<string[]>().notNull().default([]),
		links: jsonb("links").$type<unknown[]>().notNull().default([]),
		kinds: jsonb("kinds").$type<string[]>().notNull().default([]),
		repoUrl: text("repo_url"),
		apps: jsonb("apps").$type<unknown[]>().notNull().default([]),
		images: jsonb("images").$type<unknown[]>().notNull().default([]),
		coverImageUrl: text("cover_image_url"),
		previewImageUrl: text("preview_image_url"),
		previewUpdatedAt: timestamptz("preview_updated_at"),
		status: text("status", { enum: ["draft", "published", "archived"] }).notNull().default("draft"),
		featured: boolean("featured").notNull().default(false),
		isSecret: boolean("is_secret").notNull().default(false),
		sortIndex: integer("sort_index").notNull().default(0),
		publishedAt: timestamptz("published_at"),
		yearFrom: integer("year_from"),
		yearTo: integer("year_to"),
		ongoing: boolean("ongoing").notNull().default(false),
		createdAt: timestamptz("created_at").notNull().defaultNow(),
		updatedAt: timestamptz("updated_at").notNull().defaultNow(),
		deletedAt: timestamptz("deleted_at"),
	},
	(table) => [
		uniqueIndex("projects_slug_idx").on(table.slug),
		index("projects_status_idx").on(table.status),
		index("projects_listing_idx").on(table.featured.desc(), table.sortIndex, table.publishedAt.desc()),
	],
);
