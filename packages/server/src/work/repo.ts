import "server-only";
import { ObjectId, type Filter, type FindOneAndUpdateOptions, type UpdateFilter } from "mongodb";
import { getDb } from "../mongodb";

export type CoverImage = { url: string; alt?: string } | null;

export type Links = {
	live?: string | null;
	repo?: string | null;
	github?: string | null;
};

export type WorkItem = {
	id: string;
	slug: string;
	title: string;
	summary?: string | null;
	content?: string | null;
	tags?: string[];
	coverImage?: CoverImage;
	links?: Links | null;
	previewImageUrl?: string | null;
	previewUpdatedAt?: string | null;
	featured?: boolean;
	status?: "published" | "draft" | "archived";
	publishedAt?: string | null;
	createdAt?: string | null;
	updatedAt?: string | null;
};

export type DbWork = {
	_id?: ObjectId;
	slug: string;
	title: string;
	summary?: string | null;
	content?: string | null;
	tags?: string[];
	coverImage?: { url: string; alt?: string } | null;
	links?: { live?: string | null; repo?: string | null; github?: string | null } | null;
	previewImageUrl?: string | null;
	previewUpdatedAt?: Date | null;
	featured?: boolean;
	status?: "published" | "draft" | "archived";
	publishedAt?: Date | null;
	createdAt?: Date;
	updatedAt?: Date;
	deletedAt?: Date | null;
};

function toWorkItem(doc: DbWork): WorkItem {
	return {
		id: doc._id?.toHexString() ?? doc.slug,
		slug: doc.slug,
		title: doc.title,
		summary: doc.summary ?? null,
		content: doc.content ?? null,
		tags: doc.tags ?? [],
		coverImage: doc.coverImage ?? null,
		links: doc.links ?? null,
		previewImageUrl: doc.previewImageUrl ?? null,
		previewUpdatedAt: doc.previewUpdatedAt ? doc.previewUpdatedAt.toISOString() : null,
		featured: !!doc.featured,
		status: doc.status ?? "published",
		publishedAt: doc.publishedAt ? doc.publishedAt.toISOString() : null,
		createdAt: doc.createdAt ? doc.createdAt.toISOString() : null,
		updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : null,
	};
}

export async function getWorkItems(options?: { status?: string; limit?: number }): Promise<WorkItem[]> {
	const db = await getDb();
	const col = db.collection<DbWork>("work_items");
	const query: Filter<DbWork> = { deletedAt: { $exists: false } };
	if (options?.status) query.status = options.status as DbWork["status"];
	const cursor = col.find(query).sort({ featured: -1, publishedAt: -1 }).limit(options?.limit ?? 100);
	const docs = await cursor.toArray();
	return docs.map(toWorkItem);
}

export async function getWorkItemBySlug(slug: string): Promise<WorkItem | null> {
	const db = await getDb();
	const col = db.collection<DbWork>("work_items");
	const doc = await col.findOne({ slug, deletedAt: { $exists: false } } as Filter<DbWork>);
	if (!doc) return null;
	return toWorkItem(doc);
}

export async function createWorkItem(input: Partial<DbWork> & { slug: string; title: string }): Promise<WorkItem> {
	const now = new Date();
	const db = await getDb();
	const col = db.collection<DbWork>("work_items");
	const doc: DbWork = {
		slug: input.slug,
		title: input.title,
		summary: input.summary ?? null,
		content: input.content ?? null,
		tags: input.tags ?? [],
		coverImage: input.coverImage ?? null,
		links: input.links ?? null,
		previewImageUrl: input.previewImageUrl ?? null,
		previewUpdatedAt: input.previewUpdatedAt ?? null,
		featured: !!input.featured,
		status: input.status ?? "draft",
		publishedAt: input.publishedAt ?? null,
		createdAt: now,
		updatedAt: now,
	};
	const res = await col.insertOne(doc);
	doc._id = res.insertedId;
	return toWorkItem(doc);
}

export async function updateWorkItem(idOrSlug: string, input: Partial<DbWork>): Promise<WorkItem | null> {
	const db = await getDb();
	const col = db.collection<DbWork>("work_items");
	const filter: Filter<DbWork> = ObjectId.isValid(idOrSlug) ? { _id: new ObjectId(idOrSlug) } : { slug: idOrSlug };
	input.updatedAt = new Date();
	const res = await col.findOneAndUpdate(
		filter,
		{ $set: input } as UpdateFilter<DbWork>,
		{ returnDocument: "after" } as FindOneAndUpdateOptions,
	);
	if (!res.value) return null;
	return toWorkItem(res.value);
}

export async function softDeleteWorkItem(idOrSlug: string): Promise<boolean> {
	const db = await getDb();
	const col = db.collection<DbWork>("work_items");
	const filter: Filter<DbWork> = ObjectId.isValid(idOrSlug) ? { _id: new ObjectId(idOrSlug) } : { slug: idOrSlug };
	const res = await col.updateOne(filter, { $set: { deletedAt: new Date() } } as UpdateFilter<DbWork>);
	return res.matchedCount > 0;
}

export async function ensureWorkIndexes() {
	const db = await getDb();
	const col = db.collection("work_items");
	await col.createIndex({ slug: 1 }, { unique: true });
	await col.createIndex({ status: 1 });
	await col.createIndex({ featured: -1, sortIndex: 1, publishedAt: -1 });
	await col.createIndex({ previewUpdatedAt: -1 });
}