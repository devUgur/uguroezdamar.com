import type { ReactNode } from "react";

export function ArticleShell({ children }: { children: ReactNode }) {
  return <div className="article-prose">{children}</div>;
}
