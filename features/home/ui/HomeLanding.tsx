import Link from "next/link";

import { getAllPosts, PostCard } from "@/features/blog";
import { getAllProjects, ProjectCard } from "@/features/projects";
import { Button } from "@/shared/ui/Button";
import { Card } from "@/shared/ui/Card";
import { Container } from "@/shared/ui/Container";
import { Section } from "@/shared/ui/Section";

export async function HomeLanding() {
  const [posts, projects] = await Promise.all([getAllPosts(), getAllProjects()]);

  const latestPosts = posts.slice(0, 2);
  const featuredProjects = projects.slice(0, 2);

  return (
    <Container>
      <Section title="Ugur Özdamar" description="Software engineer portfolio.">
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/projects">Projects</Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/blog">Blog</Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/work">Work</Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/education">Education</Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/contact">Contact</Link>
          </Button>
        </div>
      </Section>

      <Section title="Featured Projects" description="A quick look at recent work.">
        {featuredProjects.length ? (
          <div className="grid gap-4">
            {featuredProjects.map((project) => (
              <ProjectCard key={project.slug} project={project} />
            ))}
          </div>
        ) : (
          <Card>
            <p className="text-sm text-zinc-700">No projects yet.</p>
          </Card>
        )}
        <div className="mt-4">
          <Button variant="secondary" asChild>
            <Link href="/projects">View all projects</Link>
          </Button>
        </div>
      </Section>

      <Section title="Latest Posts" description="Notes and write-ups.">
        {latestPosts.length ? (
          <div className="grid gap-4">
            {latestPosts.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
        ) : (
          <Card>
            <p className="text-sm text-zinc-700">No posts yet.</p>
          </Card>
        )}
        <div className="mt-4">
          <Button variant="secondary" asChild>
            <Link href="/blog">View all posts</Link>
          </Button>
        </div>
      </Section>

      <Section title="Overview" description="Where to find the full details.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <h3 className="text-sm font-semibold">Work</h3>
            <p className="mt-1 text-sm text-zinc-600">
              Experience, roles, and responsibilities.
            </p>
            <div className="mt-3">
              <Button variant="secondary" asChild>
                <Link href="/work">See all work</Link>
              </Button>
            </div>
          </Card>
          <Card>
            <h3 className="text-sm font-semibold">Education</h3>
            <p className="mt-1 text-sm text-zinc-600">
              Courses, degrees, and certifications.
            </p>
            <div className="mt-3">
              <Button variant="secondary" asChild>
                <Link href="/education">See education</Link>
              </Button>
            </div>
          </Card>
        </div>
      </Section>

      <Section title="Contact" description="Want to work together?">
        <Card>
          <p className="text-sm text-zinc-700">
            For inquiries, send me a message.
          </p>
          <div className="mt-3">
            <Button asChild>
              <Link href="/contact">Open contact form</Link>
            </Button>
          </div>
        </Card>
      </Section>
    </Container>
  );
}
