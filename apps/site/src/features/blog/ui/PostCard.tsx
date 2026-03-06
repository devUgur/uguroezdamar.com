import Link from "next/link";

import type { PostRecord } from "@/src/features/blog/types";
import { Card } from "@ugur/ui";

export function PostCard({ post }: { post: PostRecord }) {
  return (
    <Card>
      <h3 className="text-sm font-semibold">
        <Link href={`/blog/${post.slug}`} className="hover:underline">
          {post.title}
        </Link>
      </h3>
      {post.summary ? (
        <p className="mt-1 text-sm text-zinc-600">{post.summary}</p>
      ) : null}
    </Card>
  );
}
