import { notFound } from "next/navigation";

import { MdxContent } from "@/src/features/blog";
import { getAllPosts, getPostBySlug } from "@/src/adapters/blog";
import { Container, Section } from "@ugur/ui";

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

export default async function BlogDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) return notFound();

  return (
    <Container>
      <Section title={post.title} description={post.summary}>
        <MdxContent source={post.source} />
      </Section>
    </Container>
  );
}
