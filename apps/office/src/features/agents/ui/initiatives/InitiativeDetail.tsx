"use client";

import { useState, useTransition } from "react";
import { cn } from "@ugur/core";
import { Button, toast } from "@ugur/ui";
import { answerInitiative, approveInitiative } from "../../actions";
import type { AgentSummary, OfficeInitiative } from "../../types";
import { DeliveryProgress } from "../board/DeliveryProgress";
import { PLANNING_STEPS, phaseOf } from "./InitiativesWidget";

interface InitiativeDetailProps {
  initiative: OfficeInitiative;
  agents: AgentSummary[];
  onChanged: () => void;
}

const fieldClass = "rounded-md border border-border bg-background p-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** One initiative: the wish, Ugur's open questions, the team's artifacts and the approval of the plan. */
export function InitiativeDetail({ initiative, agents, onChanged }: InitiativeDetailProps) {
  const [pending, startTransition] = useTransition();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [artifact, setArtifact] = useState(initiative.artifacts.at(-1)?.kind ?? null);
  const open = initiative.questions.filter((question) => !question.answer);
  const shown = initiative.artifacts.find((entry) => entry.kind === artifact) ?? null;
  const phase = phaseOf(initiative);

  function act(work: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const result = await work();
      if (!result.ok) toast.error(result.error ?? "Aktion fehlgeschlagen.");
      else {
        toast.success(success);
        onChanged();
      }
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto lg:flex-row">
      <div className="flex min-w-0 flex-col gap-4 lg:w-96 lg:shrink-0">
        <section className="flex flex-col gap-1">
          <span className={cn("text-xs", phase.needsOwner ? "text-destructive" : "text-muted-foreground")}>{phase.text}</span>
          <p className="whitespace-pre-line text-sm">{initiative.brief}</p>
          {Object.keys(initiative.backlog).length ? (
            <p className="text-xs text-muted-foreground">
              Backlog: {initiative.backlog.epic ?? 0} Epics, {initiative.backlog.story ?? 0} Stories, {initiative.backlog.task ?? 0} Tasks
            </p>
          ) : null}
        </section>

        {open.length ? (
          <form
            className="flex flex-col gap-3 rounded-lg border border-destructive/40 p-3"
            onSubmit={(event) => {
              event.preventDefault();
              act(() => answerInitiative(initiative.id, open.map((question) => ({ id: question.id, answer: answers[question.id] ?? "" })).filter((entry) => entry.answer.trim())), "Antworten gesendet, das Team plant weiter.");
            }}
          >
            <h3 className="text-sm font-medium">Rückfragen an dich</h3>
            {open.map((question) => (
              <label key={question.id} className="flex flex-col gap-1 text-sm">
                <span>{question.question}</span>
                {question.why ? <span className="text-xs text-muted-foreground">Warum: {question.why}</span> : null}
                <textarea
                  rows={2}
                  className={fieldClass}
                  placeholder={question.proposal ? `Vorschlag: ${question.proposal}` : ""}
                  value={answers[question.id] ?? ""}
                  onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))}
                />
                {question.proposal ? (
                  <button type="button" className="self-start text-xs underline underline-offset-2" onClick={() => setAnswers((current) => ({ ...current, [question.id]: question.proposal ?? "" }))}>
                    Vorschlag übernehmen
                  </button>
                ) : null}
              </label>
            ))}
            <Button type="submit" disabled={pending || open.some((question) => !(answers[question.id] ?? "").trim())}>
              Antworten senden
            </Button>
          </form>
        ) : null}

        {initiative.planning?.status === "awaiting_acceptance" ? (
          <div className="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm">
            <p>Das Team hat die Planung abgeschlossen. Mit der Freigabe wird der vorgeschlagene Sprint aktiv, und das Team arbeitet die Tickets nacheinander ab.</p>
            <Button disabled={pending} onClick={() => act(() => approveInitiative(initiative.id), "Planung freigegeben, der Sprint startet.")}>
              Planung freigeben
            </Button>
          </div>
        ) : null}

        {initiative.planning ? <DeliveryProgress delivery={initiative.planning} agents={agents} onChanged={onChanged} steps={PLANNING_STEPS} title="Planung" /> : null}
      </div>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
        <nav aria-label="Artefakte" className="flex flex-wrap gap-1">
          {initiative.artifacts.map((entry) => (
            <button
              key={entry.kind}
              type="button"
              aria-pressed={entry.kind === artifact}
              onClick={() => setArtifact(entry.kind)}
              className={cn("rounded-md border border-border px-2 py-1 text-xs hover:bg-accent", entry.kind === artifact && "bg-accent font-medium")}
            >
              {PLANNING_STEPS.find((step) => step.step === entry.kind)?.label ?? entry.kind}
              {entry.version > 1 ? ` · v${entry.version}` : ""}
            </button>
          ))}
        </nav>
        {shown ? (
          <article className="min-h-0 flex-1 overflow-y-auto whitespace-pre-line rounded-lg border border-border bg-card p-4 text-sm leading-relaxed">{shown.content}</article>
        ) : (
          <p className="text-sm text-muted-foreground">Noch keine Ergebnisse. Das erste Artefakt erscheint, sobald der Eingang fertig ist.</p>
        )}
      </section>
    </div>
  );
}
