/** Formatting for the usage pages: German numbers, dollars with enough digits for cheap models. */
const integer = new Intl.NumberFormat("de-DE");

export function usd(value: number | null | undefined): string {
  const amount = Number(value ?? 0);
  const digits = amount !== 0 && Math.abs(amount) < 0.01 ? 4 : 2;
  return `${amount.toLocaleString("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits })} $`;
}

export function tokens(value: number | null | undefined): string {
  const amount = Number(value ?? 0);
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} Mio.`;
  if (amount >= 10_000) return `${(amount / 1_000).toLocaleString("de-DE", { maximumFractionDigits: 0 })} Tsd.`;
  return integer.format(amount);
}

export function ms(value: number | null | undefined): string {
  if (value === null || value === undefined) return "–";
  return value >= 1_000 ? `${(value / 1_000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} s` : `${integer.format(value)} ms`;
}

export function time(value: number | null | undefined): string {
  if (!value) return "–";
  return new Date(value).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function percent(part: number, whole: number): string {
  if (!whole) return "–";
  return `${Math.round((part / whole) * 100)} %`;
}

export const PRICE_SOURCE: Record<string, string> = {
  catalog: "Katalogpreis",
  provider_default: "Anbieter-Schätzung",
  paid_default: "Sicherheitsschätzung",
  free: "kostenlos",
};

export const RUN_STATUS: Record<string, string> = {
  running: "läuft",
  done: "fertig",
  failed: "fehlgeschlagen",
  stopped: "gestoppt",
  step_limit: "Schrittlimit",
};
