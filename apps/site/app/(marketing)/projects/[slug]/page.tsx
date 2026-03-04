import Image from "next/image";
import { notFound } from "next/navigation";

import { getSiteProjectBySlug, getSiteProjects } from "@/apps/site/src/server/projects";
import { Container, Section } from "@ugur/ui";

export async function generateStaticParams() {
  const projects = await getSiteProjects();
  return projects.map((p) => ({ slug: p.slug }));
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await getSiteProjectBySlug(slug);

  if (!project) return notFound();

  return (
    <Container>
      <Section title={project.title} description={project.summary}>
        {project.images.length ? (
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-3">
            {project.images.map((image) => (
              <div key={`${image.url}-${image.kind ?? "img"}`} className="overflow-hidden rounded-md border bg-muted/20">
                <Image
                  src={image.url}
                  alt={image.alt || project.title}
                  width={1200}
                  height={560}
                  unoptimized
                  className="w-full h-56 object-cover"
                />
              </div>
            ))}
          </div>
        ) : null}

        {project.links.length ? (
          <div className="mb-6 flex flex-wrap gap-3">
            {project.links.map((link) => (
              <a key={`${link.platform}-${link.url}`} href={link.url} target="_blank" rel="noreferrer" className="text-sm underline underline-offset-2">
                {link.label || link.platform}
              </a>
            ))}
          </div>
        ) : null}

        <div className="prose prose-zinc max-w-none">
          <pre className="whitespace-pre-wrap text-sm">{project.content}</pre>
        </div>
      </Section>
    </Container>
  );
}
