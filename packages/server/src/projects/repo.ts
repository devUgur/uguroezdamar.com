import "server-only";
import { ObjectId, type Filter } from "mongodb";
import { getDb } from "../mongodb";
import type { CreateProjectInput, ProjectRecord, UpdateProjectInput } from "./validators";

const PROJECTS_COLLECTION = "projects";

function toProjectRecord(doc: any): ProjectRecord {
	return {
		...doc,
		_id: doc._id.toString(),
		createdAt: doc.createdAt?.toISOString?.() ?? doc.createdAt,
		updatedAt: doc.updatedAt?.toISOString?.() ?? doc.updatedAt,
		publishedAt: doc.publishedAt?.toISOString?.() ?? doc.publishedAt,
		previewUpdatedAt: doc.previewUpdatedAt?.toISOString?.() ?? doc.previewUpdatedAt,
	};
}

export async function getProjects(options?: {
	status?: string;
	featured?: boolean;
	limit?: number;
}): Promise<ProjectRecord[]> {
	const db = await getDb();
	const col = db.collection(PROJECTS_COLLECTION);

	const query: Filter<any> = { deletedAt: { $exists: false } };
	if (options?.status) query.status = options.status;
	if (options?.featured !== undefined) query.featured = options.featured;

	const docs = await col
		.find(query)
		.sort({ featured: -1, sortIndex: 1, publishedAt: -1 })
		.limit(options?.limit ?? 100)
		.toArray();

	return docs.map(toProjectRecord);
}

export async function getProjectBySlugMongo(slug: string): Promise<ProjectRecord | null> {
	const db = await getDb();
	const col = db.collection(PROJECTS_COLLECTION);

	const doc = await col.findOne({ slug, deletedAt: { $exists: false } });
	if (!doc) return null;

	return toProjectRecord(doc);
}

export async function getProjectById(id: string): Promise<ProjectRecord | null> {
	const db = await getDb();
	const col = db.collection(PROJECTS_COLLECTION);

	const doc = await col.findOne({ _id: new ObjectId(id), deletedAt: { $exists: false } });
	if (!doc) return null;

	return toProjectRecord(doc);
}

export async function createProject(input: CreateProjectInput): Promise<ProjectRecord> {
	const db = await getDb();
	const col = db.collection(PROJECTS_COLLECTION);

	const now = new Date();
	const doc = {
		...input,
		createdAt: now,
		updatedAt: now,
		publishedAt: input.publishedAt ? new Date(input.publishedAt) : null,
		previewUpdatedAt: input.previewUpdatedAt ? new Date(input.previewUpdatedAt) : null,
	};

	const res = await col.insertOne(doc);
	return toProjectRecord({ ...doc, _id: res.insertedId });
}

export async function updateProject(id: string, input: UpdateProjectInput): Promise<boolean> {
	const db = await getDb();
	const col = db.collection(PROJECTS_COLLECTION);

	const update: any = {
		...input,
		updatedAt: new Date(),
	};

	if (input.publishedAt) {
		update.publishedAt = new Date(input.publishedAt);
	}
	if (input.previewUpdatedAt) {
		update.previewUpdatedAt = new Date(input.previewUpdatedAt);
	}

	const res = await col.updateOne({ _id: new ObjectId(id) }, { $set: update });
	return res.modifiedCount > 0;
}

export async function softDeleteProject(id: string): Promise<boolean> {
	const db = await getDb();
	const col = db.collection(PROJECTS_COLLECTION);

	const res = await col.updateOne(
		{ _id: new ObjectId(id) },
		{ $set: { deletedAt: new Date(), updatedAt: new Date() } }
	);

	return res.modifiedCount > 0;
}

export async function ensureProjectIndexes() {
	const db = await getDb();
	const col = db.collection(PROJECTS_COLLECTION);
	await col.createIndex({ slug: 1 }, { unique: true });
	await col.createIndex({ status: 1 });
	await col.createIndex({ featured: -1, sortIndex: 1, publishedAt: -1 });
}
