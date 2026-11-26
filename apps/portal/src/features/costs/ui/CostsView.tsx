import type { CostReport } from "../types";

const usd = (value: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "USD", maximumFractionDigits: 4 }).format(value);
const count = (value: number) => new Intl.NumberFormat("de-DE").format(value);

function Breakdown({ title, rows }: { title: string; rows: { key: string; label: string; cost: number; calls: number; tokensIn: number; tokensOut: number }[] }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5" aria-labelledby={title}>
      <h2 id={title} className="mb-4 text-lg font-medium">{title}</h2>
      {rows.length ? <ul className="divide-y divide-border">
        {rows.map((row) => <li key={row.key} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 text-sm">
          <span className="min-w-40 flex-1">{row.label}<span className="ml-2 text-xs text-muted-foreground">{count(row.calls)} Aufrufe · {count(row.tokensIn + row.tokensOut)} Tokens</span></span>
          <span className="font-mono tabular-nums">{usd(row.cost)}</span>
        </li>)}
      </ul> : <p className="text-sm text-muted-foreground">Für diesen Zeitraum liegen keine Modellaufrufe vor.</p>}
    </section>
  );
}

export function CostsView({ report, error }: { report: CostReport | null; error: string | null }) {
  return <main className="space-y-8 p-6 lg:p-8">
    <header className="space-y-2">
      <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Management</p>
      <h1 className="font-serif text-3xl">Kostenübersicht</h1>
      <p className="max-w-3xl text-sm text-muted-foreground">Modellverbrauch der letzten 30 Tage nach Agent und Modell. Die Beträge sind Kostenschätzungen aus den im Modellkatalog hinterlegten Preisen, keine Providerabrechnung.</p>
    </header>
    {error ? <p role="status" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">{error}</p> : null}
    {report ? <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Gesamtkosten">
        {[["Geschätzte Kosten", usd(report.totals.cost)], ["Modellaufrufe", count(report.totals.calls)], ["Eingabe-Tokens", count(report.totals.tokensIn)], ["Ausgabe-Tokens", count(report.totals.tokensOut)]].map(([label, value]) =>
          <article key={label} className="rounded-xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 font-mono text-2xl tabular-nums">{value}</p></article>)}
      </section>
      <section className="rounded-xl border border-border bg-card p-5" aria-labelledby="cost-days">
        <h2 id="cost-days" className="mb-4 text-lg font-medium">Tagesverlauf</h2>
        {report.byDay.length ? <div className="space-y-2">
          {report.byDay.map((day) => <div key={day.day} className="grid grid-cols-[7rem_1fr_6rem] items-center gap-3 text-sm">
            <time dateTime={day.day} className="font-mono text-muted-foreground">{new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "short" }).format(new Date(day.day + "T00:00:00Z"))}</time>
            <progress aria-label={"Kosten am " + day.day} className="h-2 w-full overflow-hidden rounded-full accent-primary" value={day.cost} max={Math.max(...report.byDay.map((item) => item.cost), 0.0001)} />
            <span className="text-right font-mono tabular-nums">{usd(day.cost)}</span>
          </div>)}
        </div> : <p className="text-sm text-muted-foreground">Für diesen Zeitraum liegen keine Modellaufrufe vor.</p>}
      </section>
      <div className="grid gap-5 xl:grid-cols-2">
        <Breakdown title="Nach Agent" rows={report.byAgent.map((row) => ({ key: row.agentId ?? "unknown", label: row.agent, ...row }))} />
        <Breakdown title="Nach Modell" rows={report.byModel.map((row) => ({ key: row.model, label: row.model, ...row }))} />
      </div>
    </> : null}
  </main>;
}
