import React from "react";
import type { WorkItem } from "../types";
import WorkItemCard from "./WorkItemCard";
import Link from "next/link";

export default function WorkGrid({ items }: { items: WorkItem[] }) {
  return (
    <section>
      {items.length === 0 ? (
        <div className="py-8 text-sm text-muted-foreground">
          <p>No selected projects have been published yet.</p>
          <Link href="/projects" className="mt-2 inline-block underline underline-offset-4">Browse all projects</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <WorkItemCard key={it.id} item={it} />
          ))}
        </div>
      )}
    </section>
  );
}
