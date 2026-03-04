import "server-only";
import { ObjectId, type Filter, type FindOneAndUpdateOptions, type UpdateFilter } from "mongodb";
import { getDb } from "../mongodb";

export type ProfileLinks = {
	github?: string | null;
	linkedin?: string | null;
	website?: string | null;
};

export type Profile = {
	id: string;
	handle: string;
	headline: string;
	subheadline?: string | null;
	bio: string;
	location?: string | null;
	email?: string | null;
	links: ProfileLinks;
	updatedAt: string;
	createdAt: string;
};

export type DbProfile = {
	_id?: ObjectId;
	handle: string;
	headline: string;
	subheadline?: string | null;
	bio: string;
	location?: string | null;
	email?: string | null;
	links: {
		github?: string | null;
		linkedin?: string | null;
		website?: string | null;
	};
	createdAt: Date;
	updatedAt: Date;
};

function toProfile(doc: DbProfile): Profile {
	return {
		id: doc._id?.toHexString() ?? doc.handle,
		handle: doc.handle,
		headline: doc.headline,
		subheadline: doc.subheadline ?? null,
		bio: doc.bio,
		location: doc.location ?? null,
		email: doc.email ?? null,
		links: {
			github: doc.links?.github ?? null,
			linkedin: doc.links?.linkedin ?? null,
			website: doc.links?.website ?? null,
		},
		createdAt: doc.createdAt.toISOString(),
		updatedAt: doc.updatedAt.toISOString(),
	};
}

export async function getProfile(handle = "main"): Promise<Profile | null> {
	const db = await getDb();
	const col = db.collection<DbProfile>("profile");
	const doc = await col.findOne({ handle } as Filter<DbProfile>);
	if (!doc) return null;
	return toProfile(doc);
}

export async function upsertProfile(
	handle: string,
	input: Omit<DbProfile, "_id" | "handle" | "createdAt" | "updatedAt">,
): Promise<Profile> {
	const db = await getDb();
	const col = db.collection<DbProfile>("profile");

	const now = new Date();
	const update: UpdateFilter<DbProfile> = {
		$set: {
			headline: input.headline,
			subheadline: input.subheadline ?? null,
			bio: input.bio,
			location: input.location ?? null,
			email: input.email ?? null,
			links: {
				github: input.links?.github ?? null,
				linkedin: input.links?.linkedin ?? null,
				website: input.links?.website ?? null,
			},
			updatedAt: now,
		},
		$setOnInsert: {
			handle,
			createdAt: now,
		} as Partial<DbProfile>,
	};

	const res = await col.findOneAndUpdate(
		{ handle } as Filter<DbProfile>,
		update,
		{ upsert: true, returnDocument: "after" } as FindOneAndUpdateOptions,
	);

	if (!res.value) {
		throw new Error("Failed to upsert profile");
	}

	return toProfile(res.value);
}

export async function ensureProfileIndexes() {
	const db = await getDb();
	const col = db.collection("profile");
	await col.createIndex({ handle: 1 }, { unique: true });
}