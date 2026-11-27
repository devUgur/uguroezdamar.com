import { portalUrl } from "@/src/adapters/session";
import { loadOfficeOverview } from "../../queries";
import type { OfficeScope } from "../../types";
import { OfficeWidgets } from "./OfficeWidgets";

/** The widgets of one scope; the page of each scope route renders only this. */
export async function OfficeOverviewPanel({ scope }: { scope: OfficeScope }) {
  return <OfficeWidgets workspace={await loadOfficeOverview(scope)} portalUrl={portalUrl()} />;
}

/** Shown while a scope switch loads its widgets; the room beside it stays as it is. */
export function OfficeOverviewSkeleton() {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Überblick wird geladen">
      {["h-24", "h-28", "h-48"].map((height) => (
        <div key={height} className={`${height} animate-pulse rounded-lg border border-border bg-muted`} />
      ))}
    </div>
  );
}
