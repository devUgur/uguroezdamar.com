import "server-only";
import { z } from "zod";

export const ProfileLinksSchema = z.object({
	github: z.string().url().optional(),
	linkedin: z.string().url().optional(),
	website: z.string().url().optional(),
});

export const UpsertProfileSchema = z.object({
	handle: z.string().min(1).default("main"),
	headline: z.string().min(1),
	subheadline: z.string().optional(),
	bio: z.string().min(1),
	location: z.string().optional(),
	email: z.string().email().optional(),
	links: ProfileLinksSchema.optional(),
});

export type UpsertProfileInput = z.infer<typeof UpsertProfileSchema>;