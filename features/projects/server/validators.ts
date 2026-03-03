import { z } from "zod";

export const ProjectLinkSchema = z.object({
  platform: z.string().min(1),
  label: z.string().optional(),
  url: z.string().url(),
});

export const ProjectImageSchema = z.object({
  url: z.string().url(),
  alt: z.string().optional(),
  kind: z.string().optional(),
});

export const CreateProjectSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().optional(),
  content: z.string().optional(),
  tags: z.array(z.string()).optional(),
  tech: z.array(z.string()).optional(),
  links: z.array(ProjectLinkSchema).optional(),
  images: z.array(ProjectImageSchema).optional(),
  coverImageUrl: z.string().url().optional(),
  previewImageUrl: z.string().url().optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  featured: z.boolean().optional(),
  sortIndex: z.number().int().optional(),
  publishedAt: z.string().datetime().optional(),
});

export const UpdateProjectSchema = CreateProjectSchema.partial();

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
