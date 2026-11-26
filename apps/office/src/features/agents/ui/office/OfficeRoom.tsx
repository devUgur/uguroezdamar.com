"use client";

import { cn } from "@ugur/core";
import type { AgentSummary, OfficeSnapshot } from "../../types";
import type { AgentLiveState } from "./agentState";
import { AgentFigure } from "./AgentFigure";
import { useWander } from "./useWander";
import { buildOffice } from "./world/layout";

interface OfficeRoomProps {
  agents: AgentSummary[];
  states: Record<string, AgentLiveState>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  presence: OfficeSnapshot | null;
  serverOffsetMs: number;
}

function svgX(x: number): number {
  return 480 + x * 64.7;
}

function svgY(z: number): number {
  return 110 + (z + 5) * 30;
}

/** The office floor: one desk per agent, figures that walk, sit and type according to their events. */
export function OfficeRoom({ agents, states, selectedId, onSelect, presence, serverOffsetMs }: OfficeRoomProps) {
  const { placements } = buildOffice(agents.map((agent) => agent.desk));
  const desks = Object.fromEntries(agents.map((agent, index) => [agent.id, placements[index]?.desk ?? { x: 0, z: -3 }]));
  const seats = Object.fromEntries(agents.map((agent, index) => {
    const seat = placements[index]?.seat;
    return [agent.id, seat ? { x: svgX(seat.x), y: svgY(seat.z) } : { x: 480, y: 200 }];
  }));
  const poses = useWander(seats, presence?.agents, serverOffsetMs);
  const height = Math.max(560, 110 + ((presence?.bounds.maxZ ?? 4) + 5) * 30 + 80);

  return (
    <svg viewBox={`0 0 960 ${height}`} className="h-auto w-full select-none" role="group" aria-label="Agenten-Büro">
      <rect x={0} y={0} width={960} height={height} className="fill-muted" />
      {/* Floor boards. */}
      {Array.from({ length: Math.ceil(height / 56) }, (_, index) => (
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
        const desk = desks[agent.id] ?? { x: 0, z: -3 };
        const working = (states[agent.id]?.activity ?? "idle") !== "idle";
        return (
          <g key={`desk-${agent.id}`} transform={`translate(${svgX(desk.x) - 70} ${svgY(desk.z) - 30})`}>
            <rect x={0} y={40} width={140} height={44} rx={6} className="fill-card stroke-foreground/40 stroke-2" />
            <rect x={44} y={4} width={52} height={36} rx={4} className={cn("stroke-foreground/40 stroke-2", working ? "fill-primary/50" : "fill-background")} />
            <rect x={64} y={40} width={12} height={6} className="fill-foreground/40" />
          </g>
        );
      })}

      {/* Plant by the door, purely decorative. */}
      <g transform="translate(900 460) scale(1.4)" aria-hidden="true">
        <rect x={-14} y={0} width={28} height={30} rx={4} className="fill-card stroke-foreground/40 stroke-2" />
        <circle cy={-12} r={20} className="fill-primary/40" />
      </g>

      {agents.map((agent) => {
        if (!presence) return null;
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
