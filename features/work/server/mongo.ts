import { ObjectId, type Filter, type UpdateFilter, type FindOneAndUpdateOptions } from "mongodb";
import { getDb } from "@/shared/lib/mongodb";
import type { WorkItem } from "../types";

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

function toWorkItem(d: DbWork): WorkItem {
  return {
    id: d._id?.toHexString() ?? d.slug,
    slug: d.slug,
    title: d.title,
    summary: d.summary ?? null,
    content: d.content ?? null,
    tags: d.tags ?? [],
    coverImage: d.coverImage ?? null,
    links: d.links ?? null,
    previewImageUrl: d.previewImageUrl ?? null,
    previewUpdatedAt: d.previewUpdatedAt ? d.previewUpdatedAt.toISOString() : null,
    featured: !!d.featured,
    status: d.status ?? "published",
    publishedAt: d.publishedAt ? d.publishedAt.toISOString() : null,
    createdAt: d.createdAt ? d.createdAt.toISOString() : null,
    updatedAt: d.updatedAt ? d.updatedAt.toISOString() : null,
  };
}

export async function getWorkItems(options?: { status?: string; limit?: number }): Promise<WorkItem[]> {
  const db = await getDb();
  const col = db.collection<DbWork>("work_items");
  const q: Filter<DbWork> = { deletedAt: { $exists: false } };
  if (options?.status) q.status = options.status as DbWork["status"];
  const cursor = col.find(q).sort({ featured: -1, publishedAt: -1 }).limit(options?.limit ?? 100);
  const docs = await cursor.toArray();
  return docs.map(toWorkItem);
}

export async function getWorkItemBySlug(slug: string): Promise<WorkItem | null> {
  const db = await getDb();
  const col = db.collection<DbWork>("work_items");
  const d = await col.findOne({ slug, deletedAt: { $exists: false } } as Filter<DbWork>);
  if (!d) return null;
  return toWorkItem(d);
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
  const res = await col.findOneAndUpdate(filter, { $set: input } as UpdateFilter<DbWork>, { returnDocument: "after" } as FindOneAndUpdateOptions);
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
