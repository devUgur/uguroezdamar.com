import React from "react";

export default function WorkHero({ title = "Projekte", subtitle = "Meine ausgewählten Arbeiten" }: { title?: string; subtitle?: string }) {
  return (
    <header className="mb-8">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="text-muted-foreground mt-2">{subtitle}</p>
    </header>
  );
}
