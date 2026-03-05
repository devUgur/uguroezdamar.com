import "server-only";
import { ObjectId } from "mongodb";
import { getDb } from "../mongodb";
import type { ContactInput } from "./validators";

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
