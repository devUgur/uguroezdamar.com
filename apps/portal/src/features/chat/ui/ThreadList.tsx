"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@ugur/core";
import { Button } from "@ugur/ui";
import { createThread } from "../actions";
import type { Thread } from "../types";

const WORKING = new Set(["user_message", "thinking", "model_result", "tool_call", "tool_result", "stage_paused", "approval_decided"]);

function state(lastEvent: string | null): { label: string; className: string } | null {
  if (!lastEvent) return null;
  if (lastEvent === "approval_requested") return { label: "wartet auf Freigabe", className: "bg-primary" };
  if (lastEvent === "error" || lastEvent === "budget_blocked") return { label: "Fehler", className: "bg-destructive" };
  if (WORKING.has(lastEvent)) return { label: "arbeitet", className: "bg-primary motion-safe:animate-pulse" };
  return null;
}

/** All open threads, newest first. */
export function ThreadList({ threads }: { threads: Thread[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Chats" className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border p-4">
        <span className="font-serif text-lg">Chats</span>
        <form action={createThread}>
          <Button type="submit" variant="secondary" className="h-8 px-3 text-xs">
            Neuer Chat
          </Button>
        </form>
      </div>
      <ol className="flex-1 overflow-y-auto p-2">
        {threads.length === 0 ? <li className="p-3 text-sm text-muted-foreground">Noch keine Chats.</li> : null}
        {threads.map((thread) => {
          const href = `/chat/${thread.id}`;
          const marker = state(thread.lastEvent);
          return (
            <li key={thread.id}>
              <Link
                href={href}
                aria-current={pathname === href ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent",
                  pathname === href && "bg-accent font-medium",
                )}
              >
                <span className="min-w-0 flex-1 truncate">{thread.title ?? "Neuer Chat"}</span>
                {marker ? <span className={cn("size-2 shrink-0 rounded-full", marker.className)} title={marker.label} /> : null}
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(thread.updatedAt * 1000).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
