"use client";
import React, { useState } from "react";

export default function AdminWorkForm({ id, initial }: { id?: string; initial?: any }) {
  const [liveUrl, setLiveUrl] = useState(initial?.links?.live ?? "");
  const [preview, setPreview] = useState(initial?.previewImageUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function generatePreview() {
    setMsg(null);
    if (!id) return setMsg("Missing id");
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/work-items/${id}/preview`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
      const data = await res.json();
      if (res.ok && data.ok) {
        // optimistic update
        setPreview(data.previewImageUrl);
        setMsg("Preview generated");

        // refetch authoritative work item and update preview (non-blocking)
        try {
          const r2 = await fetch(`/api/admin/work-items/${id}`);
          if (r2.ok) {
            const d2 = await r2.json();
            if (d2?.ok && d2.work) {
              setPreview(d2.work.previewImageUrl ?? data.previewImageUrl);
            }
          }
        } catch (e) {
          // ignore refetch errors
        }
      } else {
        setMsg(data?.error || "Failed to generate preview");
      }
    } catch (err: any) {
      setMsg(err?.message || "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label>Live URL</label>
      <input value={liveUrl} onChange={(e) => setLiveUrl(e.target.value)} style={{ width: "100%" }} />
      <div style={{ marginTop: 8 }}>
        <button type="button" onClick={generatePreview} disabled={busy}>{busy ? "Generating…" : "Generate Preview"}</button>
      </div>
      {preview && (
        <div style={{ marginTop: 12 }}>
          <img src={preview} alt="preview" style={{ maxWidth: "100%", borderRadius: 6 }} />
        </div>
      )}
      {msg && <p>{msg}</p>}
    </div>
  );
}
