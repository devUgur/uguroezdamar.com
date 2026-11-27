import type { ReactNode } from "react";
import { portalUrl } from "@/src/adapters/session";
import { listProjects, listThreads, OfficeSidebar, ThreadList, type Thread, type ThreadProject } from "@/src/features/agents";

/** All conversations of every scope; the office navigation stays on the left. */
export default async function ChatLayout({ children }: { children: ReactNode }) {
  let threads: Thread[] = [];
  let projects: ThreadProject[] = [];
  let unavailable: string | null = null;
  try {
    [threads, projects] = await Promise.all([listThreads(), listProjects()]);
  } catch (error) {
    unavailable = error instanceof Error ? error.message : "Agenten-API nicht erreichbar.";
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden md:flex-row">
      <OfficeSidebar projects={projects} portalUrl={portalUrl()} />
      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[16rem_1fr]">
        <aside className="hidden min-h-0 overflow-y-auto border-r border-border md:block">
          <ThreadList threads={threads} />
        </aside>
        <section className="min-h-0">{unavailable ? <p className="p-8 text-sm text-destructive">{unavailable}</p> : children}</section>
      </div>
    </div>
  );
}
