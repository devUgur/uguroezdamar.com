import Link from "next/link";
import { isValidElement } from "react";

import { cn } from "@ugur/core";

type ButtonVariant = "primary" | "secondary";

const base =
  "inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-zinc-900 text-white hover:bg-zinc-800",
  secondary: "border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50",
};

export function Button({
  variant = "primary",
  asChild,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  asChild?: boolean;
}) {
  if (asChild) {
    const child = props.children;
    if (isValidElement(child) && child.type === Link) {
      const linkProps = child.props as React.ComponentProps<typeof Link>;
      return (
        <Link
          {...linkProps}
          className={cn(base, variants[variant], linkProps.className, className)}
        />
      );
    }
  }

  return <button {...props} className={cn(base, variants[variant], className)} />;
}
