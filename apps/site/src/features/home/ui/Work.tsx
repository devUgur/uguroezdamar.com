import Link from "next/link";
import { getSiteWorkItems } from "@/src/features/selected-work/queries";
import { SelectedProjectCard } from "./SelectedProjectCard";

export async function Work() {
  const projects = (await getSiteWorkItems()).slice(0, 3);

  return (
    <section id="work" aria-labelledby="selected-work-heading" className="site-section">
      <div className="site-container">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-12 md:gap-8">
          <div className="md:col-span-4">
            <p className="mb-5 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground md:text-sm">
              02 <span className="mx-2 text-border">/</span> Selected work
            </p>
            <h2 id="selected-work-heading" className="max-w-sm text-3xl leading-tight md:text-4xl">
              Published projects, selected from the portfolio.
            </h2>
            <Link href="/projects" className="link-underline mt-7 inline-flex min-h-11 items-center gap-3 font-mono text-xs uppercase tracking-[0.13em] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
              Browse all projects <span aria-hidden="true">↗</span>
            </Link>
          </div>

          <div className="md:col-span-7 md:col-start-6">
            {projects.length === 0 ? (
              <div className="border-y border-border py-8 md:py-10">
                <p className="text-lg">No featured projects have been published yet.</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Published project entries will appear here when available.
                </p>
                <Link href="/projects" className="link-underline mt-5 inline-flex min-h-11 items-center font-mono text-xs uppercase tracking-[0.13em] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
                  View published projects <span className="ml-3" aria-hidden="true">↗</span>
                </Link>
              </div>
            ) : (
              <ol className="border-t border-border">
                {projects.map((project, index) => (
                  <SelectedProjectCard key={project.slug} project={project} index={index} />
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
