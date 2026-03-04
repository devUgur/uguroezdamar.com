import "server-only";

import { ObjectId, type Filter, type FindOneAndUpdateOptions, type UpdateFilter } from "mongodb";
import { getDb } from "../mongodb";

export type TimelineItemType = "work" | "education";
export type TimelineItemStatus = "draft" | "published";

export type TimelineVisibility = {
	about: boolean;
	education: boolean;
};

export type TimelineItem = {
	id: string;
	type: TimelineItemType;
	title: string;
	organization: string;
	location?: string | null;
	startDate: string;
	endDate?: string | null;
	isCurrent: boolean;
	description?: string | null;
	highlights?: string[];
	sortIndex: number;
	visibility: TimelineVisibility;
	status: TimelineItemStatus;
	createdAt: string;
	updatedAt: string;
};

export type DbTimelineItem = {
	_id?: ObjectId;
	type: "work" | "education" | "experience";
	title: string;
	organization: string;
	location?: string | null;
	startDate: Date;
	endDate?: Date | null;
	isCurrent: boolean;
	description?: string | null;
	highlights?: string[];
	sortIndex: number;
	visibility: { about: boolean; education: boolean };
	status: "draft" | "published";
	createdAt: Date;
	updatedAt: Date;
	deletedAt?: Date | null;
};

function toTimelineItem(doc: DbTimelineItem): TimelineItem {
	const normalizedType = doc.type === "experience" ? "work" : doc.type;

	return {
		id: doc._id?.toHexString() ?? "",
		type: normalizedType,
		title: doc.title,
		organization: doc.organization,
		location: doc.location ?? null,
		startDate: doc.startDate.toISOString(),
		endDate: doc.endDate ? doc.endDate.toISOString() : null,
		isCurrent: !!doc.isCurrent,
		description: doc.description ?? null,
		highlights: doc.highlights ?? [],
		sortIndex: doc.sortIndex ?? 0,
		visibility: {
			about: !!doc.visibility?.about,
			education: !!doc.visibility?.education,
		},
		status: doc.status ?? "draft",
		createdAt: doc.createdAt.toISOString(),
		updatedAt: doc.updatedAt.toISOString(),
	};
}

export async function getTimelineItems(options?: {
	status?: "draft" | "published";
	type?: "work" | "education";
	visibility?: "about" | "education";
	limit?: number;
}): Promise<TimelineItem[]> {
	const db = await getDb();
	const col = db.collection<DbTimelineItem>("timeline_items");
	const query: Filter<DbTimelineItem> = { deletedAt: { $exists: false } };

	if (options?.status) query.status = options.status;
	if (options?.type) {
		if (options.type === "work") {
			query.type = { $in: ["work", "experience"] } as unknown as DbTimelineItem["type"];
		} else {
			query.type = options.type;
		}
	}
	if (options?.visibility) {
		query[`visibility.${options.visibility}` as keyof DbTimelineItem] = true as never;
	}

	const docs = await col
		.find(query)
		.sort({ isCurrent: -1, endDate: -1, startDate: -1, createdAt: -1 })
		.limit(options?.limit ?? 200)
		.toArray();

	return docs.map(toTimelineItem);
}

export async function getTimelineItemById(id: string): Promise<TimelineItem | null> {
	if (!ObjectId.isValid(id)) return null;
	const db = await getDb();
	const col = db.collection<DbTimelineItem>("timeline_items");
	const doc = await col.findOne({ _id: new ObjectId(id), deletedAt: { $exists: false } } as Filter<DbTimelineItem>);
	if (!doc) return null;
	return toTimelineItem(doc);
}

export async function createTimelineItem(
	input: Omit<DbTimelineItem, "_id" | "createdAt" | "updatedAt" | "deletedAt">,
): Promise<TimelineItem> {
	const now = new Date();
	const db = await getDb();
	const col = db.collection<DbTimelineItem>("timeline_items");

	const doc: DbTimelineItem = {
		...input,
		location: input.location ?? null,
		endDate: input.endDate ?? null,
		description: input.description ?? null,
		highlights: input.highlights ?? [],
		sortIndex: input.sortIndex ?? 0,
		visibility: input.visibility ?? { about: false, education: false },
		status: input.status ?? "draft",
		isCurrent: !!input.isCurrent,
		createdAt: now,
		updatedAt: now,
	};

	const res = await col.insertOne(doc);
	doc._id = res.insertedId;
	return toTimelineItem(doc);
}

export async function updateTimelineItem(id: string, input: Partial<DbTimelineItem>): Promise<TimelineItem | null> {
	if (!ObjectId.isValid(id)) return null;

	const db = await getDb();
	const col = db.collection<DbTimelineItem>("timeline_items");

	const patch: Partial<DbTimelineItem> = {
		...input,
		updatedAt: new Date(),
	};

	const res = await col.findOneAndUpdate(
		{ _id: new ObjectId(id), deletedAt: { $exists: false } } as Filter<DbTimelineItem>,
		{ $set: patch } as UpdateFilter<DbTimelineItem>,
		{ returnDocument: "after" } as FindOneAndUpdateOptions,
	);

	if (!res.value) return null;
	return toTimelineItem(res.value);
}

export async function softDeleteTimelineItem(id: string): Promise<boolean> {
	if (!ObjectId.isValid(id)) return false;

	const db = await getDb();
	const col = db.collection<DbTimelineItem>("timeline_items");
	const res = await col.updateOne(
		{ _id: new ObjectId(id), deletedAt: { $exists: false } } as Filter<DbTimelineItem>,
		{ $set: { deletedAt: new Date(), updatedAt: new Date() } } as UpdateFilter<DbTimelineItem>,
	);

	return res.matchedCount > 0;
}

export async function ensureTimelineIndexes() {
	const db = await getDb();
	const col = db.collection("timeline_items");
	await col.createIndex({ deletedAt: 1, status: 1, type: 1 });
	await col.createIndex({ sortIndex: 1, startDate: -1 });
	await col.createIndex({ "visibility.about": 1, status: 1 });
	await col.createIndex({ "visibility.education": 1, status: 1 });
}