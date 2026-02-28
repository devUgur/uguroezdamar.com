import { cn } from "@/shared/lib/utils";

export function Container({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-3xl px-4", className)}>
      {children}
    </div>
  );
}
