"use client";

import { useState } from "react";

export function InviteAdminForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/admins/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: json.error || "Failed to invite admin" });
      } else {
        setMessage({ type: "success", text: "Admin invited successfully!" });
        setEmail("");
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (err) {
      console.log("Invite error", err);
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={invite} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1 text-foreground/70">Email Address</label>
        <input 
          type="email" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
          className="w-full p-3 bg-muted/30 border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" 
          placeholder="colleague@example.com"
          required 
        />
      </div>
      {message && (
        <div className={`text-sm p-3 rounded-xl border ${
          message.type === "success" ? "bg-green-500/5 border-green-500/10 text-green-600" : "bg-red-500/5 border-red-500/10 text-red-600"
        }`}>
          {message.text}
        </div>
      )}
      <button 
        type="submit" 
        className="w-full inline-flex justify-center items-center px-4 py-3 bg-foreground text-background rounded-xl font-semibold hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50" 
        disabled={loading}
      >
        {loading ? "Sending..." : "Send Invitation"}
      </button>
    </form>
  );
}
