import { LoginForm } from "@/src/features/auth";
import Link from "next/link";
import { ThemeToggle } from "@ugur/ui";

export default function AdminLoginPage() {
  return (
    <div className="flex-1 w-full flex flex-col items-center justify-center bg-background px-6 relative overflow-hidden">

      {/* Theme Toggle in top right */}
      <div className="absolute top-6 right-8 z-50">
        <ThemeToggle />
      </div>

      {/* Subtle minimalist top gradient line */}
      <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-foreground/20 to-transparent opacity-50" />

      {/* Ambient background bloom (very soft) */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/5 blur-[120px] rounded-full" />
      <div className="pointer-events-none absolute bottom-0 right-0 w-[400px] h-[400px] bg-primary/5 blur-[100px] rounded-full" />

      <div className="w-full max-w-[380px] space-y-8 relative z-10 my-auto pb-10">
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-serif font-medium tracking-tight text-foreground">
            Access Portal
          </h1>
          <p className="text-[13px] font-mono text-muted-foreground flex items-center justify-center gap-3 opacity-90">
            <span className="w-8 h-[1px] bg-muted-foreground/30" />
            SECURE LOGIN
            <span className="w-8 h-[1px] bg-muted-foreground/30" />
          </p>
        </div>

        <LoginForm />

        <div className="pt-6 text-center">
          <Link
            href="/"
            className="text-[11px] font-mono text-muted-foreground hover:text-foreground hover:underline transition-all duration-300 inline-flex items-center gap-2 group"
          >
            <span className="group-hover:-translate-x-1 transition-transform duration-300">&larr;</span>
            RETURN TO SITE
          </Link>
        </div>
      </div>
    </div>
  );
}
