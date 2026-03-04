import React from "react";
import type { WorkItem } from "../types";
import WorkItemCard from "./WorkItemCard";

export default function WorkGrid({ items }: { items: WorkItem[] }) {
  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {items.map((it) => (
        <WorkItemCard key={it.id} item={it} />
      ))}
    </section>
  );
}
