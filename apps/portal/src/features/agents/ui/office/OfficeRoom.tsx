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
  return { x: 130 + (column % 4) * 210, y: 150 + row * 150 };
}

/** The office floor: one desk per agent, figures that walk, sit and type according to their events. */
export function OfficeRoom({ agents, states, selectedId, onSelect }: OfficeRoomProps) {
  const desks = Object.fromEntries(agents.map((agent, index) => [agent.id, deskOf(agent, index)]));
  const seats = Object.fromEntries(Object.entries(desks).map(([id, desk]) => [id, { x: desk.x + 70, y: desk.y + 100 }]));
  const activity = Object.fromEntries(agents.map((agent) => [agent.id, states[agent.id]?.activity ?? "idle"]));
  const poses = useWander(seats, activity);

  return (
    <svg viewBox="0 0 960 560" className="h-auto w-full select-none" role="group" aria-label="Agenten-Büro">
      <rect x={0} y={0} width={960} height={560} rx={12} className="fill-surface" />
      <rect x={0} y={0} width={960} height={96} rx={12} className="fill-card" />
      <line x1={0} y1={96} x2={960} y2={96} className="stroke-border" />
      {/* Window band and whiteboard on the back wall. */}
      {[80, 300, 520].map((x) => (
        <rect key={x} x={x} y={22} width={170} height={52} rx={6} className="fill-background stroke-border" />
      ))}
      <rect x={760} y={26} width={150} height={48} rx={4} className="fill-background stroke-foreground/30" />
      <text x={835} y={55} textAnchor="middle" className="fill-muted-foreground text-[11px]">
        dev → main
      </text>

      {agents.map((agent) => {
        const desk = desks[agent.id] ?? { x: 0, y: 0 };
        const working = (states[agent.id]?.activity ?? "idle") !== "idle";
        return (
          <g key={`desk-${agent.id}`} transform={`translate(${desk.x} ${desk.y})`}>
            <rect x={0} y={40} width={140} height={44} rx={6} className="fill-card stroke-border" />
            <rect x={44} y={6} width={52} height={34} rx={4} className={cn("stroke-border", working ? "fill-primary/40" : "fill-background")} />
            <rect x={66} y={40} width={8} height={6} className="fill-border" />
            <text x={70} y={100} textAnchor="middle" className="fill-muted-foreground text-[10px]">
              Platz {agent.name}
            </text>
          </g>
        );
      })}

      {/* Plant by the door, purely decorative. */}
      <g transform="translate(905 470)" aria-hidden="true">
        <rect x={-14} y={0} width={28} height={30} rx={4} className="fill-card stroke-border" />
        <circle cy={-10} r={18} className="fill-primary/30" />
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
