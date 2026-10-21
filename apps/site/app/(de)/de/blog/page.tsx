import type { Metadata } from "next";
import { PageIntro } from "@/src/components/public/PageIntro";
import { getAllPosts } from "@/src/features/blog/queries";
import { PostCard } from "@/src/features/blog";

export const metadata: Metadata = { title: "Beiträge", description: "Beiträge zu Softwarearchitektur und Engineering.", alternates: { canonical: "/de/blog", languages: { en: "/blog", de: "/de/blog" } } };
export default async function GermanBlogPage() {
  const posts = await getAllPosts("de");
  return <div className="site-container py-16 md:py-24">
    <PageIntro section="Texte & Notizen" title="Beiträge zu Engineering" description="Gedanken zu Full-Stack-Architektur, verteilten Systemen, Typsicherheit und produktiver Softwareentwicklung." />
    {posts.length === 0 ? <div className="mt-14 max-w-xl space-y-3 border-y border-border py-8 text-sm text-muted-foreground"><p className="font-serif text-2xl text-foreground">Es wurden noch keine Beiträge veröffentlicht.</p></div> : <div className="mt-12 grid grid-cols-1 gap-x-12 md:grid-cols-2">{posts.map((post) => <PostCard key={post.slug} post={post} locale="de" />)}</div>}
  </div>;
}
