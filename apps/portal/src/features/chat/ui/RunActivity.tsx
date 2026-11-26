import { cn } from "@ugur/core";
import type { ActivityLine } from "./useLiveRun";
import { MessageText } from "./MessageText";

interface RunActivityProps {
  pending: string[];
  activity: ActivityLine[];
  streaming: string;
  running: boolean;
  status: string;
}

const MARK: Record<ActivityLine["state"], string> = { running: "…", ok: "✓", failed: "✗", note: "" };

/** The turn in progress: what was just sent, what the agent does right now, and its answer as it is written. */
export function RunActivity({ pending, activity, streaming, running, status }: RunActivityProps) {
  if (!pending.length && !activity.length && !streaming && !running) return null;
  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      {pending.map((text, index) => (
        <div key={index} className="flex justify-end">
          <div className="max-w-[min(42rem,85%)] rounded-lg bg-primary px-4 py-3 text-sm text-primary-foreground opacity-80">
            <p className="whitespace-pre-wrap break-words">{text}</p>
          </div>
        </div>
      ))}
      {activity.length ? (
        <ol className="flex flex-col gap-1 border-l border-border pl-3 font-mono text-xs text-muted-foreground">
          {activity.map((line) =>
            line.state === "note" ? (
              <li key={line.key} className="font-sans text-sm text-foreground/80">
                {line.label}
              </li>
            ) : (
              <li key={line.key} className={cn(line.state === "failed" && "text-destructive")}>
                <span>
                  {MARK[line.state]} {line.label}
                </span>
                {line.detail ? <span className="block truncate opacity-70">{line.detail}</span> : null}
              </li>
            ),
          )}
        </ol>
      ) : null}
      {streaming ? (
        <div className="text-sm">
          <MessageText text={streaming} />
        </div>
      ) : null}
      {running ? <p className="text-xs text-muted-foreground motion-safe:animate-pulse">{status || "arbeitet …"}</p> : null}
    </div>
  );
}
