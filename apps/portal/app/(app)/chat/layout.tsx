import type { ReactNode } from "react";
import { listThreads, ThreadList, type Thread } from "@/src/features/agents";

export default async function ChatLayout({ children }: { children: ReactNode }) {
  let threads: Thread[] = [];
  let unavailable: string | null = null;
  try {
    threads = await listThreads();
  } catch (error) {
    unavailable = error instanceof Error ? error.message : "Agenten-API nicht erreichbar.";
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-1 md:grid-cols-[16rem_1fr]">
      <aside className="hidden min-h-0 border-r border-border bg-card md:block">
        <ThreadList threads={threads} />
      </aside>
      <section className="min-h-0">
        {unavailable ? <p className="p-8 text-sm text-destructive">{unavailable}</p> : children}
      </section>
    </div>
  );
}
