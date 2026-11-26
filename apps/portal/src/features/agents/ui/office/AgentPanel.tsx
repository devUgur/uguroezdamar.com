import Link from "next/link";
import { Button } from "@ugur/ui";
import type { AgentSummary } from "../../types";
import { ACTIVITY_LABEL, type AgentLiveState } from "./agentState";

interface AgentPanelProps {
  agent: AgentSummary;
  state: AgentLiveState | undefined;
  onChat: (fresh: boolean) => void;
}

/** Details of the agent picked in the office, with the ways into a chat. */
export function AgentPanel({ agent, state, onChat }: AgentPanelProps) {
  return (
    <section aria-label={agent.name} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
      <div className="flex flex-col gap-1">
        <h2 className="font-serif text-xl">{agent.name}</h2>
        <p className="text-sm text-muted-foreground">{agent.summary}</p>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Zustand</dt>
        <dd>{ACTIVITY_LABEL[state?.activity ?? "idle"]}</dd>
        <dt className="text-muted-foreground">Modell</dt>
        <dd className="font-mono text-xs">{agent.modelAlias}</dd>
        <dt className="text-muted-foreground">Tagesbudget</dt>
        <dd>{agent.dailyBudgetUsd.toFixed(2)} $</dd>
        {agent.lastEventAt ? (
          <>
            <dt className="text-muted-foreground">Zuletzt aktiv</dt>
            <dd>{new Date(agent.lastEventAt).toLocaleString("de-DE")}</dd>
          </>
        ) : null}
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => onChat(false)}>
          Chatten
        </Button>
        <Button type="button" variant="secondary" onClick={() => onChat(true)}>
          Neuer Chat
        </Button>
        {agent.lastThreadId ? (
          <Link href={`/chat/${agent.lastThreadId}`} className="self-center text-sm text-muted-foreground underline-offset-4 hover:underline">
            Im Chat öffnen
          </Link>
        ) : null}
      </div>
    </section>
  );
}
