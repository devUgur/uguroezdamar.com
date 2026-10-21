import Link from "next/link";
import { getFeaturedProjects } from "@/src/content/projects";
import { SelectedProjectCard } from "./SelectedProjectCard";
import { type Locale } from "@/src/features/navigation/copy";

export async function Work({ number, locale = "en" }: { number: string; locale?: Locale }) {
  const projects = (await getFeaturedProjects({ locale })).slice(0, 3);
  const firstCoverIndex = projects.findIndex((project) => project.cover);

  const de = locale === "de";
  return (
    <section id="work" aria-labelledby="selected-work-heading" className="site-section">
      <div className="site-container">
        <div>
          <div className="max-w-3xl">
            <p className="mb-5 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground md:text-sm">
              {number} <span className="mx-2 text-border">/</span> {de ? "Ausgewählte Projekte" : "Selected work"}
            </p>
            <h2 id="selected-work-heading" className="max-w-sm text-3xl leading-tight md:text-4xl">
              {de ? "Aus Ideen werden funktionierende Produkte." : "Engineering ideas into working products."}
            </h2>
            <Link href={de ? "/de/projects" : "/projects"} className="link-underline mt-7 inline-flex min-h-11 items-center gap-3 font-mono text-xs uppercase tracking-[0.13em] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
              {de ? "Alle Projekte ansehen" : "Browse all projects"} <span aria-hidden="true">↗</span>
            </Link>
          </div>

          <div className="mt-10">
            {projects.length === 0 ? (
              <div className="border-y border-border py-8 md:py-10">
                <p className="text-lg">{de ? "Es wurden noch keine Projekte hervorgehoben." : "No featured projects have been published yet."}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {de ? "Veröffentlichte Projekte erscheinen an dieser Stelle." : "Published project entries will appear here when available."}
                </p>
                <Link href={de ? "/de/projects" : "/projects"} className="link-underline mt-5 inline-flex min-h-11 items-center font-mono text-xs uppercase tracking-[0.13em] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
                  {de ? "Veröffentlichte Projekte ansehen" : "View published projects"} <span className="ml-3" aria-hidden="true">↗</span>
                </Link>
              </div>
            ) : (
              <ol className="grid grid-cols-1 border-t border-border xl:grid-cols-2 xl:gap-x-12">
                {projects.map((project, index) => (
                  <SelectedProjectCard key={project.slug} project={project} index={index} preloadCover={index === firstCoverIndex} locale={locale} />
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default Work;
