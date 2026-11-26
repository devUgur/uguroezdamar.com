"use client";

import { cn } from "@ugur/core";
import type { AgentSummary } from "../../types";
import type { AgentLiveState } from "./agentState";
import { AgentFigure } from "./AgentFigure";
import { useWander, type Point } from "./useWander";

interface OfficeRoomProps {
  agents: AgentSummary[];
  states: Record<string, AgentLiveState>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** Desk of an agent from its row in the `agents` table (desk_x, desk_y start at 1). */
function deskOf(agent: AgentSummary, index: number): Point {
  const column = Math.max(1, agent.desk.x || index + 1) - 1;
  const row = Math.max(1, agent.desk.y || 1) - 1;
  return { x: 90 + (column % 4) * 220, y: 140 + row * 170 };
}

/** The office floor: one desk per agent, figures that walk, sit and type according to their events. */
export function OfficeRoom({ agents, states, selectedId, onSelect }: OfficeRoomProps) {
  const desks = Object.fromEntries(agents.map((agent, index) => [agent.id, deskOf(agent, index)]));
  const seats = Object.fromEntries(Object.entries(desks).map(([id, desk]) => [id, { x: desk.x + 91, y: desk.y + 150 }]));
  const activity = Object.fromEntries(agents.map((agent) => [agent.id, states[agent.id]?.activity ?? "idle"]));
  const poses = useWander(seats, activity);

  return (
    <svg viewBox="0 0 960 560" className="h-auto w-full select-none" role="group" aria-label="Agenten-Büro">
      <rect x={0} y={0} width={960} height={560} className="fill-muted" />
      {/* Floor boards. */}
      {Array.from({ length: 8 }, (_, index) => (
        <line key={index} x1={0} y1={150 + index * 56} x2={960} y2={150 + index * 56} className="stroke-foreground/10" />
      ))}
      <rect x={0} y={0} width={960} height={110} className="fill-card" />
      <line x1={0} y1={110} x2={960} y2={110} className="stroke-foreground/25 stroke-2" />
      {/* Windows and a whiteboard on the back wall. */}
      {[60, 280, 500].map((x) => (
        <g key={x}>
          <rect x={x} y={24} width={180} height={62} rx={6} className="fill-background stroke-foreground/25 stroke-2" />
          <line x1={x + 90} y1={24} x2={x + 90} y2={86} className="stroke-foreground/25 stroke-2" />
        </g>
      ))}
      <rect x={740} y={28} width={170} height={58} rx={4} className="fill-background stroke-foreground/40 stroke-2" />
      {[46, 58, 70].map((y, index) => (
        <line key={y} x1={758} y1={y} x2={index === 2 ? 840 : 890} y2={y} className="stroke-foreground/20 stroke-2" />
      ))}

      {agents.map((agent) => {
        const desk = desks[agent.id] ?? { x: 0, y: 0 };
        const working = (states[agent.id]?.activity ?? "idle") !== "idle";
        return (
          <g key={`desk-${agent.id}`} transform={`translate(${desk.x} ${desk.y}) scale(1.3)`}>
            <rect x={0} y={40} width={140} height={44} rx={6} className="fill-card stroke-foreground/40 stroke-2" />
            <rect x={44} y={4} width={52} height={36} rx={4} className={cn("stroke-foreground/40 stroke-2", working ? "fill-primary/50" : "fill-background")} />
            <rect x={64} y={40} width={12} height={6} className="fill-foreground/40" />
            <text x={70} y={102} textAnchor="middle" className="fill-muted-foreground text-[11px]">
              Platz {agent.name}
            </text>
          </g>
        );
      })}

      {/* Plant by the door, purely decorative. */}
      <g transform="translate(900 460) scale(1.4)" aria-hidden="true">
        <rect x={-14} y={0} width={28} height={30} rx={4} className="fill-card stroke-foreground/40 stroke-2" />
        <circle cy={-12} r={20} className="fill-primary/40" />
      </g>

      {agents.map((agent) => {
        const pose = poses[agent.id];
        if (!pose) return null;
        const state = states[agent.id];
        return (
          <AgentFigure
            key={agent.id}
            name={agent.name}
            pose={pose}
            activity={state?.activity ?? "idle"}
            bubble={state?.bubble ?? ""}
            selected={selectedId === agent.id}
            onSelect={() => onSelect(agent.id)}
          />
        );
      })}
    </svg>
  );
}
