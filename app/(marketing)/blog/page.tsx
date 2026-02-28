import { getAllPosts, PostCard } from "@/features/blog";
import { Container } from "@/shared/ui/Container";
import { Section } from "@/shared/ui/Section";

export default async function BlogPage() {
  const posts = await getAllPosts();

  return (
    <Container>
      <Section title="Blog" description="Writing and notes.">
        <div className="grid gap-4">
          {posts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
      </Section>
    </Container>
  );
}
