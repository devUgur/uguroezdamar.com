"use client";

import { useState } from "react";

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
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Login failed");
      } else {
        window.location.href = "/admin/dashboard";
      }
    } catch (err) {
        console.log("Login error", err);
        setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1 text-foreground/70">Email</label>
        <input 
          type="email" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
          className="w-full p-3 bg-muted/30 border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" 
          required 
          placeholder="admin@example.com"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 text-foreground/70">Password</label>
        <input 
          type="password" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          className="w-full p-3 bg-muted/30 border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" 
          required 
          placeholder="••••••••"
        />
      </div>
      {error && <div className="text-sm text-red-500 bg-red-500/5 p-3 rounded-xl border border-red-500/10">{error}</div>}
      <button 
        type="submit" 
        className="w-full inline-flex justify-center items-center px-4 py-3 bg-foreground text-background rounded-xl font-semibold hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50" 
        disabled={loading}
      >
        {loading ? "Verifying..." : "Sign in"}
      </button>
    </form>
  );
}
