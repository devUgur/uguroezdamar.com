import Image from "next/image";
import { notFound } from "next/navigation";

import { getSiteProjectBySlug, getSiteProjects } from "@/src/features/projects/queries";
import { Container, Section } from "@ugur/ui";

export async function generateStaticParams() {
  try {
    const projects = await getSiteProjects();
    if (projects.length > 0) {
      return projects.map((p) => ({ slug: p.slug }));
    }
  } catch (error) {
    console.error("Failed to generate static params for projects:", error);
  }

  // Fallback to avoid build error in Next.js 16 if no projects found
  return [{ slug: "__placeholder__" }];
}

export const dynamicParams = false;

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
      <Section title={project.title} description={project.summary || undefined}>
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
