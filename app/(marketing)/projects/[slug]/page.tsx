import { notFound } from "next/navigation";

import { getAllProjects, getProjectBySlug } from "@/features/projects";
import { Container } from "@/shared/ui/Container";
import { Section } from "@/shared/ui/Section";

export async function generateStaticParams() {
  const projects = await getAllProjects();
  return projects.map((p) => ({ slug: p.slug }));
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);

  if (!project) return notFound();

  return (
    <Container>
      <Section title={project.title} description={project.summary}>
        <div className="prose prose-zinc max-w-none">
          <pre className="whitespace-pre-wrap text-sm">{project.content}</pre>
        </div>
      </Section>
    </Container>
  );
}
