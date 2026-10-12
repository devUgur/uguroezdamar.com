import { ProjectGrid } from "@/src/features/projects";
import { getSiteProjects } from "@/src/features/projects/queries";
import { Container } from "@ugur/ui";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await getSiteProjects();

  return (
    <Container>
      <ProjectGrid projects={projects} />
    </Container>
  );
}
