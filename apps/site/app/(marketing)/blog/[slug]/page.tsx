import { notFound } from "next/navigation";

import { MdxContent } from "@/src/features/blog";
import { getAllPosts, getPostBySlug } from "@/src/features/blog/queries";
import { Container, Section } from "@ugur/ui";

export async function generateStaticParams() {
  try {
    const posts = await getAllPosts();
    if (posts.length > 0) {
      return posts.map((p) => ({ slug: p.slug }));
    }
  } catch (error) {
    console.error("Failed to generate static params for blog:", error);
  }

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
    <Container>
      <Section title={post.title} description={post.summary}>
        <MdxContent source={post.source} />
      </Section>
    </Container>
  );
}
