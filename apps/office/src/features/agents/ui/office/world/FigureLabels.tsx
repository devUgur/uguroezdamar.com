"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { AgentSummary } from "../../../types";
import { ACTIVITY_LABEL, type AgentLiveState } from "../agentState";
import type { LabelAnchors } from "./labels";

interface FigureLabelsProps {
  agents: AgentSummary[];
  states: Record<string, AgentLiveState>;
  anchors: RefObject<LabelAnchors>;
}

/**
 * Name, state and speech bubble of every figure as ordinary DOM above the 3D canvas. Text and
 * state come from React; only the position is moved imperatively, once per frame, because it
 * changes faster than React should render.
 */
export function FigureLabels({ agents, states, anchors }: FigureLabelsProps) {
  const elements = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    let frame = 0;
    const place = () => {
      for (const [id, element] of elements.current) {
        const anchor = anchors.current?.[id];
        element.style.visibility = anchor?.visible ? "visible" : "hidden";
        if (anchor) element.style.transform = `translate(${anchor.x.toFixed(1)}px, ${anchor.y.toFixed(1)}px) translate(-50%, -100%)`;
      }
      frame = requestAnimationFrame(place);
    };
    frame = requestAnimationFrame(place);
    return () => cancelAnimationFrame(frame);
  }, [anchors]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {agents.map((agent) => {
        const state = states[agent.id];
        const activity = state?.activity ?? "idle";
        return (
          <div
            key={agent.id}
            ref={(element) => {
              if (element) elements.current.set(agent.id, element);
              else elements.current.delete(agent.id);
            }}
            className="invisible absolute left-0 top-0 flex flex-col items-center gap-1 whitespace-nowrap select-none"
          >
            {state?.bubble ? <div className="max-w-56 truncate rounded-md border border-border bg-card px-2 py-1 text-xs shadow-sm">{state.bubble}</div> : null}
            {activity === "waiting" ? <span className="text-xl font-bold leading-none text-primary">!</span> : null}
            <div className="rounded bg-background/85 px-2 py-0.5 text-center text-xs">
              <span className="font-semibold">{agent.name}</span> <span className="text-muted-foreground">{ACTIVITY_LABEL[activity]}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
