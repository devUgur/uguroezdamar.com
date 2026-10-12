import { PostCard } from "@/src/features/blog";
import { getAllPosts } from "@/src/features/blog/queries";

export default async function BlogPage() {
  const posts = await getAllPosts();

  return (
    <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12 py-16 md:py-24">
      <div className="max-w-3xl mb-12 md:mb-16">
        <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">
          Writing & Notes
        </div>
        <h1 className="font-serif text-[clamp(2.5rem,5vw+0.5rem,4rem)] leading-tight tracking-tight text-foreground mb-4">
          Engineering Articles
        </h1>
        <p className="font-sans text-base md:text-lg leading-relaxed text-muted-foreground">
          Thoughts on full-stack architecture, distributed systems, type safety, and real-world production engineering.
        </p>
      </div>

      {posts.length === 0 ? (
        <div className="rounded-lg border border-border/80 bg-surface/30 p-12 text-center max-w-xl mx-auto space-y-3 font-mono text-xs text-muted-foreground">
          <p className="font-serif text-xl text-foreground">No articles published yet.</p>
          <p>Technical writeups, architecture breakdowns, and post-mortems will be published here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {posts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
