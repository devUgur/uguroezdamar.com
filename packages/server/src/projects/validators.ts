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
	summary: z.string().optional().nullable(),
	content: z.string().optional().nullable(), // MDX or long-form content
	tags: z.array(z.string()).optional().default([]),
	tech: z.array(z.string()).optional().default([]),
	links: z.array(ProjectLinkSchema).optional().default([]),
	kinds: z.array(ProjectKindSchema).optional().default([]),
	images: z.array(ProjectImageSchema).optional().default([]),
	coverImageUrl: z.string().url().optional().nullable(),
	previewImageUrl: z.string().url().optional().nullable(),
	previewUpdatedAt: z.string().datetime().optional().nullable(),
	status: z.enum(["draft", "published", "archived"]).default("draft"),
	featured: z.boolean().default(false),
	isSecret: z.boolean().default(false),
	sortIndex: z.number().int().optional().default(0),
	publishedAt: z.string().datetime().optional().nullable(),
});

export const UpdateProjectSchema = CreateProjectSchema.partial();

export type ProjectKind = z.infer<typeof ProjectKindSchema>;
export type ProjectLink = z.infer<typeof ProjectLinkSchema>;
export type ProjectImage = z.infer<typeof ProjectImageSchema>;
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;

export type ProjectRecord = CreateProjectInput & {
	_id: string;
	createdAt: string;
	updatedAt: string;
};
