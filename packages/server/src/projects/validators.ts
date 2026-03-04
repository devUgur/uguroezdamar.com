import "server-only";
import { z } from "zod";

export const ProjectKindSchema = z.enum(["web", "mobile", "desktop", "cli"]);

export const ProjectLinkSchema = z.object({
	platform: z.string().min(1),
	label: z.string().optional(),
	url: z.string().url(),
	kind: ProjectKindSchema.optional().nullable(),
});

export const ProjectImageSchema = z.object({
	url: z.string().url(),
	alt: z.string().optional(),
	kind: z.enum(["web", "mobile", "desktop", "cli", "cover", "gallery"]).optional().nullable(),
});

export const CreateProjectSchema = z.object({
	slug: z.string().min(1),
	title: z.string().min(1),
	summary: z.string().optional(),
	content: z.string().optional(),
	tags: z.array(z.string()).optional(),
	tech: z.array(z.string()).optional(),
	links: z.array(ProjectLinkSchema).optional(),
	kinds: z.array(ProjectKindSchema).optional(),
	images: z.array(ProjectImageSchema).optional(),
	coverImageUrl: z.string().url().optional().nullable(),
	previewImageUrl: z.string().url().optional().nullable(),
	status: z.enum(["draft", "published", "archived"]).optional(),
	featured: z.boolean().optional(),
	isSecret: z.boolean().optional(),
	sortIndex: z.number().int().optional(),
	publishedAt: z.string().datetime().optional(),
});

export const UpdateProjectSchema = CreateProjectSchema.partial();

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;