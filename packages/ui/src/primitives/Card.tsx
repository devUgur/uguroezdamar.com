import { cn } from "@ugur/core";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-lg border border-zinc-200 bg-white p-4", className)}>
      {children}
    </div>
  );
}
