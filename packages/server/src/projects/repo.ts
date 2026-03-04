import "server-only";
import { ObjectId, type Filter, type FindOneAndUpdateOptions, type UpdateFilter } from "mongodb";
import { getDb } from "../mongodb";

export type ProjectStatus = "draft" | "published" | "archived";

export type ProjectKind = "web" | "mobile" | "desktop" | "cli";

export type ProjectLink = {
	platform: string;
	label?: string | null;
	url: string;
	kind?: ProjectKind | null;
};

export type ProjectImage = {
	url: string;
	alt?: string | null;
	kind?: ProjectKind | "cover" | "gallery" | null;
};

export type ProjectRecord = {
	id?: string;
	slug: string;
	title: string;
	summary: string;
	content: string;
	tags: string[];
	tech: string[];
	links: ProjectLink[];
	kinds: ProjectKind[];
	images: ProjectImage[];
	coverImageUrl?: string | null;
	previewImageUrl?: string | null;
	status: ProjectStatus;
	featured: boolean;
	isSecret?: boolean;
	sortIndex: number;
	publishedAt?: string | null;
	createdAt?: string | null;
	updatedAt?: string | null;
};

export type DbProject = {
	_id?: ObjectId;
	slug: string;
	title: string;
	summary: string;
	content: string;
	tags: string[];
	kinds: ProjectKind[];
	tech: string[];
	links: ProjectLink[];
	images: ProjectImage[];
	coverImageUrl?: string | null;
	previewImageUrl?: string | null;
	status: ProjectStatus;
	featured: boolean;
	isSecret?: boolean;
	sortIndex: number;
	publishedAt?: Date | null;
	createdAt: Date;
	updatedAt: Date;
	deletedAt?: Date | null;
};

function toProjectRecord(doc: DbProject): ProjectRecord {
	return {
		id: doc._id?.toHexString(),
		slug: doc.slug,
		title: doc.title,
		summary: doc.summary ?? "",
		content: doc.content ?? "",
		tags: doc.tags ?? [],
		kinds: doc.kinds ?? [],
		tech: doc.tech ?? [],
		links: doc.links ?? [],
		images: doc.images ?? [],
		coverImageUrl: doc.coverImageUrl ?? null,
		previewImageUrl: doc.previewImageUrl ?? null,
		status: doc.status ?? "draft",
		featured: !!doc.featured,
		isSecret: !!doc.isSecret,
		sortIndex: doc.sortIndex ?? 0,
		publishedAt: doc.publishedAt ? doc.publishedAt.toISOString() : null,
		createdAt: doc.createdAt?.toISOString?.() ?? null,
		updatedAt: doc.updatedAt?.toISOString?.() ?? null,
	};
}

export async function getProjects(options?: {
	status?: ProjectStatus;
	includeDrafts?: boolean;
	limit?: number;
}): Promise<ProjectRecord[]> {
	const db = await getDb();
	const col = db.collection<DbProject>("projects");

	const query: Filter<DbProject> = { deletedAt: { $exists: false } };
	if (options?.status) {
		query.status = options.status;
	} else if (!options?.includeDrafts) {
		query.status = "published";
	}

	const docs = await col
		.find(query)
		.sort({ featured: -1, sortIndex: 1, publishedAt: -1, updatedAt: -1 })
		.limit(options?.limit ?? 200)
		.toArray();

	return docs.map(toProjectRecord);
}

export async function getProjectBySlugMongo(
	slug: string,
	options?: { includeDrafts?: boolean },
): Promise<ProjectRecord | null> {
	const db = await getDb();
	const col = db.collection<DbProject>("projects");

	const query: Filter<DbProject> = {
		slug,
		deletedAt: { $exists: false },
		...(options?.includeDrafts ? {} : { status: "published" }),
	};

	const doc = await col.findOne(query);
	if (!doc) return null;
	return toProjectRecord(doc);
}

export async function createProject(
	input: Omit<DbProject, "_id" | "createdAt" | "updatedAt" | "deletedAt">,
): Promise<ProjectRecord> {
	const now = new Date();
	const db = await getDb();
	const col = db.collection<DbProject>("projects");

	const doc: DbProject = {
		...input,
		kinds: input.kinds ?? [],
		summary: input.summary ?? "",
		content: input.content ?? "",
		tags: input.tags ?? [],
		tech: input.tech ?? [],
		links: input.links ?? [],
		images: input.images ?? [],
		coverImageUrl: input.coverImageUrl ?? null,
		previewImageUrl: input.previewImageUrl ?? null,
		status: input.status ?? "draft",
		featured: !!input.featured,
		sortIndex: input.sortIndex ?? 0,
		publishedAt: input.publishedAt ?? null,
		createdAt: now,
		updatedAt: now,
	};

	const res = await col.insertOne(doc);
	doc._id = res.insertedId;
	return toProjectRecord(doc);
}

export async function updateProject(idOrSlug: string, input: Partial<DbProject>): Promise<ProjectRecord | null> {
	const db = await getDb();
	const col = db.collection<DbProject>("projects");
	const filter: Filter<DbProject> = ObjectId.isValid(idOrSlug) ? { _id: new ObjectId(idOrSlug) } : { slug: idOrSlug };

	const patch: Partial<DbProject> = {
		...input,
		updatedAt: new Date(),
	};

	const res = await col.findOneAndUpdate(
		filter,
		{ $set: patch } as UpdateFilter<DbProject>,
		{ returnDocument: "after" } as FindOneAndUpdateOptions,
	);

	if (!res.value) return null;
	return toProjectRecord(res.value);
}

export async function softDeleteProject(idOrSlug: string): Promise<boolean> {
	const db = await getDb();
	const col = db.collection<DbProject>("projects");
	const filter: Filter<DbProject> = ObjectId.isValid(idOrSlug) ? { _id: new ObjectId(idOrSlug) } : { slug: idOrSlug };

	const res = await col.updateOne(
		filter,
		{ $set: { deletedAt: new Date(), updatedAt: new Date() } } as UpdateFilter<DbProject>,
	);

	return res.matchedCount > 0;
}

export async function ensureProjectIndexes() {
	const db = await getDb();
	const col = db.collection("projects");
	await col.createIndex({ slug: 1 }, { unique: true });
	await col.createIndex({ status: 1, featured: -1, sortIndex: 1, publishedAt: -1 });
	await col.createIndex({ updatedAt: -1 });
}