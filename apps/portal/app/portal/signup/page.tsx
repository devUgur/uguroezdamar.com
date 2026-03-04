"use client";
import React, { useState, useEffect } from "react";

export default function PortalSignupPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    const t = u.searchParams.get("token") ?? "";
    setToken(t);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!token) return setMessage("Missing invite token");
    if (password.length < 8) return setMessage("Password must be at least 8 characters");
    if (password !== confirm) return setMessage("Passwords do not match");

    setBusy(true);
    try {
      const res = await fetch("/api/admin/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setMessage("Invite accepted — account created. Please sign in.");
      } else {
        setMessage(data?.error || "Failed to accept invite");
      }
    } catch (err: unknown) {
      setMessage((err as Error)?.message || "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: "4rem auto", padding: "1rem" }}>
      <h1>Accept Admin Invite</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label>Invite Token</label>
          <input value={token} onChange={(e) => setToken(e.target.value)} style={{ width: "100%" }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>New Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: "100%" }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Confirm Password</label>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} style={{ width: "100%" }} />
        </div>
        <div>
          <button type="submit" disabled={busy}>{busy ? "Submitting…" : "Accept Invite"}</button>
        </div>
      </form>
      {message && <p style={{ marginTop: 12 }}>{message}</p>}
    </main>
  );
}
