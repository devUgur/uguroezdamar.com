import React from "react";
import type { WorkItem } from "../types";

export default function WorkItemCard({ item }: { item: WorkItem }) {
  return (
    <article className="border rounded-xl overflow-hidden group hover:shadow-md transition-shadow bg-card">
      <a href={`/work/${item.slug}`} className="block">
        {item.previewImageUrl || item.coverImageUrl ? (
          <div className="aspect-video relative overflow-hidden bg-muted">
            <img 
              src={item.previewImageUrl || item.coverImageUrl || ""} 
              alt={item.title}
              className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
            />
          </div>
        ) : (
          <div className="aspect-video bg-muted flex items-center justify-center text-muted-foreground/20">
            <span className="text-4xl font-bold">Project</span>
          </div>
        )}
        <div className="p-4 space-y-2">
          <h3 className="text-lg font-semibold tracking-tight">{item.title}</h3>
          {item.summary ? <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{item.summary}</p> : null}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {item.tags?.slice(0, 3).map(tag => (
               <span key={tag} className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-muted rounded text-muted-foreground">
                 {tag}
               </span>
            ))}
          </div>
        </div>
      </a>
    </article>
  );
}
