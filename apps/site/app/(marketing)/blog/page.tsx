import { PostCard } from "@/src/features/blog";
import { getAllPosts } from "@/src/adapters/blog";
import { Container, Section } from "@ugur/ui";

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
