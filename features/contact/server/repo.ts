import "server-only";
import { ObjectId } from "mongodb";
import { getDb } from "@/shared/lib/mongodb";
import type { ContactInput } from "./validators";

export type LeadRecord = ContactInput & {
  _id: ObjectId;
  createdAt: Date;
  source?: string;
};

export async function createLead(payload: ContactInput) {
  const db = await getDb();
  const col = db.collection<Omit<LeadRecord, "_id">>("leads");

  const res = await col.insertOne({
    ...payload,
    createdAt: new Date(),
    source: "website",
  });

  return res.insertedId.toString();
}

export async function listLeads(opts: { limit?: number; cursor?: string; q?: string } = {}) {
  const limit = Math.min(opts.limit ?? 50, 200);
  const db = await getDb();
  const col = db.collection<LeadRecord>("leads");

  const query: Record<string, unknown> = {};
  if (opts.cursor) {
    query._id = { $lt: new ObjectId(opts.cursor) };
  }

  if (opts.q && typeof opts.q === "string" && opts.q.trim().length > 0) {
    const q = opts.q.trim();
    // simple case-insensitive partial match on name or email
    query.$or = [
      { name: { $regex: q, $options: "i" } },
      { email: { $regex: q, $options: "i" } },
    ];
  }

  const docs = await col.find(query).sort({ _id: -1 }).limit(limit).toArray();

  const items = docs.map((d) => ({
    id: d._id.toString(),
    name: d.name,
    email: d.email,
    message: d.message,
    createdAt: d.createdAt.toISOString(),
    source: d.source,
  }));

  const nextCursor = docs.length ? docs[docs.length - 1]._id.toString() : null;

  return { items, nextCursor };
}
