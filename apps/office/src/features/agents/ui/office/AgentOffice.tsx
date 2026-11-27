"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@ugur/core";
import { refreshOfficeBoard } from "../../actions";
import type { AgentEvent, AgentSummary, OfficeBoard, OfficeRoom } from "../../types";
import { BoardDialog } from "../board/BoardDialog";
import { countByStatus, tasksInScope } from "../board/board";
import { AgentChatDialog } from "./AgentChatDialog";
import { AgentConfigSheet } from "./AgentConfigSheet";
import { OfficeOverview } from "./OfficeOverview";
import { OfficeSidebar } from "./OfficeSidebar";
import { OfficeStage } from "./OfficeStage";
import { useOfficeLive } from "./useOfficeLive";
import { useOfficeScope } from "./useOfficeScope";
import { PortalUrlProvider } from "../portal";

interface AgentOfficeProps {
  room: OfficeRoom;
  initialBoard: OfficeBoard;
  liveOrigin: string | null;
  portalUrl: string;
}

/** Live events after which the board data is stale. */
const WORK_EVENT = /^(task_|approval_|message$|stopped$|error$)/;

/**
 * The office: scope menu, 3D room with the wall board, overview and the agent sheets. Room and board data are loaded
 * once; the scope (?project=) filters them in the browser, so a switch never reloads the page or the 3D scene. Live
 * work events refresh the board data in the background.
 */
export function AgentOffice({ room, initialBoard, liveOrigin, portalUrl }: AgentOfficeProps) {
  const { agents, projects } = room;
  const [scope, setScope] = useOfficeScope(projects);
  const project = projects.find((entry) => entry.id === scope) ?? null;
  const title = project?.name ?? "Firma";

  const [board, setBoard] = useState(initialBoard);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reloadBoard = useCallback(() => {
    refreshOfficeBoard().then(setBoard, (error: unknown) => console.error("office board refresh failed", error));
  }, []);
  const scheduleRefresh = useCallback(
    (event: AgentEvent) => {
      if (!WORK_EVENT.test(event.type)) return;
      clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(reloadBoard, 1_200);
    },
    [reloadBoard],
  );
  useEffect(() => () => clearTimeout(refreshTimer.current), []);

  const { states, connected, presence, presenceError, serverOffsetMs } = useOfficeLive(agents, liveOrigin, room.presence, room.presenceError, scheduleRefresh);
  const scopedTasks = useMemo(() => tasksInScope(board.tasks, scope), [board.tasks, scope]);
  const counts = useMemo(() => countByStatus(scopedTasks), [scopedTasks]);
  const [boardOpen, setBoardOpen] = useState(false);
  const openBoard = useCallback(() => setBoardOpen(true), []);

  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const requested = searchParams.get("agent");
    return agents.some((agent) => agent.id === requested) ? requested : null;
  });
  const [chat, setChat] = useState<{ agent: AgentSummary; fresh: boolean } | null>(null);
  const selected = agents.find((agent) => agent.id === selectedId) ?? null;

  return (
    <PortalUrlProvider value={portalUrl}>
    <div className="flex h-dvh flex-col overflow-hidden md:flex-row">
      <OfficeSidebar projects={projects} portalUrl={portalUrl} scope={scope} onScopeChange={setScope} />

      <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-4 lg:flex-row lg:overflow-hidden lg:p-6">
        <section aria-label="Büro" className="flex min-h-[28rem] min-w-0 flex-1 flex-col gap-3 lg:min-h-0">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="flex flex-col gap-0.5">
              <h1 className="font-serif text-2xl">{title}</h1>
              <p className="text-xs text-muted-foreground">
                {project ? "Chats arbeiten in diesem Projekt und seinem Repository." : "Firmenebene: Chats ohne Repository. Für Code oben ein Projekt wählen."}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span role="status" aria-live="polite" className={cn("max-w-md text-right text-xs", presenceError ? "text-destructive" : "text-muted-foreground")}>
                {!liveOrigin ? "API nicht konfiguriert" : presence ? (connected ? "live" : "Live-Verbindung getrennt") : presenceError ?? "verbindet …"}
              </span>
              <button type="button" onClick={openBoard} className="rounded-md border border-border px-3 py-1.5 text-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Tafel
              </button>
            </div>
          </div>

          {agents.length ? (
            <div className="min-h-0 flex-1">
              <OfficeStage agents={agents} states={states} presence={presence} serverOffsetMs={serverOffsetMs} selectedId={selectedId} onSelect={setSelectedId} fill board={{ title, counts, onOpen: openBoard }} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Noch keine Agenten konfiguriert.</p>
          )}
        </section>

        <aside aria-label="Überblick" className="shrink-0 lg:w-80 lg:overflow-y-auto">
          <OfficeOverview scope={scope} counts={counts} usage={board.usage} approvals={board.approvals} portalUrl={portalUrl} onOpenBoard={openBoard} />
        </aside>
      </main>

      <BoardDialog
        open={boardOpen}
        onOpenChange={setBoardOpen}
        title={title}
        scope={scope}
        tasks={scopedTasks}
        projects={projects}
        agents={agents}
        portalUrl={portalUrl}
        onPickProject={setScope}
        onChanged={reloadBoard}
      />
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
    </PortalUrlProvider>
  );
}
