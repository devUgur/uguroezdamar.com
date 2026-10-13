import { sql } from "drizzle-orm";
import {
	bigint,
	index,
	integer,
	pgTable,
	text,
	timestamp,
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
});

export const contactRateLimits = pgTable(
	"contact_rate_limits",
	{
		key: text("key").primaryKey(),
		count: integer("count").notNull().default(0),
		expiresAt: timestamptz("expires_at").notNull(),
	},
	(table) => [index("contact_rate_limits_expires_at_idx").on(table.expiresAt)],
);
