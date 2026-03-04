import "server-only";
import { z } from "zod";

export const CoverImageSchema = z.object({ url: z.string().url(), alt: z.string().optional() }).nullable();

export const LinksSchema = z
	.object({
		live: z.string().url().optional(),
		repo: z.string().url().optional(),
		github: z.string().url().optional(),
	})
	.nullable();

export const CreateWorkItemSchema = z.object({
	slug: z.string().min(1),
	title: z.string().min(1),
	summary: z.string().optional(),
	content: z.string().optional(),
	tags: z.array(z.string()).optional(),
	coverImage: CoverImageSchema.optional(),
	links: LinksSchema.optional(),
	featured: z.boolean().optional(),
	status: z.enum(["draft", "published", "archived"]).optional(),
	publishedAt: z.string().optional(),
	previewImageUrl: z.string().url().optional(),
});

export const UpdateWorkItemSchema = CreateWorkItemSchema.partial();

export type CreateWorkItemInput = z.infer<typeof CreateWorkItemSchema>;
export type UpdateWorkItemInput = z.infer<typeof UpdateWorkItemSchema>;