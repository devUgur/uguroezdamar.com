"use client";
import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type WorkStatus = "draft" | "published" | "archived";

type WorkInitial = {
  slug?: string;
  title?: string;
  summary?: string | null;
  content?: string | null;
  tags?: string[];
  links?: { live?: string | null; repo?: string | null; github?: string | null } | null;
  previewImageUrl?: string | null;
  featured?: boolean;
  status?: WorkStatus;
  publishedAt?: string | null;
};

export default function WorkForm({ id, initial }: { id?: string; initial?: WorkInitial }) {
  const router = useRouter();

  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [liveUrl, setLiveUrl] = useState(initial?.links?.live ?? "");
  const [repoUrl, setRepoUrl] = useState(initial?.links?.repo ?? "");
  const [githubUrl, setGithubUrl] = useState(initial?.links?.github ?? "");
  const [status, setStatus] = useState<WorkStatus>(initial?.status ?? "draft");
  const [featured, setFeatured] = useState(!!initial?.featured);
  const [publishedAt, setPublishedAt] = useState(initial?.publishedAt ? new Date(initial.publishedAt).toISOString().slice(0, 10) : "");
  const [preview, setPreview] = useState(initial?.previewImageUrl ?? "");

  const isEdit = Boolean(id);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const canSave = useMemo(() => {
    const slugValue = (isEdit ? id ?? "" : slug).trim();
    return Boolean(slugValue && title.trim());
  }, [isEdit, id, slug, title]);

  async function saveItem(event: React.FormEvent) {
    event.preventDefault();
    setMsg(null);
    if (!canSave) {
      setMsg("Slug and Title are required.");
      return;
    }

    const payload = {
      ...(isEdit ? {} : { slug: slug.trim() }),
      title: title.trim(),
      summary: summary.trim() || undefined,
      content: content.trim() || undefined,
      tags: tags
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      links: {
        live: liveUrl.trim() || undefined,
        repo: repoUrl.trim() || undefined,
        github: githubUrl.trim() || undefined,
      },
      featured,
      status,
      publishedAt: publishedAt ? new Date(publishedAt).toISOString() : undefined,
    };

    setSaving(true);
    try {
      const url = isEdit ? `/api/work-items/${id}` : "/api/work-items";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setMsg(data?.error ? JSON.stringify(data.error) : "Failed to save work item");
        return;
      }

      const saved = data.item;
      setMsg(isEdit ? "Work item saved" : "Work item created");
      if (!isEdit && saved?.slug) {
        router.push(`/admin/work-items/${saved.slug}`);
      }
      router.refresh();
    } catch (err: any) {
      setMsg(err?.message || "Network error");
    } finally {
      setSaving(false);
    }
  }

  async function generatePreview() {
    setMsg(null);
    if (!id) return setMsg("Save item first to generate preview");
    setBusy(true);
    try {
      const res = await fetch(`/api/work-items/${id}/preview`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
      const data = await res.json();
      if (res.ok && data.ok) {
        // optimistic update
        setPreview(data.previewImageUrl);
        setMsg("Preview generated");

        // refetch authoritative work item and update preview (non-blocking)
        try {
          const r2 = await fetch(`/api/work-items/${id}`);
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
    <form onSubmit={saveItem} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {!isEdit ? (
          <label className="space-y-2">
            <span className="text-sm font-medium">Slug *</span>
            <input value={slug} onChange={(e) => setSlug(e.target.value)} className="w-full bg-muted/50 border rounded-lg px-3 py-2 text-sm" placeholder="e.g. viralsync" required />
          </label>
        ) : (
          <div className="space-y-2">
            <span className="text-sm font-medium">Slug</span>
            <input value={id ?? ""} readOnly className="w-full bg-muted/30 border rounded-lg px-3 py-2 text-sm text-muted-foreground" />
          </div>
        )}

        <label className="space-y-2">
          <span className="text-sm font-medium">Title *</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-muted/50 border rounded-lg px-3 py-2 text-sm" required />
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-medium">Summary</span>
          <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} className="w-full bg-muted/50 border rounded-lg px-3 py-2 text-sm" />
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-medium">Content</span>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={8} className="w-full bg-muted/50 border rounded-lg px-3 py-2 text-sm" />
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-medium">Tags (comma separated)</span>
          <input value={tags} onChange={(e) => setTags(e.target.value)} className="w-full bg-muted/50 border rounded-lg px-3 py-2 text-sm" placeholder="nextjs, saas, ai" />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium">Live URL</span>
          <input value={liveUrl} onChange={(e) => setLiveUrl(e.target.value)} className="w-full bg-muted/50 border rounded-lg px-3 py-2 text-sm" placeholder="https://..." />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium">Repo URL</span>
          <input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} className="w-full bg-muted/50 border rounded-lg px-3 py-2 text-sm" placeholder="https://..." />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium">GitHub URL</span>
          <input value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} className="w-full bg-muted/50 border rounded-lg px-3 py-2 text-sm" placeholder="https://github.com/..." />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as WorkStatus)} className="w-full bg-muted/50 border rounded-lg px-3 py-2 text-sm">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium">Published At</span>
          <input type="date" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} className="w-full bg-muted/50 border rounded-lg px-3 py-2 text-sm" />
        </label>

        <label className="inline-flex items-center gap-2 text-sm font-medium md:col-span-2">
          <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="rounded" />
          Featured
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={!canSave || saving} className="px-4 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
          {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Work Item"}
        </button>

        {isEdit ? (
          <button type="button" onClick={generatePreview} disabled={busy || saving} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted/50 disabled:opacity-50">
            {busy ? "Generating…" : "Generate Preview"}
          </button>
        ) : null}
      </div>

      {preview && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Preview</p>
          <img src={preview} alt="preview" className="max-w-full rounded-md border" />
        </div>
      )}

      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
    </form>
  );
}
