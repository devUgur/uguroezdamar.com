import React from "react";
import type { WorkItem } from "../types";

export default function WorkItemCard({ item }: { item: WorkItem }) {
  return (
    <article className="border rounded-md p-4">
      <a href={`/work/${item.slug}`} className="block">
        <h3 className="text-lg font-semibold">{item.title}</h3>
        {item.summary ? <p className="text-sm text-muted-foreground">{item.summary}</p> : null}
      </a>
      <div className="mt-2 text-xs text-muted-foreground">{item.tags?.join(", ")}</div>
    </article>
  );
}
