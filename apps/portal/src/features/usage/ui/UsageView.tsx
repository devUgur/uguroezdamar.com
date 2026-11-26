import { ms, percent, tokens, usd } from "../format";
import type { UsagePage } from "../queries";
import type { UsageQuery } from "../types";
import { BudgetList } from "./BudgetList";
import { CallsTable } from "./CallsTable";
import { DailyBars } from "./DailyBars";
import { RunsTable } from "./RunsTable";
import { UsageBreakdown } from "./UsageBreakdown";
import { UsageFilters } from "./UsageFilters";

interface UsageViewProps {
  page: UsagePage;
  query: UsageQuery;
  exportHref: string;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-serif text-2xl tabular-nums">{value}</span>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

/** /usage: every model call of the agents, by agent, model, project and day, with runs and budgets. */
export function UsageView({ page, query, exportHref }: UsageViewProps) {
  const { summary } = page;
  const totals = summary?.totals;
  const total = Number(totals?.costUsd ?? 0);
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-10">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">Control Plane</p>
        <h1 className="font-serif text-3xl">Verbrauch</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Jeder Modell- und Werkzeugaufruf der Agenten, mit dem Preis, der zum Zeitpunkt des Aufrufs galt. Beträge sind aus Tokens und Katalogpreisen berechnet, keine Rechnung des Anbieters; Cache-Rabatte sind noch nicht abgezogen.
        </p>
      </header>

      {page.error ? (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          {page.error}
        </p>
      ) : null}

      <UsageFilters query={query} projects={page.projects} agents={page.agents} providers={summary?.byProvider ?? []} exportHref={exportHref} />

      {summary ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="Summen">
            <Stat label="Kosten" value={usd(total)} />
            <Stat label="Modellaufrufe" value={String(totals?.calls ?? 0)} hint={totals?.errors ? `${totals.errors} fehlgeschlagen` : undefined} />
            <Stat label="Tokens ein / aus" value={`${tokens(totals?.tokensIn)} / ${tokens(totals?.tokensOut)}`} hint={`Cache-Anteil ${percent(Number(totals?.cacheReadTokens ?? 0), Number(totals?.tokensIn ?? 0))}`} />
            <Stat label="Läufe" value={String(summary.runs?.runs ?? 0)} hint={summary.runs?.running ? `${summary.runs.running} laufen gerade` : undefined} />
            <Stat label="Ø Latenz je Aufruf" value={ms(totals?.avgLatencyMs)} />
          </section>

          <section className="flex flex-col gap-3" aria-labelledby="budget-title">
            <h2 id="budget-title" className="font-serif text-xl">
              Tagesbudgets heute
            </h2>
            <BudgetList budgets={summary.budgets} />
          </section>

          <section className="flex flex-col gap-3" aria-labelledby="days-title">
            <h2 id="days-title" className="font-serif text-xl">
              Kosten je Tag
            </h2>
            <DailyBars days={summary.byDay} />
          </section>

          <section className="grid gap-6 xl:grid-cols-2" aria-label="Aufteilung">
            <UsageBreakdown title="Nach Mitarbeiter" rows={summary.byAgent} totalUsd={total} />
            <UsageBreakdown title="Nach Modell" rows={summary.byModel} totalUsd={total} />
            <UsageBreakdown title="Nach Projekt" rows={summary.byProject} totalUsd={total} />
            <UsageBreakdown title="Nach Anbieter" rows={summary.byProvider} totalUsd={total} />
          </section>

          <section className="flex flex-col gap-3" aria-labelledby="runs-title">
            <h2 id="runs-title" className="font-serif text-xl">
              Läufe
            </h2>
            <RunsTable runs={page.runs} />
          </section>

          <section className="flex flex-col gap-3" aria-labelledby="calls-title">
            <h2 id="calls-title" className="font-serif text-xl">
              Letzte Modellaufrufe
            </h2>
            <CallsTable calls={page.calls} />
          </section>
        </>
      ) : null}
    </main>
  );
}
