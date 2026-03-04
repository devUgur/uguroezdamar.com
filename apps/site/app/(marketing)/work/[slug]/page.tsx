import React from "react";
import { getSiteWorkItemBySlug } from "@/src/server/work";
import { Container } from "@ugur/ui";
import { notFound } from "next/navigation";

export default async function WorkDetailPage({ params }: { params: { slug: string } }) {
  const item = await getSiteWorkItemBySlug(params.slug);
  if (!item) return notFound();

  return (
    <Container>
      <h1 className="text-3xl font-bold">{item.title}</h1>
      {item.summary ? <p className="text-muted-foreground mt-2">{item.summary}</p> : null}
      <div className="prose mt-6">
        {/* If content is MDX source, we can render it later with Mdx renderer. For now show raw. */}
        <pre>{item.content ?? ""}</pre>
      </div>
    </Container>
  );
}
