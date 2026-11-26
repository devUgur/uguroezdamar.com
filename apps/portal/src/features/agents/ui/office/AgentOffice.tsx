"use client";

import { useState } from "react";
import type { AgentSummary } from "../../types";
import { AgentChatDialog } from "./AgentChatDialog";
import { AgentPanel } from "./AgentPanel";
import { OfficeRoom } from "./OfficeRoom";
import { useOfficeLive } from "./useOfficeLive";

interface AgentOfficeProps {
  agents: AgentSummary[];
  liveOrigin: string | null;
}

/** /agents: every configured agent in one room, live; click one to see it and chat with it. */
export function AgentOffice({ agents, liveOrigin }: AgentOfficeProps) {
  const { states, connected } = useOfficeLive(agents, liveOrigin);
  const [selectedId, setSelectedId] = useState<string | null>(agents[0]?.id ?? null);
  const [chat, setChat] = useState<{ agent: AgentSummary; fresh: boolean } | null>(null);
  const selected = agents.find((agent) => agent.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="font-serif text-3xl">Agenten</h1>
          <p className="text-sm text-muted-foreground">
            Wer gerade arbeitet, sitzt am Platz und tippt; wer frei ist, läuft durchs Büro. Klick auf eine Figur.
          </p>
        </div>
        <span className="text-xs text-muted-foreground">{liveOrigin ? (connected ? "live" : "verbindet …") : "API nicht konfiguriert"}</span>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="overflow-hidden rounded-xl border border-border">
          <OfficeRoom agents={agents} states={states} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
        {selected ? (
          <AgentPanel agent={selected} state={states[selected.id]} onChat={(fresh) => setChat({ agent: selected, fresh })} />
        ) : (
          <p className="text-sm text-muted-foreground">Noch keine Agenten konfiguriert.</p>
        )}
      </div>

      <AgentChatDialog agent={chat?.agent ?? null} fresh={chat?.fresh ?? false} onClose={() => setChat(null)} />
    </div>
  );
}
