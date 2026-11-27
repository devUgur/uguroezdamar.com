"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { cn } from "@ugur/core";
import { toast } from "@ugur/ui";
import type { AgentSummary, OfficeSnapshot } from "../../types";
import { ACTIVITY_LABEL, type AgentLiveState } from "./agentState";
import { OfficeRoom } from "./OfficeRoom";
import { FigureLabels } from "./world/FigureLabels";
import type { LabelAnchors } from "./world/labels";
import { SceneBoundary } from "./world/SceneBoundary";
import { buildOffice, localFallbackMotion } from "./world/layout";
import { canUseWebGL } from "./world/webgl";
import type { OfficeWallBoard } from "./world/OfficeScene3D";

type View = "3d" | "2d";
const STORAGE_KEY = "agents-office-view";

function fallbackPresence(agents: AgentSummary[], states: Record<string, AgentLiveState>, now: number): OfficeSnapshot {
  const office = buildOffice(agents.map((agent) => agent.desk));
  const agentMotions = Object.fromEntries(agents.flatMap((agent, index) => {
    const placement = office.placements[index];
    if (!placement) return [];
    const activity = states[agent.id]?.activity ?? "idle";
    return [[agent.id, localFallbackMotion(agent.id, activity, placement.seat, office.bounds, now)]];
  }));
  return {
    revision: 0,
    serverTime: now,
    bounds: office.bounds,
    placements: office.placements.map((placement, index) => ({ agentId: agents[index]?.id ?? "", desk: placement.desk, seat: placement.seat })),
    agents: agentMotions,
  };
}

// three.js and its helpers load only when the 3D view is shown.
const OfficeScene3D = dynamic(() => import("./world/OfficeScene3D"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Büro wird geladen …</div>,
});

interface OfficeStageProps {
  agents: AgentSummary[];
  states: Record<string, AgentLiveState>;
  presence: OfficeSnapshot | null;
  serverOffsetMs: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Fill the parent (fullscreen office) instead of a fixed height inside a page. */
  fill?: boolean;
  /** The board on the back wall of the 3D room. */
  board: OfficeWallBoard;
}

function storedView(): View | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "2d" || value === "3d" ? value : null;
  } catch {
    return null;
  }
}

/** The office as 3D scene or flat 2D room, with the agents also as buttons below for keyboard and touch. */
export function OfficeStage({ agents, states, presence, serverOffsetMs, selectedId, onSelect, fill = false, board }: OfficeStageProps) {
  const [view, setView] = useState<View | null>(null);
  const [webgl, setWebgl] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [fallbackTime, setFallbackTime] = useState(() => Date.now());
  const anchors = useRef<LabelAnchors>({});
  const renderedPresence = presence ?? fallbackPresence(agents, states, fallbackTime);

  useEffect(() => {
    const supported = canUseWebGL();
    setWebgl(supported);
    setView(supported ? (storedView() ?? "3d") : "2d");
  }, []);

  useEffect(() => {
    if (presence) return;
    const timer = setInterval(() => setFallbackTime(Date.now()), 250);
    return () => clearInterval(timer);
  }, [presence]);

  function choose(next: View) {
    setView(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage may be blocked */
    }
  }

  return (
    <div className={cn("flex flex-col gap-3", fill && "h-full min-h-0")}>
      <div className="flex items-center justify-between gap-3">
        <ul className="flex flex-wrap gap-2" aria-label="Agenten">
          {agents.map((agent) => (
            <li key={agent.id}>
              <button
                type="button"
                aria-pressed={selectedId === agent.id}
                onClick={() => onSelect(agent.id)}
                className={cn(
                  "rounded-full border border-border px-3 py-1 text-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selectedId === agent.id && "bg-accent",
                )}
              >
                {agent.name} · {ACTIVITY_LABEL[states[agent.id]?.activity ?? "idle"]}
              </button>
            </li>
          ))}
        </ul>
        {webgl ? (
          <div role="group" aria-label="Ansicht" className="flex shrink-0 overflow-hidden rounded-md border border-border text-xs">
            {(["3d", "2d"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={view === option}
                onClick={() => choose(option)}
                className={cn("px-3 py-1 uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", view === option ? "bg-primary text-primary-foreground" : "hover:bg-accent")}
              >
                {option}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className={cn("overflow-hidden rounded-xl border border-border", fill && "min-h-80 flex-1")}>
        {view === "3d" ? (
          <div className={cn("relative w-full", fill ? "h-full" : "h-[22rem] sm:h-[min(70dvh,42rem)] sm:min-h-80")}>
            <SceneBoundary
              onError={() => {
                toast.error("3D-Ansicht nicht möglich, das Büro wechselt auf 2D.");
                setView("2d");
              }}
            >
              <OfficeScene3D agents={agents} states={states} presence={renderedPresence} localPreview={!presence} serverOffsetMs={serverOffsetMs} selectedId={selectedId} onSelect={onSelect} anchors={anchors} onReady={() => setSceneReady(true)} board={board} />
            </SceneBoundary>
            {sceneReady ? null : (
              <div role="status" className="absolute inset-0 flex items-center justify-center bg-muted text-sm text-muted-foreground">
                Büro wird geladen …
              </div>
            )}
            <FigureLabels agents={agents} states={states} anchors={anchors} />
          </div>
        ) : view === "2d" ? (
          <OfficeRoom agents={agents} states={states} presence={renderedPresence} serverOffsetMs={serverOffsetMs} selectedId={selectedId} onSelect={onSelect} />
        ) : (
          <div className="h-80" />
        )}
      </div>
    </div>
  );
}
