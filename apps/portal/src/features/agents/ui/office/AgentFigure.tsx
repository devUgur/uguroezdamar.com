import { cn } from "@ugur/core";
import { ACTIVITY_LABEL, type AgentActivity } from "./agentState";
import type { FigurePose } from "./useWander";

interface AgentFigureProps {
  name: string;
  pose: FigurePose;
  activity: AgentActivity;
  bubble: string;
  selected: boolean;
  onSelect: () => void;
}

/** One agent as a small character in the office SVG. Keyboard: Tab to reach, Enter or Space to open. */
export function AgentFigure({ name, pose, activity, bubble, selected, onSelect }: AgentFigureProps) {
  const seated = !pose.walking && activity !== "idle";
  const bubbleWidth = Math.max(60, bubble.length * 6.6 + 20);
  return (
    <g
      transform={`translate(${pose.x.toFixed(1)} ${pose.y.toFixed(1)})`}
      role="button"
      tabIndex={0}
      aria-label={`${name}, ${ACTIVITY_LABEL[activity]}`}
      aria-pressed={selected}
      className="cursor-pointer outline-none [&:focus-visible_.agent-ring]:stroke-ring"
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <ellipse cx={0} cy={2} rx={18} ry={5} className="fill-foreground/10" />
      <circle
        r={30}
        cy={-26}
        className={cn("agent-ring fill-transparent stroke-2", selected ? "stroke-primary" : "stroke-transparent")}
      />
      {/* Legs step while walking. */}
      <g className={cn(pose.walking && "motion-safe:animate-agent-step")}>
        <rect x={-8} y={-14} width={6} height={14} rx={3} className="fill-foreground/70" />
      </g>
      <g className={cn(pose.walking && "motion-safe:animate-agent-step [animation-delay:160ms]")}>
        <rect x={2} y={-14} width={6} height={14} rx={3} className="fill-foreground/70" />
      </g>
      <rect
        x={-13}
        y={-42}
        width={26}
        height={30}
        rx={10}
        className={cn(activity === "error" ? "fill-destructive" : "fill-primary")}
      />
      {/* Hands tap while the agent works at its desk. */}
      <g className={cn(seated && activity === "working" && "motion-safe:animate-agent-type")}>
        <circle cx={-14} cy={-24} r={4} className="fill-foreground/60" />
        <circle cx={14} cy={-24} r={4} className="fill-foreground/60" />
      </g>
      <circle cy={-52} r={11} className="fill-card stroke-foreground/60 stroke-2" />
      <circle cx={-4} cy={-53} r={1.6} className="fill-foreground" />
      <circle cx={4} cy={-53} r={1.6} className="fill-foreground" />
      {activity === "waiting" ? (
        <text y={-70} textAnchor="middle" className="fill-primary text-lg font-bold">
          !
        </text>
      ) : null}
      {bubble ? (
        <g transform={`translate(0 ${activity === "waiting" ? -96 : -80})`}>
          <rect x={-bubbleWidth / 2} y={-20} width={bubbleWidth} height={24} rx={8} className="fill-card stroke-border" />
          <text y={-4} textAnchor="middle" className="fill-foreground text-[11px]">
            {bubble}
          </text>
        </g>
      ) : null}
      <text y={20} textAnchor="middle" className="fill-foreground text-xs font-semibold">
        {name}
      </text>
      <text y={34} textAnchor="middle" className="fill-muted-foreground text-[10px]">
        {ACTIVITY_LABEL[activity]}
      </text>
    </g>
  );
}
