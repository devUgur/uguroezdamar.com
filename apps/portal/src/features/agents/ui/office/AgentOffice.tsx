"use client";

import { useState } from "react";
import { cn } from "@ugur/core";
import type { AgentSummary } from "../../types";
import { AgentChatDialog } from "./AgentChatDialog";
import { AgentConfigSheet } from "./AgentConfigSheet";
import { OfficeStage } from "./OfficeStage";
import { useOfficeLive } from "./useOfficeLive";

interface AgentOfficeProps {
  agents: AgentSummary[];
  liveOrigin: string | null;
}

/** /agents: every configured agent in one room, live. A click opens its configuration; from there into a chat. */
export function AgentOffice({ agents, liveOrigin }: AgentOfficeProps) {
  const { states, connected, presence, presenceError, serverOffsetMs } = useOfficeLive(agents, liveOrigin);
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
        <span
          role="status"
          aria-live="polite"
          className={cn("max-w-xl text-right text-xs", presenceError ? "text-destructive" : "text-muted-foreground")}
        >
          {!liveOrigin ? "API nicht konfiguriert · lokale Vorschau" : presence ? (connected ? "synchronisiert" : "Snapshot geladen · Live-Verbindung getrennt") : presenceError ? `${presenceError} Lokale Vorschau aktiv.` : !connected ? "verbindet … · lokale Vorschau aktiv" : "Bürostatus wird geladen · lokale Vorschau aktiv"}
        </span>
      </div>

      {agents.length ? (
        <OfficeStage agents={agents} states={states} presence={presence} serverOffsetMs={serverOffsetMs} selectedId={selectedId} onSelect={setSelectedId} />
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
