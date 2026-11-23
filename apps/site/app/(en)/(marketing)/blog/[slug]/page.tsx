import { notFound } from "next/navigation";

import { MdxContent } from "@/src/features/blog";
import { getAllPosts, getPostBySlug } from "@/src/features/blog/queries";
import { PageIntro } from "@/src/components/public/PageIntro";
import { ArticleShell } from "@/src/components/public/ArticleShell";
import type { Metadata } from "next";

type BlogParams = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: BlogParams): Promise<Metadata> {
  const slug = (await params).slug;
  const [post, germanPost] = await Promise.all([getPostBySlug(slug), getPostBySlug(slug, "de")]);
  if (!post) return {};
  return {
    title: post.title,
    description: post.summary,
    alternates: { canonical: `/blog/${post.slug}`, languages: { en: `/blog/${post.slug}`, ...(germanPost ? { de: `/de/blog/${post.slug}` } : {}) } },
  };
}

export async function generateStaticParams() {
  const posts = await getAllPosts();
  if (posts.length > 0) return posts.map((p) => ({ slug: p.slug }));

  // Fallback to avoid build error in Next.js 16 if no posts found
  return [{ slug: "__placeholder__" }];
}

export const dynamicParams = false;

export default async function BlogDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) return notFound();

  return (
    <article className="site-container py-16 md:py-24">
      <PageIntro section={post.date ?? "Article"} title={post.title} description={post.summary} backHref="/blog" backLabel="Writing" />
      <div className="mt-12 md:mt-16 md:grid md:grid-cols-12">
        <div className="md:col-span-8 md:col-start-5"><ArticleShell><MdxContent source={post.source} /></ArticleShell></div>
      </div>
    </article>
  );
}
