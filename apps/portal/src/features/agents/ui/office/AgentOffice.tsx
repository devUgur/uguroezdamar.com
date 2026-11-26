"use client";

import { useState } from "react";
import type { AgentSummary } from "../../types";
import { AgentChatDialog } from "./AgentChatDialog";
import { AgentConfigSheet } from "./AgentConfigSheet";
import { OfficeRoom } from "./OfficeRoom";
import { useOfficeLive } from "./useOfficeLive";

interface AgentOfficeProps {
  agents: AgentSummary[];
  liveOrigin: string | null;
}

/** /agents: every configured agent in one room, live. A click opens its configuration; from there into a chat. */
export function AgentOffice({ agents, liveOrigin }: AgentOfficeProps) {
  const { states, connected } = useOfficeLive(agents, liveOrigin);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chat, setChat] = useState<{ agent: AgentSummary; fresh: boolean } | null>(null);
  const selected = agents.find((agent) => agent.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="font-serif text-3xl">Agenten</h1>
          <p className="text-sm text-muted-foreground">
            Wer gerade arbeitet, sitzt am Platz und tippt; wer frei ist, läuft durchs Büro. Klick auf eine Figur zeigt ihre Konfiguration.
          </p>
        </div>
        <span className="text-xs text-muted-foreground">{liveOrigin ? (connected ? "live" : "verbindet …") : "API nicht konfiguriert"}</span>
      </div>

      {agents.length ? (
        <div className="overflow-hidden rounded-xl border border-border">
          <OfficeRoom agents={agents} states={states} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Noch keine Agenten konfiguriert.</p>
      )}

      <AgentConfigSheet
        agent={selected}
        state={selected ? states[selected.id] : undefined}
        onClose={() => setSelectedId(null)}
        onChat={(agent, fresh) => {
          setSelectedId(null);
          setChat({ agent, fresh });
        }}
      />
      <AgentChatDialog agent={chat?.agent ?? null} fresh={chat?.fresh ?? false} onClose={() => setChat(null)} />
    </div>
  );
}
