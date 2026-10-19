import Link from "next/link";

import type { PostRecord } from "@/src/features/blog/types";
import { ArrowUpRight } from "lucide-react";

export function PostCard({ post }: { post: PostRecord }) {
  return (
    <article className="border-t border-border py-6 md:py-8">
      {post.date ? <p className="page-eyebrow mb-3">{post.date}</p> : null}
      <h2 className="font-serif text-2xl leading-tight md:text-3xl">
        <Link href={`/blog/${post.slug}`} className="hover:underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
          {post.title}
        </Link>
      </h2>
      {post.summary ? (
        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">{post.summary}</p>
      ) : null}
      <Link href={`/blog/${post.slug}`} className="link-underline mt-4 inline-flex min-h-11 items-center gap-2 font-mono text-xs uppercase tracking-wider">Read article <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>
    </article>
  );
}
