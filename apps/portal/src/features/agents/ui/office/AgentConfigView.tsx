import type { ReactNode } from "react";
import { cn } from "@ugur/core";
import type { AgentConfig } from "../../types";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t border-border pt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="min-w-0 break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

const mono = (text: string) => <span className="font-mono text-xs">{text}</span>;
const usd = (value: number) => `${value.toFixed(value < 0.01 && value > 0 ? 4 : 2)} $`;

/** Every setting of the agent, grouped: model, tools, prompt, limits, storage, guardrails, credentials. */
export function AgentConfigView({ config }: { config: AgentConfig }) {
  const { limits, storage, data, guardrails } = config;
  return (
    <div className="flex flex-col gap-5 pb-6 text-sm">
      <Section title="Modell">
        <Facts rows={[["Alias", mono(config.model.alias)]]} />
        <ol className="flex flex-col gap-1">
          {config.model.chain.map((target, index) => (
            <li key={`${target.provider}/${target.model}`} className="flex items-baseline gap-2">
              <span className="w-4 text-muted-foreground">{index + 1}.</span>
              <span className="min-w-0 flex-1 break-words">
                {target.providerLabel} · {mono(target.model)}
              </span>
              <span className={cn("shrink-0 text-xs", target.available ? "text-muted-foreground" : "text-destructive")}>
                {target.available ? "bereit" : "nicht verfügbar"}
              </span>
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground">Reihenfolge der Fallbacks. Pro Thread lässt sich ein bestimmtes Modell wählen.</p>
      </Section>

      <Section title={`Werkzeuge (${config.tools.length})`}>
        <ul className="flex flex-col gap-3">
          {config.tools.map((tool) => (
            <li key={tool.name} className="flex flex-col gap-0.5">
              <span className="flex items-center gap-2">
                {mono(tool.name)}
                {tool.requiresApproval ? <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[11px]">braucht Freigabe</span> : null}
              </span>
              <span className="text-muted-foreground">{tool.description}</span>
              {tool.inputs.length ? (
                <span className="font-mono text-[11px] text-muted-foreground">
                  {tool.inputs.map((input) => `${input.name}${input.required ? "*" : ""}`).join(", ")}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Systemprompt">
        <details>
          <summary className="cursor-pointer text-muted-foreground underline-offset-4 hover:underline">Anzeigen</summary>
          <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted p-3 font-mono text-[11px] leading-5">
            {config.prompt}
          </pre>
          <p className="mt-1 text-xs text-muted-foreground">{data.projectNotes} gespeicherte Projekt-Notizen kommen zur Laufzeit dazu.</p>
        </details>
      </Section>

      <Section title="Grenzen">
        <Facts
          rows={[
            ["Schritte je Auftrag", String(limits.maxSteps)],
            ["Externe Aufrufe je Etappe", String(limits.subrequestsPerStage)],
            ["Verlauf ans Modell", `${limits.historyMessages} Nachrichten`],
            ["Lauf gilt als tot nach", `${limits.staleRunMinutes} min`],
            ["Freigabe läuft ab nach", `${limits.approvalHours} h`],
            ["Tagesbudget", `${usd(limits.dailyBudgetUsd)} (heute ${usd(limits.spentTodayUsd)})`],
          ]}
        />
      </Section>

      <Section title="Speicher und Daten">
        <Facts
          rows={[
            ["Umgebung", storage.environment],
            ["Datenbank", <>D1 {mono(storage.database.name)}, {storage.database.region}, Binding {mono(storage.database.binding)}</>],
            ["Einstellungen", <>KV {mono(storage.config.name)}, Binding {mono(storage.config.binding)}</>],
            ["Dateien", <>R2 {mono(storage.files.name)}, Binding {mono(storage.files.binding)}</>],
            ["Gespräche", storage.conversations],
            ["Projekt", `${storage.project.name} (${storage.project.repo})`],
            ["Threads", String(data.threads)],
            ["Events", `${data.events} (${usd(data.costUsdTotal)} insgesamt)`],
            ["Offene Freigaben", String(data.pendingApprovals)],
          ]}
        />
      </Section>

      <Section title="Schutzregeln">
        <Facts
          rows={[
            ["Arbeitsbranch", mono(guardrails.workBranch)],
            ["Eigene Branches", mono(`${guardrails.agentBranchPrefix}…`)],
            ["Nie schreiben auf", mono(guardrails.neverWritesTo)],
          ]}
        />
        <ul className="flex flex-col gap-1">
          {guardrails.protectedPaths.map((entry) => (
            <li key={entry.path} className="flex flex-col">
              {mono(entry.path)}
              <span className="text-xs text-muted-foreground">{entry.reason}: Freigabe wird rot markiert</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Zugangsdaten (nur ob gesetzt)">
        <ul className="flex flex-col gap-1">
          {config.credentials.map((entry) => (
            <li key={entry.name} className="flex items-baseline gap-2">
              <span className="min-w-0 flex-1">
                {mono(entry.name)}
                <span className="block text-xs text-muted-foreground">{entry.purpose}</span>
              </span>
              <span className={cn("shrink-0 text-xs", entry.set ? "text-muted-foreground" : "text-destructive")}>
                {entry.set ? "gesetzt" : "fehlt"}
              </span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
