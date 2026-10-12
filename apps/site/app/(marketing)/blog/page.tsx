import { PostCard } from "@/src/features/blog";
import { getAllPosts } from "@/src/features/blog/queries";
import { Container, Section } from "@ugur/ui";

export default async function BlogPage() {
  const posts = await getAllPosts();

  return (
    <Container>
      <Section title="Blog" description="Writing and notes.">
        <div className="grid gap-4">
          {posts.length === 0 ? (
            <p className="py-8 text-sm text-muted-foreground">No articles have been published yet.</p>
          ) : posts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
      </Section>
    </Container>
  );
}
