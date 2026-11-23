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
    category: z.string().min(1).optional(),
    status: z.enum(["active", "completed", "archived"]).optional(),
    /** Shown on the home page. */
    featured: z.boolean().default(false),
    /** Lower comes first. */
    displayOrder: z.number().int().default(100),
    /** Drafts may be reviewed locally and on protected Vercel Preview deployments only. */
    draft: z.boolean().default(false),
    role: z.string().min(1).optional(),
    contributions: z.array(z.string().min(1)).default([]),
    technologies: z.array(z.string().min(1)).default([]),
    period: z.strictObject({ from: year, to: year.optional(), ongoing: z.boolean().default(false) }).optional(),
    links: z
      .strictObject({
        live: z.url().optional(),
        github: z.url().optional(),
        documentation: z.url().optional(),
      })
      .default({}),
    /** A file under `public/projects/`. */
    cover: z
      .strictObject({
        src: z.string().startsWith("/projects/"),
        alt: z.string().min(1),
        caption: z.string().min(1).optional(),
        /** Describes the approved asset itself; never infer a device from its project. */
        frame: z.enum(["browser", "mobile", "none"]),
      })
      .optional(),
    repositoryVisibility: z.enum(["public", "private", "none"]),
    /** Import provenance for a GitHub-generated draft; not rendered by the site. */
    source: z
      .strictObject({
        provider: z.literal("github"),
        repository: z.string().regex(/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/),
        commit: z.string().regex(/^[a-f0-9]{40}$/i),
        readme: z
          .strictObject({ path: z.string().min(1).max(1024), sha: z.string().regex(/^[a-f0-9]{40}$/i) })
          .nullable(),
        importedAt: z.iso.datetime(),
      })
      .optional(),
    updatedAt: z.iso.date(),
  })
  .superRefine((project, context) => {
    if (project.repositoryVisibility !== "public" && project.links.github) {
      context.addIssue({ code: "custom", path: ["links", "github"], message: "only a public repository may be linked" });
    }
    if (project.draft) return;
    if (project.technologies.length === 0) {
      context.addIssue({ code: "custom", path: ["technologies"], message: "required to publish" });
    }
    if (!project.category) context.addIssue({ code: "custom", path: ["category"], message: "required to publish" });
    if (!project.status) context.addIssue({ code: "custom", path: ["status"], message: "required to publish" });
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
/** Defaults to local development and protected Vercel Preview deployments. */
  includeDrafts?: boolean;
  locale?: "en" | "de";
}

/** Deployment Protection is configured separately; Vercel previews are checked before release. */
const isVercelPreview = () => process.env.VERCEL_ENV === "preview" && Boolean(process.env.VERCEL_URL);
const draftsAllowed = () => process.env.NODE_ENV !== "production" || isVercelPreview();

export async function getProjects({ includeDrafts = draftsAllowed(), locale = "en" }: ProjectQuery = {}): Promise<Project[]> {
  const projects = locale === "de" ? await loadGermanProjects() : await loadProjects();
  return includeDrafts && draftsAllowed() ? projects : projects.filter((project) => !project.draft);
}

export async function getFeaturedProjects(query: ProjectQuery = {}): Promise<Project[]> {
  return (await getProjects(query)).filter((project) => project.featured);
}

export async function getProjectBySlug(slug: string, query: ProjectQuery = {}): Promise<Project | null> {
  return (await getProjects(query)).find((project) => project.slug === slug) ?? null;
}

const loadGermanProjects = cache(async (): Promise<Project[]> => {
  const files = await readContentFiles(contentDir("projects", "de"));
  return files
    .map((file) => parseProject(file.slug, file.data, file.content))
    .sort((a, b) => a.displayOrder - b.displayOrder || a.title.localeCompare(b.title));
});

/** "2024–Present", "2022–2024", "2023", or `null` without a period. */
export function formatPeriod(period: Project["period"], locale: "en" | "de" = "en"): string | null {
  if (!period) return null;
  if (period.ongoing) return `${period.from}–${locale === "de" ? "heute" : "Present"}`;
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
