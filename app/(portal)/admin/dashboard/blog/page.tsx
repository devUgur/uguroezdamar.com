import { getAllPosts } from "@/features/blog/server/queries";
import Link from "next/link";

export default async function AdminBlogPage() {
  const posts = await getAllPosts();

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Blog Posts</h1>
          <p className="text-muted-foreground">Manage your portfolio blog content (MDX files).</p>
        </div>
        <button className="px-4 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50" disabled title="Coming soon: MDX Editor">
          New Post
        </button>
      </div>

      <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-4 text-left font-medium">Date</th>
              <th className="p-4 text-left font-medium">Title</th>
              <th className="p-4 text-left font-medium">Slug</th>
              <th className="p-4 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {posts.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-muted-foreground italic">No blog posts found.</td>
              </tr>
            ) : (
              posts.map((post) => (
                <tr key={post.slug} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="p-4 text-xs text-muted-foreground">
                    {post.date || "No date"}
                  </td>
                  <td className="p-4 font-medium">{post.title}</td>
                  <td className="p-4 text-muted-foreground font-mono text-xs">{post.slug}</td>
                  <td className="p-4 text-right">
                    <Link href={`/blog/${post.slug}`} target="_blank" className="text-xs text-blue-500 hover:underline mr-4">
                      View
                    </Link>
                    <button className="text-xs text-muted-foreground cursor-not-allowed" disabled>
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 text-sm text-blue-600">
        Note: Currently, blog posts are managed via MDX files in the <code className="bg-blue-500/10 px-1 rounded">content/blog</code> directory. An online editor is planned for a future update.
      </div>
    </div>
  );
}
