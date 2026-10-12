import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { profiles } from "../db/schema";

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

export type DbProfile = typeof profiles.$inferSelect;

function toProfile(row: DbProfile): Profile {
	return {
		id: row.id,
		handle: row.handle,
		headline: row.headline,
		subheadline: row.subheadline ?? null,
		bio: row.bio,
		location: row.location ?? null,
		email: row.email ?? null,
		links: {
			github: row.links?.github ?? null,
			linkedin: row.links?.linkedin ?? null,
			website: row.links?.website ?? null,
		},
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

export async function getProfile(handle = "main"): Promise<Profile | null> {
	const [row] = await getDb().select().from(profiles).where(eq(profiles.handle, handle)).limit(1);
	return row ? toProfile(row) : null;
}

export async function upsertProfile(
	handle: string,
	input: {
		headline: string;
		subheadline?: string | null;
		bio: string;
		location?: string | null;
		email?: string | null;
		links?: ProfileLinks;
	},
): Promise<Profile> {
	const now = new Date();
	const values = {
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
	};

	const [row] = await getDb()
		.insert(profiles)
		.values({ handle, ...values, createdAt: now })
		.onConflictDoUpdate({ target: profiles.handle, set: values })
		.returning();

	if (!row) throw new Error("Failed to upsert profile");
	return toProfile(row);
}
