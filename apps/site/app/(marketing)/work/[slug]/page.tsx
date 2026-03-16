import { Container } from "@ugur/ui";
import { notFound } from "next/navigation";
import { getSiteWorkItemBySlug, getSiteWorkItems } from "@/src/features/selected-work/queries";

export async function generateStaticParams() {
  try {
    const items = await getSiteWorkItems();
    if (items.length > 0) {
      return items.map((p) => ({ slug: p.slug }));
    }
  } catch (error) {
    console.error("Failed to generate static params for work:", error);
  }

  // Fallback to avoid build error in Next.js 16 if no items found
  return [{ slug: "__placeholder__" }];
}

export const dynamicParams = false;

export default async function WorkDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = await getSiteWorkItemBySlug(slug);
  if (!item) return notFound();

  return (
    <Container>
      <h1 className="text-3xl font-bold">{item.title}</h1>
      {item.summary ? <p className="text-muted-foreground mt-2">{item.summary}</p> : null}
      <div className="prose mt-6">
        <pre>{item.content ?? ""}</pre>
      </div>
    </Container>
  );
}
