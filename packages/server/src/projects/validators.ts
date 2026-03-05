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

/** One app within a project (e.g. web, mobile) with its own repo, images, tags and tech */
export const ProjectAppSchema = z.object({
	kind: ProjectKindSchema,
	repoUrl: z.string().url().optional().nullable(),
	images: z.array(ProjectImageSchema).optional().default([]),
	tags: z.array(z.string()).optional().default([]),
	tech: z.array(z.string()).optional().default([]),
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
	/** Main repo URL for the whole project */
	repoUrl: z.string().url().optional().nullable(),
	/** Per-app config: repo URL + images (e.g. web app repo + screenshots) */
	apps: z.array(ProjectAppSchema).optional().default([]),
	images: z.array(ProjectImageSchema).optional().default([]),
	coverImageUrl: z.string().url().optional().nullable(),
	previewImageUrl: z.string().url().optional().nullable(),
	previewUpdatedAt: z.string().datetime().optional().nullable(),
	status: z.enum(["draft", "published", "archived"]).default("draft"),
	featured: z.boolean().default(false),
	isSecret: z.boolean().default(false),
	sortIndex: z.number().int().optional().default(0),
	publishedAt: z.string().datetime().optional().nullable(),
	/** Development period: start year (e.g. 2022) */
	yearFrom: z.number().int().min(1990).max(2100).optional().nullable(),
	/** Development period: end year (null = still in development) */
	yearTo: z.number().int().min(1990).max(2100).optional().nullable(),
	/** If true, project is still in development (overrides yearTo for display) */
	ongoing: z.boolean().optional().default(false),
});

export const UpdateProjectSchema = CreateProjectSchema.partial();

export type ProjectKind = z.infer<typeof ProjectKindSchema>;
export type ProjectLink = z.infer<typeof ProjectLinkSchema>;
export type ProjectImage = z.infer<typeof ProjectImageSchema>;
export type ProjectApp = z.infer<typeof ProjectAppSchema>;
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;

export type ProjectRecord = CreateProjectInput & {
	_id: string;
	createdAt: string;
	updatedAt: string;
};
