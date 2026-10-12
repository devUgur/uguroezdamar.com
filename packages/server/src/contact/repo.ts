import "server-only";
import { createHmac } from "node:crypto";
import { ObjectId } from "mongodb";
import type { Collection } from "mongodb";
import { env } from "../env";
import { getDb } from "../mongodb";
import type { ContactInput } from "./validators";

const CONTACT_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const CONTACT_RATE_LIMIT_MAX_REQUESTS = 5;
const CONTACT_RATE_LIMIT_RETENTION_MS = 60 * 60 * 1000;

type ContactRateLimitRecord = {
	_id: string;
	count: number;
	expiresAt: Date;
};

let contactRateLimitIndexPromise: Promise<string> | undefined;

export type ContactRateLimitResult = {
	allowed: boolean;
	remaining: number;
	retryAfterSeconds: number;
};

async function incrementRateLimitRecord(
	col: Collection<ContactRateLimitRecord>,
	key: string,
	expiresAt: Date,
) {
	try {
		const result = await col.findOneAndUpdate(
			{ _id: key },
			{ $inc: { count: 1 }, $setOnInsert: { expiresAt } },
			{ upsert: true, returnDocument: "after" },
		);
		return result.value;
	} catch (error) {
		// Concurrent first requests can race to upsert the same deterministic bucket.
		if ((error as { code?: number })?.code !== 11000) throw error;
		await col.updateOne({ _id: key }, { $inc: { count: 1 } });
		return col.findOne({ _id: key });
	}
}

/**
 * Shared per-IP limit for the public form. Only an HMAC is stored; TTL cleanup
 * removes each bucket after the configured short retention window.
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
	const db = await getDb();
	const col = db.collection<ContactRateLimitRecord>("contact_rate_limits");
	if (!contactRateLimitIndexPromise) {
		contactRateLimitIndexPromise = col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch((error) => {
			contactRateLimitIndexPromise = undefined;
			throw error;
		});
	}
	await contactRateLimitIndexPromise;
	const record = await incrementRateLimitRecord(col, key, expiresAt);
	if (!record) throw new Error("Failed to update contact rate limit.");

	return {
		allowed: record.count <= CONTACT_RATE_LIMIT_MAX_REQUESTS,
		remaining: Math.max(0, CONTACT_RATE_LIMIT_MAX_REQUESTS - record.count),
		retryAfterSeconds: Math.max(1, Math.ceil((windowEnd - now.getTime()) / 1000)),
	};
}

export type ContactRequest = ContactInput & {
	_id: ObjectId;
	createdAt: Date;
	source?: string;
};

export async function createContactRequest(payload: ContactInput) {
	const db = await getDb();
	const col = db.collection<Omit<ContactRequest, "_id">>("contact_requests");

	const res = await col.insertOne({
		...payload,
		createdAt: new Date(),
		source: "website",
	});

	return res.insertedId.toString();
}

export async function listContactRequests(opts: { limit?: number; cursor?: string; q?: string } = {}) {
	const limit = Math.min(opts.limit ?? 50, 200);
	const db = await getDb();
	const col = db.collection<ContactRequest>("contact_requests");

	const query: Record<string, unknown> = {};
	if (opts.cursor) {
		query._id = { $lt: new ObjectId(opts.cursor) };
	}

	if (opts.q && typeof opts.q === "string" && opts.q.trim().length > 0) {
		const q = opts.q.trim();
		query.$or = [
			{ name: { $regex: q, $options: "i" } },
			{ email: { $regex: q, $options: "i" } },
		];
	}

	const docs = await col.find(query).sort({ _id: -1 }).limit(limit).toArray();

	const items = docs.map((doc) => ({
		id: doc._id.toString(),
		name: doc.name,
		email: doc.email,
		message: doc.message,
		createdAt: doc.createdAt.toISOString(),
		source: doc.source,
	}));

	const nextCursor = docs.length ? docs[docs.length - 1]._id.toString() : null;

	return { items, nextCursor };
}
