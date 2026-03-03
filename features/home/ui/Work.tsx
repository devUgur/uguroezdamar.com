import Link from "next/link";
import { getAllProjects } from "@/features/projects/server/queries";

export async function Work() {
  const projects = await getAllProjects();

  return (
    <section id="work" className="py-24 md:py-32 lg:py-40 px-6 md:px-12 lg:px-24 hairline-t">
      <div className="mb-16 md:mb-24">
        <h2 className="font-mono text-sm uppercase tracking-widest text-muted-foreground">02 — Selected Work</h2>
      </div>

      <div className="border-t border-border/40">
        {projects.length === 0 ? (
          <div className="py-12 text-sm text-muted-foreground">Selected Work is currently in progress. Coming soon.</div>
        ) : (
          projects.map((project) => (
            <article key={project.slug} className="group grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 py-10 border-b border-border/40">
              <div className="md:col-span-8">
                <h3 className="font-serif text-3xl md:text-4xl mb-3 group-hover:text-accent transition-colors duration-300">
                  <Link href={`/projects/${project.slug}`}>{project.title}</Link>
                </h3>
                {project.summary ? (
                  <p className="text-secondary-foreground text-sm md:text-base leading-relaxed max-w-2xl">{project.summary}</p>
                ) : null}
              </div>

              <div className="md:col-span-4 flex md:justify-end md:items-start">
                <div className="flex flex-wrap gap-2 md:justify-end">
                  {project.tags.map((tag) => (
                    <span key={tag} className="font-mono text-[10px] uppercase tracking-wider px-2 py-1 border border-border rounded-sm text-muted-foreground">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

export default Work;
