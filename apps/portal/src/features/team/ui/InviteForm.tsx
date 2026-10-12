"use client";

import { useState } from "react";

export function InviteForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setInviteUrl(null);
    try {
      const res = await fetch("/api/admins/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: json.error || "Failed to invite admin" });
      } else {
        setMessage({ type: "success", text: "Invite link created. Send it to the colleague through a trusted channel." });
        setInviteUrl(typeof json.inviteUrl === "string" ? json.inviteUrl : null);
        setEmail("");
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
      {inviteUrl && (
        <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
          <label htmlFor="admin-invite-url" className="font-medium">Single-use invite link</label>
          <input id="admin-invite-url" readOnly value={inviteUrl} className="w-full rounded border bg-background p-2" onFocus={(event) => event.currentTarget.select()} />
          <button type="button" className="text-primary underline" onClick={() => navigator.clipboard.writeText(inviteUrl)}>
            Copy invite link
          </button>
        </div>
      )}
      <button 
        type="submit" 
        className="w-full portal-btn-primary-lg active:scale-[0.98]" 
        disabled={loading}
      >
        {loading ? "Sending..." : "Send Invitation"}
      </button>
    </form>
  );
}
