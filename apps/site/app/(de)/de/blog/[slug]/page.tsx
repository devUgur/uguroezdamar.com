import { notFound } from "next/navigation";
import { MdxContent } from "@/src/features/blog";
import { getAllPosts, getPostBySlug } from "@/src/features/blog/queries";
import { PageIntro } from "@/src/components/public/PageIntro";
import { ArticleShell } from "@/src/components/public/ArticleShell";
import type { Metadata } from "next";

type Params = { params: Promise<{ slug: string }> };
export const dynamicParams = false;
export async function generateStaticParams() { const posts = await getAllPosts("de"); return posts.length ? posts.map(({ slug }) => ({ slug })) : [{ slug: "__none__" }]; }
export async function generateMetadata({ params }: Params): Promise<Metadata> { const slug = (await params).slug; const [post, englishPost] = await Promise.all([getPostBySlug(slug, "de"), getPostBySlug(slug, "en")]); return post ? { title: post.title, description: post.summary, alternates: { canonical: `/de/blog/${post.slug}`, languages: { de: `/de/blog/${post.slug}`, ...(englishPost ? { en: `/blog/${post.slug}` } : {}) } } } : {}; }
export default async function GermanBlogPost({ params }: Params) { const post = await getPostBySlug((await params).slug, "de"); if (!post) return notFound(); return <article className="site-container py-16 md:py-24"><PageIntro section={post.date ?? "Beitrag"} title={post.title} description={post.summary} backHref="/de/blog" backLabel="Texte" /><div className="mt-12 md:mt-16 md:grid md:grid-cols-12"><div className="md:col-span-8 md:col-start-5"><ArticleShell><MdxContent source={post.source} /></ArticleShell></div></div></article>; }
