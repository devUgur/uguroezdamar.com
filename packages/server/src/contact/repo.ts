import "server-only";
import { createHmac } from "node:crypto";
import { and, desc, eq, gt, ilike, lt, or, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { contactRateLimits, contactRequests } from "../db/schema";
import { env } from "../env";
import type { ContactInput } from "./validators";

const CONTACT_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const CONTACT_RATE_LIMIT_MAX_REQUESTS = 5;
const CONTACT_RATE_LIMIT_RETENTION_MS = 60 * 60 * 1000;
const CONTACT_REQUEST_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export type ContactRateLimitResult = {
	allowed: boolean;
	remaining: number;
	retryAfterSeconds: number;
};

/**
 * Shared per-IP limit for the public form. Only an HMAC is stored; buckets past their short
 * retention window are removed whenever a new request is counted.
 */
export async function consumeContactRateLimit(clientAddress: string, now = new Date()): Promise<ContactRateLimitResult> {
	if (env.CONTACT_RATE_LIMIT_SECRET.length < 32) {
		throw new Error("CONTACT_RATE_LIMIT_SECRET must contain at least 32 characters.");
	}
	if (!clientAddress.trim()) throw new Error("Client address is unavailable.");

	const bucket = Math.floor(now.getTime() / CONTACT_RATE_LIMIT_WINDOW_MS);
	const windowEnd = (bucket + 1) * CONTACT_RATE_LIMIT_WINDOW_MS;
	const addressHash = createHmac("sha256", env.CONTACT_RATE_LIMIT_SECRET).update(clientAddress.trim()).digest("hex");
	const key = `${bucket}:${addressHash}`;
	const expiresAt = new Date(windowEnd + CONTACT_RATE_LIMIT_RETENTION_MS);
	const db = getDb();

	// One atomic statement, so simultaneous first requests cannot both count as "1".
	const [record] = await db
		.insert(contactRateLimits)
		.values({ key, count: 1, expiresAt })
		.onConflictDoUpdate({
			target: contactRateLimits.key,
			set: { count: sql`${contactRateLimits.count} + 1` },
		})
		.returning({ count: contactRateLimits.count });
	if (!record) throw new Error("Failed to update contact rate limit.");

	await db.delete(contactRateLimits).where(lt(contactRateLimits.expiresAt, new Date()));

	return {
		allowed: record.count <= CONTACT_RATE_LIMIT_MAX_REQUESTS,
		remaining: Math.max(0, CONTACT_RATE_LIMIT_MAX_REQUESTS - record.count),
		retryAfterSeconds: Math.max(1, Math.ceil((windowEnd - now.getTime()) / 1000)),
	};
}

export type ContactRequest = {
	id: string;
	name: string;
	email: string;
	message: string;
	createdAt: string;
	expiresAt: string;
	source: string;
};

export async function createContactRequest(payload: ContactInput) {
	const now = new Date();
	const [row] = await getDb()
		.insert(contactRequests)
		.values({
			name: payload.name,
			email: payload.email,
			message: payload.message,
			source: "website",
			createdAt: now,
			expiresAt: new Date(now.getTime() + CONTACT_REQUEST_RETENTION_MS),
		})
		.returning({ id: contactRequests.id });
	return String(row.id);
}

/** Extend the deletion deadline after the owner has finished processing the inquiry. */
export async function markContactRequestProcessed(id: string, now = new Date()): Promise<Date | null> {
	const numericId = Number(id);
	if (!Number.isSafeInteger(numericId) || numericId < 1) return null;
	const rows = await getDb()
		.update(contactRequests)
		.set({ expiresAt: new Date(now.getTime() + CONTACT_REQUEST_RETENTION_MS) })
		.where(eq(contactRequests.id, numericId))
		.returning({ expiresAt: contactRequests.expiresAt });
	return rows[0]?.expiresAt ?? null;
}

/** Delete a single contact request after a verified data-subject erasure request. */
export async function deleteContactRequest(id: string): Promise<boolean> {
	const numericId = Number(id);
	if (!Number.isSafeInteger(numericId) || numericId < 1) return false;
	const rows = await getDb()
		.delete(contactRequests)
		.where(eq(contactRequests.id, numericId))
		.returning({ id: contactRequests.id });
	return rows.length > 0;
}

/** Delete expired inquiries. Invoked by the authenticated daily production cron. */
export async function deleteExpiredContactRequests(now = new Date()): Promise<number> {
	const rows = await getDb()
		.delete(contactRequests)
		.where(lt(contactRequests.expiresAt, now))
		.returning({ id: contactRequests.id });
	return rows.length;
}

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

export async function listContactRequests(opts: { limit?: number; cursor?: string; q?: string } = {}) {
	const limit = Math.min(opts.limit ?? 50, 200);
	const cursor = opts.cursor && /^\d+$/.test(opts.cursor) ? Number(opts.cursor) : null;
	const q = typeof opts.q === "string" ? opts.q.trim() : "";
	const pattern = `%${escapeLike(q)}%`;
	const now = new Date();

	const rows = await getDb()
		.select()
		.from(contactRequests)
		.where(
			and(
				gt(contactRequests.expiresAt, now),
				cursor === null ? undefined : lt(contactRequests.id, cursor),
				q ? or(ilike(contactRequests.name, pattern), ilike(contactRequests.email, pattern)) : undefined,
			),
		)
		.orderBy(desc(contactRequests.id))
		.limit(limit);

	const items: ContactRequest[] = rows.map((row) => ({
		id: String(row.id),
		name: row.name,
		email: row.email,
		message: row.message,
		createdAt: row.createdAt.toISOString(),
		expiresAt: row.expiresAt.toISOString(),
		source: row.source,
	}));

	return { items, nextCursor: items.length ? items[items.length - 1].id : null };
}
