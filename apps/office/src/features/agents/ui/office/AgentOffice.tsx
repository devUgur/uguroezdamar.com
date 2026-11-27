"use client";

import { useState, type ReactNode } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { cn } from "@ugur/core";
import type { AgentSummary, OfficeSnapshot, ThreadProject } from "../../types";
import { AgentChatDialog } from "./AgentChatDialog";
import { AgentConfigSheet } from "./AgentConfigSheet";
import { OfficeStage } from "./OfficeStage";
import { useOfficeLive } from "./useOfficeLive";

interface AgentOfficeProps {
  agents: AgentSummary[];
  liveOrigin: string | null;
  initialPresence: OfficeSnapshot | null;
  initialPresenceError: string | null;
  projects: ThreadProject[];
  /** Left navigation, rendered on the server. */
  sidebar: ReactNode;
  /** The widgets of the current scope: the route's page, the only part that changes with the scope. */
  children: ReactNode;
}

/**
 * The office shell. It lives in the office layout, so switching the scope (/ ↔ /projects/:id) keeps this component,
 * the live connection and the 3D scene mounted; only the widgets next to it are loaded again.
 */
export function AgentOffice({ agents, liveOrigin, initialPresence, initialPresenceError, projects, sidebar, children }: AgentOfficeProps) {
  const params = useParams<{ projectId?: string }>();
  const searchParams = useSearchParams();
  const scope = typeof params.projectId === "string" ? decodeURIComponent(params.projectId) : null;
  const project = projects.find((entry) => entry.id === scope) ?? null;
  const { states, connected, presence, presenceError, serverOffsetMs } = useOfficeLive(agents, liveOrigin, initialPresence, initialPresenceError);
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const requested = searchParams.get("agent");
    return agents.some((agent) => agent.id === requested) ? requested : null;
  });
  const [chat, setChat] = useState<{ agent: AgentSummary; fresh: boolean } | null>(null);
  const selected = agents.find((agent) => agent.id === selectedId) ?? null;

  return (
    <div className="flex h-dvh flex-col overflow-hidden md:flex-row">
      {sidebar}

      <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-4 lg:flex-row lg:overflow-hidden lg:p-6">
        <section aria-label="Büro" className="flex min-h-[28rem] min-w-0 flex-1 flex-col gap-3 lg:min-h-0">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="flex flex-col gap-0.5">
              <h1 className="font-serif text-2xl">{project?.name ?? "Firma"}</h1>
              <p className="text-xs text-muted-foreground">
                {project ? "Chats arbeiten in diesem Projekt und seinem Repository." : "Firmenebene: Chats ohne Repository. Für Code ein Projekt links wählen."}
              </p>
            </div>
            <span role="status" aria-live="polite" className={cn("max-w-md text-right text-xs", presenceError ? "text-destructive" : "text-muted-foreground")}>
              {!liveOrigin
                ? "API nicht konfiguriert · lokale Vorschau"
                : presence
                  ? connected
                    ? "synchronisiert"
                    : "Snapshot geladen · Live-Verbindung getrennt"
                  : presenceError
                    ? `${presenceError} Lokale Vorschau aktiv.`
                    : "verbindet … · lokale Vorschau aktiv"}
            </span>
          </div>

          {agents.length ? (
            <div className="min-h-0 flex-1">
              <OfficeStage agents={agents} states={states} presence={presence} serverOffsetMs={serverOffsetMs} selectedId={selectedId} onSelect={setSelectedId} fill />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Noch keine Agenten konfiguriert.</p>
          )}
        </section>

        <aside aria-label="Überblick" className="shrink-0 lg:w-80 lg:overflow-y-auto">
          {children}
        </aside>
      </main>

      <AgentConfigSheet
        agent={selected}
        state={selected ? states[selected.id] : undefined}
        onClose={() => setSelectedId(null)}
        onChat={(agent, fresh) => {
          setSelectedId(null);
          setChat({ agent, fresh });
        }}
      />
      <AgentChatDialog agent={chat?.agent ?? null} fresh={chat?.fresh ?? false} projectId={scope} onClose={() => setChat(null)} />
    </div>
  );
}
