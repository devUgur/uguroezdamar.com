import { Container } from "@ugur/ui";
import { notFound } from "next/navigation";
import { getSiteWorkSlugs, getSiteWorkItemBySlug } from "@/src/adapters/work";

export async function generateStaticParams() {
  return getSiteWorkSlugs();
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
