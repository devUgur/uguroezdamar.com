import Link from "next/link";
import { isValidElement } from "react";

import { cn } from "@ugur/core";

type ButtonVariant = "primary" | "secondary";

const base =
  "inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  secondary: "border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80",
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
