import "server-only";
import { ObjectId } from "mongodb";
import { getDb } from "../mongodb";
import type { CareerEntryInput, CareerEntry, UpdateCareerEntryInput } from "./validators";

const CAREER_COLLECTION = "careerEntries";

export async function createCareerEntry(data: CareerEntryInput): Promise<CareerEntry> {
  const db = await getDb();
  const col = db.collection(CAREER_COLLECTION);
  const now = new Date().toISOString();

  const doc = {
    ...data,
    createdAt: now,
    updatedAt: now,
  };

  const res = await col.insertOne(doc);
  return {
    ...doc,
    _id: res.insertedId.toString(),
  } as CareerEntry;
}

export async function getCareerEntries(filter: { type?: string; status?: string; visibility?: string } = {}): Promise<CareerEntry[]> {
  const db = await getDb();
  const col = db.collection(CAREER_COLLECTION);

  const query: any = {};
  if (filter.type) query.type = filter.type;
  if (filter.status) query.status = filter.status;
  if (filter.visibility) {
    query[`visibility.${filter.visibility}`] = true;
  }

  const items = await col.find(query).sort({ "date.start": -1, sortKey: 1 }).toArray();
  return items.map((item) => ({
    ...item,
    _id: item._id.toString(),
  })) as CareerEntry[];
}

export async function getCareerEntryById(id: string): Promise<CareerEntry | null> {
  const db = await getDb();
  const col = db.collection(CAREER_COLLECTION);

  const item = await col.findOne({ _id: new ObjectId(id) });
  if (!item) return null;

  return {
    ...item,
    _id: item._id.toString(),
  } as CareerEntry;
}

export async function getCareerEntryBySlug(slug: string): Promise<CareerEntry | null> {
  const db = await getDb();
  const col = db.collection(CAREER_COLLECTION);

  const item = await col.findOne({ slug });
  if (!item) return null;

  return {
    ...item,
    _id: item._id.toString(),
  } as CareerEntry;
}

export async function updateCareerEntry(id: string, data: UpdateCareerEntryInput): Promise<boolean> {
  const db = await getDb();
  const col = db.collection(CAREER_COLLECTION);

  const res = await col.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        ...data,
        updatedAt: new Date().toISOString(),
      },
    }
  );

  return res.modifiedCount > 0;
}

export async function deleteCareerEntry(id: string): Promise<boolean> {
  const db = await getDb();
  const col = db.collection(CAREER_COLLECTION);

  const res = await col.deleteOne({ _id: new ObjectId(id) });
  return res.deletedCount > 0;
}
