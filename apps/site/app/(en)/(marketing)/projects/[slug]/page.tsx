import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { compileMdx } from "@/src/content/mdx";
import { ArticleShell } from "@/src/components/public/ArticleShell";
import { ProjectCover } from "@/src/components/public/ProjectCover";
import { formatPeriod, getProjectBySlug, getProjects, projectLinks } from "@/src/content/projects";

type Params = { params: Promise<{ slug: string }> };

const STATUS_LABELS = { active: "In development", completed: "Completed", archived: "Archived" } as const;

// Every case study is a file in the repository: all pages are known at build time.
export const dynamicParams = false;

export async function generateStaticParams() {
  const projects = await getProjects();
  // Next.js rejects an empty list together with `dynamicParams = false`.
  return projects.length > 0 ? projects.map(({ slug }) => ({ slug })) : [{ slug: "__none__" }];
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const slug = (await params).slug;
  const [project, germanProject] = await Promise.all([
    getProjectBySlug(slug),
    getProjectBySlug(slug, { locale: "de" }),
  ]);
  if (!project) return {};
  return {
    title: project.title,
    description: project.summary,
    alternates: { canonical: `/projects/${project.slug}`, languages: { en: `/projects/${project.slug}`, ...(germanProject ? { de: `/de/projects/${project.slug}` } : {}) } },
    // Drafts may appear in protected previews, but never belong in search indexes.
    robots: project.draft ? { index: false, follow: false } : undefined,
    openGraph: { title: project.title, description: project.summary, images: project.cover ? [project.cover.src] : undefined },
    twitter: { card: "summary_large_image",  title: project.title, description: project.summary, images: project.cover ? [project.cover.src] : undefined  },
  };
}

export default async function ProjectDetailPage({ params }: Params) {
  const project = await getProjectBySlug((await params).slug);
  if (!project) return notFound();

  const body = await compileMdx(project.body);
  const links = projectLinks(project);
  const facts = [
    { label: "Role", value: project.role },
    { label: "Period", value: formatPeriod(project.period) },
    { label: "Status", value: project.status ? STATUS_LABELS[project.status] : undefined },
  ].filter((fact): fact is { label: string; value: string } => Boolean(fact.value));

  return (
    <article className="site-container py-16 md:py-24">
      <header className="page-intro">
        <p className="page-eyebrow page-intro__eyebrow">
          <Link href="/projects" className="link-underline">Projects</Link>
          <span className="mx-2 text-border">/</span>
          {project.category ? project.category : null}
          {project.draft ? <span className="ml-3 border border-foreground/30 px-2 py-0.5 text-foreground">Draft</span> : null}
        </p>
        <div className="page-intro__content">
          <h1 className="page-title">{project.title}</h1>
          <p className="page-lede">{project.summary}</p>
        </div>
      </header>

      {project.cover ? (
        <figure className="mt-10 md:mt-14">
          <ProjectCover cover={project.cover} preload sizes="(max-width: 1280px) 100vw, 1200px" />
          {project.cover.caption ? <figcaption className="mt-2 text-xs leading-5 text-muted-foreground">{project.cover.caption}</figcaption> : null}
        </figure>
      ) : null}

      <div className="mt-12 grid grid-cols-1 gap-12 md:mt-16 md:grid-cols-12 md:gap-8">
        <aside className="md:col-span-4" aria-label="Project facts">
          <dl className="border-t border-border">
            {facts.map((fact) => (
                <div key={fact.label} className="grid grid-cols-[6rem_minmax(0,1fr)] gap-4 border-b border-border py-4">
                <dt className="font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground">{fact.label}</dt>
                <dd className="text-sm leading-6">{fact.value}</dd>
              </div>
            ))}
          </dl>

          <h2 className="mt-8 font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground">Technologies</h2>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {project.technologies.map((technology) => (
              <li key={technology} className="border border-border bg-surface px-2 py-1 font-mono text-[11px] text-foreground/80">
                {technology}
              </li>
            ))}
          </ul>

          {links.length > 0 ? (
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
              {links.map((link) => (
                <li key={link.url}>
                  <a href={link.url} target="_blank" rel="noreferrer" className="link-underline inline-flex min-h-11 items-center gap-2 font-mono text-xs uppercase tracking-[0.13em]">
                    {link.label} <span aria-hidden="true">↗</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </aside>

        <div className="md:col-span-7 md:col-start-6">
          {project.contributions.length > 0 ? (
            <section aria-labelledby="contributions-heading" className="mb-12">
              <h2 id="contributions-heading" className="font-serif text-2xl md:text-3xl">What I did</h2>
              <ul className="mt-5 list-disc space-y-2 pl-5 text-base leading-7 text-muted-foreground">
                {project.contributions.map((contribution) => <li key={contribution}>{contribution}</li>)}
              </ul>
            </section>
          ) : null}
          <ArticleShell>{body}</ArticleShell>
        </div>
      </div>
    </article>
  );
}
