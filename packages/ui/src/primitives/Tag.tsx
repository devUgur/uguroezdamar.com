import { cn } from "@ugur/core";

export function Tag({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-card px-2 py-0.5 text-xs text-card-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}
