"use client";

import { useState } from "react";
import { Button } from "@ugur/ui";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Login failed");
      } else {
        try {
          const params = new URL(window.location.href).searchParams;
          const next = params.get("next");
          if (next && typeof next === "string" && (next.startsWith("/") || next.startsWith("/admin"))) {
            window.location.href = next;
          } else {
            window.location.href = "/";
          }
        } catch (e) {
          window.location.href = "/";
        }
      }
    } catch (err) {
      console.error("Login error", err);
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col space-y-3 max-w-sm w-full mx-auto mt-6">
      <div className="space-y-1">
        <label className="text-sm font-medium leading-none text-foreground ml-1">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex h-11 w-full rounded-md border border-input bg-background border-border/50 px-4 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors shadow-sm"
          required
          placeholder="admin@example.com"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium leading-none text-foreground ml-1">
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="flex h-11 w-full rounded-md border border-input bg-background border-border/50 px-4 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors shadow-sm"
          required
          placeholder="••••••••"
        />
      </div>

      <div className="min-h-[16px]">
        {error && (
          <div className="text-sm font-medium text-destructive ml-1">
            {error}
          </div>
        )}
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full h-11 font-semibold"
      >
        {loading ? "Verifying..." : "Sign In"}
      </Button>
    </form>
  );
}
