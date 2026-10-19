import "server-only";

import { cache } from "react";
import { z } from "zod";

import { contentDir, readContentFiles } from "./mdx";

const year = z.number().int().min(1990).max(2100);

/**
 * The frontmatter of `content/projects/<slug>.mdx`. The long form — challenge, solution,
 * architecture, outcome — is the MDX body. Unknown keys are rejected so a typo cannot
 * silently drop a field.
 */
export const ProjectFrontmatterSchema = z
  .strictObject({
    title: z.string().min(1),
    summary: z.string().min(1),
    category: z.string().min(1),
    status: z.enum(["active", "completed", "archived"]),
    /** Shown on the home page. */
    featured: z.boolean().default(false),
    /** Lower comes first. */
    displayOrder: z.number().int().default(100),
    /** A draft is visible on a local dev server only and never part of a production build. */
    draft: z.boolean().default(false),
    role: z.string().min(1).optional(),
    contributions: z.array(z.string().min(1)).default([]),
    technologies: z.array(z.string().min(1)).min(1),
    period: z.strictObject({ from: year, to: year.optional(), ongoing: z.boolean().default(false) }).optional(),
    links: z
      .strictObject({
        live: z.url().optional(),
        github: z.url().optional(),
        documentation: z.url().optional(),
      })
      .default({}),
    /** A file under `public/projects/`. */
    cover: z.strictObject({ src: z.string().startsWith("/projects/"), alt: z.string().min(1) }).optional(),
    repositoryVisibility: z.enum(["public", "private", "none"]),
    updatedAt: z.iso.date(),
  })
  .superRefine((project, context) => {
    if (project.repositoryVisibility !== "public" && project.links.github) {
      context.addIssue({ code: "custom", path: ["links", "github"], message: "only a public repository may be linked" });
    }
    if (project.draft) return;
    // What a reader needs before a case study is worth publishing.
    if (!project.role) context.addIssue({ code: "custom", path: ["role"], message: "required to publish" });
    if (project.contributions.length === 0) {
      context.addIssue({ code: "custom", path: ["contributions"], message: "required to publish" });
    }
  });

export type Project = z.infer<typeof ProjectFrontmatterSchema> & {
  slug: string;
  /** MDX source of the case study. */
  body: string;
};

export function parseProject(slug: string, data: unknown, body: string): Project {
  const parsed = ProjectFrontmatterSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(`content/projects/${slug}.mdx is invalid:\n${z.prettifyError(parsed.error)}`);
  }
  return { ...parsed.data, slug, body };
}

const loadProjects = cache(async (): Promise<Project[]> => {
  const files = await readContentFiles(contentDir("projects"));
  return files
    .map((file) => parseProject(file.slug, file.data, file.content))
    .sort((a, b) => a.displayOrder - b.displayOrder || a.title.localeCompare(b.title));
});

export interface ProjectQuery {
  /** Defaults to "not in production", so drafts can be reviewed locally and never ship. */
  includeDrafts?: boolean;
}

const draftsByDefault = () => process.env.NODE_ENV !== "production";

export async function getProjects({ includeDrafts = draftsByDefault() }: ProjectQuery = {}): Promise<Project[]> {
  const projects = await loadProjects();
  return includeDrafts ? projects : projects.filter((project) => !project.draft);
}

export async function getFeaturedProjects(query: ProjectQuery = {}): Promise<Project[]> {
  return (await getProjects(query)).filter((project) => project.featured);
}

export async function getProjectBySlug(slug: string, query: ProjectQuery = {}): Promise<Project | null> {
  return (await getProjects(query)).find((project) => project.slug === slug) ?? null;
}

/** "2024–Present", "2022–2024", "2023", or `null` without a period. */
export function formatPeriod(period: Project["period"]): string | null {
  if (!period) return null;
  if (period.ongoing) return `${period.from}–Present`;
  return period.to && period.to !== period.from ? `${period.from}–${period.to}` : String(period.from);
}

const LINK_LABELS = { live: "Live", github: "GitHub", documentation: "Docs" } as const;

export function projectLinks(project: Project): Array<{ label: string; url: string }> {
  // Local draft previews are for editorial review. They must not act as an
  // endorsement or route visitors to unapproved external project surfaces.
  if (project.draft) return [];
  return (Object.keys(LINK_LABELS) as Array<keyof typeof LINK_LABELS>).flatMap((key) => {
    const url = project.links[key];
    return url ? [{ label: LINK_LABELS[key], url }] : [];
  });
}
