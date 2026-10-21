import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { compileMdx } from "@/src/content/mdx";
import { ArticleShell } from "@/src/components/public/ArticleShell";
import { formatPeriod, getProjectBySlug, getProjects, projectLinks } from "@/src/content/projects";

type Params = { params: Promise<{ slug: string }> };
const statusLabels = { active: "In Entwicklung", completed: "Abgeschlossen", archived: "Archiviert" } as const;
export const dynamicParams = false;
export async function generateStaticParams() {
  const projects = await getProjects({ locale: "de" });
  return projects.length ? projects.map(({ slug }) => ({ slug })) : [{ slug: "__none__" }];
}
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const project = await getProjectBySlug((await params).slug, { locale: "de" });
  if (!project) return {};
  return {
    title: project.title, description: project.summary,
    alternates: { canonical: `/de/projects/${project.slug}`, languages: { en: `/projects/${project.slug}`, de: `/de/projects/${project.slug}` } },
    robots: project.draft ? { index: false, follow: false } : undefined,
    openGraph: { title: project.title, description: project.summary, images: project.cover ? [project.cover.src] : undefined },
  };
}
export default async function GermanProjectDetail({ params }: Params) {
  const project = await getProjectBySlug((await params).slug, { locale: "de" });
  if (!project) return notFound();
  const body = await compileMdx(project.body);
  const links = projectLinks(project);
  const facts = [
    { label: "Rolle", value: project.role },
    { label: "Zeitraum", value: formatPeriod(project.period, "de") },
    { label: "Status", value: project.status ? statusLabels[project.status] : undefined },
  ].filter((fact): fact is { label: string; value: string } => Boolean(fact.value));
  return (
    <article className="site-container py-16 md:py-24">
      <header className="page-intro">
        <p className="page-eyebrow"><Link href="/de/projects" className="link-underline">Projekte</Link><span className="mx-2 text-border">/</span>{project.category}{project.draft ? <span className="ml-3 rounded-xs border border-foreground/30 px-2 py-0.5 text-foreground">Entwurf</span> : null}</p>
        <h1 className="page-title">{project.title}</h1><p className="page-lede">{project.summary}</p>
      </header>
      {project.cover ? <figure className="mt-10 md:mt-14"><div className="relative aspect-video overflow-hidden border-y border-border bg-surface"><Image src={project.cover.src} alt={project.cover.alt} fill priority sizes="(max-width: 1280px) 100vw, 1200px" className="object-cover" /></div>{project.cover.caption ? <figcaption className="mt-2 text-xs leading-5 text-muted-foreground">{project.cover.caption}</figcaption> : null}</figure> : null}
      <div className="mt-12 grid grid-cols-1 gap-12 md:mt-16 md:grid-cols-12 md:gap-8">
        <aside className="md:col-span-4" aria-label="Projektdetails"><dl className="border-t border-border">{facts.map((fact) => <div key={fact.label} className="grid grid-cols-[6rem_minmax(0,1fr)] gap-4 border-b border-border py-4"><dt className="font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground">{fact.label}</dt><dd className="text-sm leading-6">{fact.value}</dd></div>)}</dl>
          <h2 className="mt-8 font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground">Technologien</h2><ul className="mt-3 flex flex-wrap gap-1.5">{project.technologies.map((technology) => <li key={technology} className="rounded-xs border border-border/60 bg-surface/80 px-2 py-0.5 font-mono text-[11px] text-foreground/80">{technology}</li>)}</ul>
          {links.length ? <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2">{links.map((link) => <li key={link.url}><a href={link.url} target="_blank" rel="noreferrer" className="link-underline inline-flex min-h-11 items-center gap-2 font-mono text-xs uppercase tracking-[0.13em]">{link.label} <span aria-hidden="true">↗</span></a></li>)}</ul> : null}
        </aside>
        <div className="md:col-span-7 md:col-start-6">{project.contributions.length ? <section aria-labelledby="contributions-heading" className="mb-12"><h2 id="contributions-heading" className="font-serif text-2xl md:text-3xl">Mein Beitrag</h2><ul className="mt-5 list-disc space-y-2 pl-5 text-base leading-7 text-muted-foreground">{project.contributions.map((item) => <li key={item}>{item}</li>)}</ul></section> : null}<ArticleShell>{body}</ArticleShell></div>
      </div>
    </article>
  );
}
