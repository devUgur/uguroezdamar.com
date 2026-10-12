import { cn } from "@ugur/core";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-4 text-card-foreground", className)}>
      {children}
    </div>
  );
}
