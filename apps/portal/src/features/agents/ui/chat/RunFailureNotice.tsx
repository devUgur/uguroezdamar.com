import type { RunFailure } from "./runFailure";

/** Shown under the question when the latest run ended in an error instead of an answer. */
export function RunFailureNotice({ failure }: { failure: RunFailure }) {
  return (
    <div role="alert" className="flex flex-col gap-2 rounded-lg border border-destructive/40 px-4 py-3 text-sm">
      <p className="font-medium text-destructive">Keine Antwort: {failure.title}</p>
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">Details</summary>
        <p className="mt-2 whitespace-pre-wrap break-words font-mono">{failure.detail}</p>
      </details>
    </div>
  );
}
