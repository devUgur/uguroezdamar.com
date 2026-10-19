import { PostCard } from "@/src/features/blog";
import { getAllPosts } from "@/src/features/blog/queries";
import { PageIntro } from "@/src/components/public/PageIntro";

export default async function BlogPage() {
  const posts = await getAllPosts();

  return (
    <div className="site-container py-16 md:py-24">
      <PageIntro section="Writing & notes" title="Engineering articles" description="Thoughts on full-stack architecture, distributed systems, type safety, and real-world production engineering." />

      {posts.length === 0 ? (
        <div className="mt-14 max-w-xl border-y border-border py-8 space-y-3 text-sm text-muted-foreground">
          <p className="font-serif text-2xl text-foreground">No articles published yet.</p>
        </div>
      ) : (
        <div className="mt-12 grid grid-cols-1 gap-x-12 md:grid-cols-2">
          {posts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
