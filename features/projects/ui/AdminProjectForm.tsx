"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProjectRecord } from "@/features/projects/types";

type Props = {
  id?: string;
  initial?: ProjectRecord;
};

type LinkRow = { platform: string; label: string; url: string };
type ImageRow = { url: string; alt: string; kind: string };

type FormState = {
  slug: string;
  title: string;
  summary: string;
  content: string;
  tags: string;
  tech: string;
  status: "draft" | "published" | "archived";
  featured: boolean;
  sortIndex: string;
  publishedAt: string;
  coverImageUrl: string;
  previewImageUrl: string;
  links: LinkRow[];
  images: ImageRow[];
};

function toDateInput(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function buildInitialState(initial?: ProjectRecord): FormState {
  return {
    slug: initial?.slug ?? "",
    title: initial?.title ?? "",
    summary: initial?.summary ?? "",
    content: initial?.content ?? "",
    tags: (initial?.tags ?? []).join(", "),
    tech: (initial?.tech ?? []).join(", "),
    status: initial?.status ?? "draft",
    featured: !!initial?.featured,
    sortIndex: String(initial?.sortIndex ?? 0),
    publishedAt: toDateInput(initial?.publishedAt),
    coverImageUrl: initial?.coverImageUrl ?? "",
    previewImageUrl: initial?.previewImageUrl ?? "",
    links: initial?.links?.length
      ? initial.links.map((link) => ({ platform: link.platform ?? "", label: link.label ?? "", url: link.url ?? "" }))
      : [{ platform: "", label: "", url: "" }],
    images: initial?.images?.length
      ? initial.images.map((image) => ({ url: image.url ?? "", alt: image.alt ?? "", kind: image.kind ?? "" }))
      : [{ url: "", alt: "", kind: "cover" }],
  };
}

export default function AdminProjectForm({ id, initial }: Props) {
  const router = useRouter();
  const isEdit = Boolean(id);

  const [state, setState] = useState<FormState>(buildInitialState(initial));
  const [saving, setSaving] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    const slugValue = (isEdit ? id ?? "" : state.slug).trim();
    return Boolean(slugValue && state.title.trim());
  }, [isEdit, id, state.slug, state.title]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  function setLink(index: number, key: keyof LinkRow, value: string) {
    setState((prev) => {
      const links = [...prev.links];
      links[index] = { ...links[index], [key]: value };
      return { ...prev, links };
    });
  }

  function addLink() {
    setState((prev) => ({ ...prev, links: [...prev.links, { platform: "", label: "", url: "" }] }));
  }

  function removeLink(index: number) {
    setState((prev) => ({
      ...prev,
      links: prev.links.length > 1 ? prev.links.filter((_, i) => i !== index) : [{ platform: "", label: "", url: "" }],
    }));
  }

  function setImage(index: number, key: keyof ImageRow, value: string) {
    setState((prev) => {
      const images = [...prev.images];
      images[index] = { ...images[index], [key]: value };
      return { ...prev, images };
    });
  }

  function addImage() {
    setState((prev) => ({ ...prev, images: [...prev.images, { url: "", alt: "", kind: "gallery" }] }));
  }

  function removeImage(index: number) {
    setState((prev) => ({
      ...prev,
      images: prev.images.length > 1 ? prev.images.filter((_, i) => i !== index) : [{ url: "", alt: "", kind: "cover" }],
    }));
  }

  async function uploadImage(index: number, file: File) {
    setError(null);
    setMessage(null);
    setUploadingIndex(index);

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("slug", (isEdit ? id : state.slug) || state.title || "project");

      const res = await fetch("/api/admin/projects/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Upload failed");
      }

      setImage(index, "url", data.url);
      if (!state.coverImageUrl) setField("coverImageUrl", data.url);
      setMessage("Image uploaded successfully.");
    } catch (err: unknown) {
      setError((err as Error)?.message ?? "Upload failed");
    } finally {
      setUploadingIndex(null);
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!canSubmit) {
      setError("Slug and Title are required.");
      return;
    }

    const links = state.links
      .map((link) => ({ platform: link.platform.trim(), label: link.label.trim() || undefined, url: link.url.trim() }))
      .filter((link) => link.platform && link.url);

    const images = state.images
      .map((image) => ({ url: image.url.trim(), alt: image.alt.trim() || undefined, kind: image.kind.trim() || undefined }))
      .filter((image) => image.url);

    const payload = {
      ...(isEdit ? {} : { slug: state.slug.trim() }),
      title: state.title.trim(),
      summary: state.summary.trim() || undefined,
      content: state.content,
      tags: state.tags.split(",").map((item) => item.trim()).filter(Boolean),
      tech: state.tech.split(",").map((item) => item.trim()).filter(Boolean),
      links,
      images,
      coverImageUrl: state.coverImageUrl.trim() || undefined,
      previewImageUrl: state.previewImageUrl.trim() || undefined,
      status: state.status,
      featured: state.featured,
      sortIndex: Number.isNaN(Number(state.sortIndex)) ? 0 : Number(state.sortIndex),
      publishedAt: state.publishedAt ? new Date(state.publishedAt).toISOString() : undefined,
    };

    setSaving(true);
    try {
      const url = isEdit ? `/api/admin/projects/${id}` : "/api/admin/projects";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ? JSON.stringify(data.error) : "Failed to save project");
      }

      setMessage(isEdit ? "Project updated." : "Project created.");
      const savedSlug = data?.item?.slug;
      if (!isEdit && savedSlug) {
        router.push(`/admin/dashboard/projects/${savedSlug}`);
      }
      router.refresh();
    } catch (err: unknown) {
      setError((err as Error)?.message ?? "Request failed");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!id) return;
    if (!window.confirm("Delete this project?")) return;

    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/projects/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ?? "Delete failed");
      }
      router.push("/admin/dashboard/projects");
      router.refresh();
    } catch (err: unknown) {
      setError((err as Error)?.message ?? "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {!isEdit ? (
          <label className="space-y-2">
            <span className="text-sm font-medium">Slug *</span>
            <input value={state.slug} onChange={(e) => setField("slug", e.target.value)} required className="w-full bg-muted/50 border rounded-lg px-3 py-2 text-sm" />
          </label>
        ) : (
          <div className="space-y-2">
            <span className="text-sm font-medium">Slug</span>
            <input value={id ?? ""} readOnly className="w-full bg-muted/30 border rounded-lg px-3 py-2 text-sm text-muted-foreground" />
          </div>
        )}

        <label className="space-y-2">
          <span className="text-sm font-medium">Title *</span>
          <input value={state.title} onChange={(e) => setField("title", e.target.value)} required className="w-full bg-muted/50 border rounded-lg px-3 py-2 text-sm" />
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-medium">Summary</span>
          <textarea value={state.summary} onChange={(e) => setField("summary", e.target.value)} rows={3} className="w-full bg-muted/50 border rounded-lg px-3 py-2 text-sm" />
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-medium">Content (Markdown/MDX)</span>
          <textarea value={state.content} onChange={(e) => setField("content", e.target.value)} rows={8} className="w-full bg-muted/50 border rounded-lg px-3 py-2 text-sm font-mono" />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium">Tags (comma separated)</span>
          <input value={state.tags} onChange={(e) => setField("tags", e.target.value)} className="w-full bg-muted/50 border rounded-lg px-3 py-2 text-sm" />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium">Tech (comma separated)</span>
          <input value={state.tech} onChange={(e) => setField("tech", e.target.value)} className="w-full bg-muted/50 border rounded-lg px-3 py-2 text-sm" />
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label className="space-y-2">
          <span className="text-sm font-medium">Status</span>
          <select value={state.status} onChange={(e) => setField("status", e.target.value as FormState["status"])} className="w-full bg-muted/50 border rounded-lg px-3 py-2 text-sm">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium">Published At</span>
          <input type="date" value={state.publishedAt} onChange={(e) => setField("publishedAt", e.target.value)} className="w-full bg-muted/50 border rounded-lg px-3 py-2 text-sm" />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium">Sort Index</span>
          <input type="number" value={state.sortIndex} onChange={(e) => setField("sortIndex", e.target.value)} className="w-full bg-muted/50 border rounded-lg px-3 py-2 text-sm" />
        </label>

        <label className="inline-flex items-center gap-2 text-sm font-medium md:col-span-3">
          <input type="checkbox" checked={state.featured} onChange={(e) => setField("featured", e.target.checked)} className="rounded" />
          Featured
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="space-y-2">
          <span className="text-sm font-medium">Cover Image URL</span>
          <input value={state.coverImageUrl} onChange={(e) => setField("coverImageUrl", e.target.value)} className="w-full bg-muted/50 border rounded-lg px-3 py-2 text-sm" />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium">Preview Image URL</span>
          <input value={state.previewImageUrl} onChange={(e) => setField("previewImageUrl", e.target.value)} className="w-full bg-muted/50 border rounded-lg px-3 py-2 text-sm" />
        </label>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Project Links (array)</h3>
          <button type="button" onClick={addLink} className="px-3 py-1.5 border rounded-md text-xs font-medium hover:bg-muted/50">Add Link</button>
        </div>
        <div className="space-y-2">
          {state.links.map((link, idx) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end border rounded-lg p-3">
              <label className="md:col-span-3 space-y-1">
                <span className="text-xs text-muted-foreground">Platform</span>
                <input value={link.platform} onChange={(e) => setLink(idx, "platform", e.target.value)} className="w-full bg-muted/50 border rounded-lg px-2 py-1.5 text-sm" placeholder="web, ios, android" />
              </label>
              <label className="md:col-span-3 space-y-1">
                <span className="text-xs text-muted-foreground">Label</span>
                <input value={link.label} onChange={(e) => setLink(idx, "label", e.target.value)} className="w-full bg-muted/50 border rounded-lg px-2 py-1.5 text-sm" placeholder="Live, App Store" />
              </label>
              <label className="md:col-span-5 space-y-1">
                <span className="text-xs text-muted-foreground">URL</span>
                <input value={link.url} onChange={(e) => setLink(idx, "url", e.target.value)} className="w-full bg-muted/50 border rounded-lg px-2 py-1.5 text-sm" placeholder="https://..." />
              </label>
              <button type="button" onClick={() => removeLink(idx)} className="md:col-span-1 px-2 py-1.5 border rounded-md text-xs hover:bg-red-500/10">Remove</button>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Project Images (array)</h3>
          <button type="button" onClick={addImage} className="px-3 py-1.5 border rounded-md text-xs font-medium hover:bg-muted/50">Add Image</button>
        </div>
        <div className="space-y-2">
          {state.images.map((image, idx) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end border rounded-lg p-3">
              <label className="md:col-span-5 space-y-1">
                <span className="text-xs text-muted-foreground">URL</span>
                <input value={image.url} onChange={(e) => setImage(idx, "url", e.target.value)} className="w-full bg-muted/50 border rounded-lg px-2 py-1.5 text-sm" placeholder="https://assets..." />
              </label>
              <label className="md:col-span-3 space-y-1">
                <span className="text-xs text-muted-foreground">Alt</span>
                <input value={image.alt} onChange={(e) => setImage(idx, "alt", e.target.value)} className="w-full bg-muted/50 border rounded-lg px-2 py-1.5 text-sm" />
              </label>
              <label className="md:col-span-2 space-y-1">
                <span className="text-xs text-muted-foreground">Kind</span>
                <input value={image.kind} onChange={(e) => setImage(idx, "kind", e.target.value)} className="w-full bg-muted/50 border rounded-lg px-2 py-1.5 text-sm" placeholder="cover/gallery/mobile" />
              </label>
              <div className="md:col-span-2 flex gap-2">
                <label className="px-2 py-1.5 border rounded-md text-xs hover:bg-muted/50 cursor-pointer">
                  Upload
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadImage(idx, file);
                    }}
                    disabled={uploadingIndex === idx}
                  />
                </label>
                <button type="button" onClick={() => removeImage(idx)} className="px-2 py-1.5 border rounded-md text-xs hover:bg-red-500/10">Remove</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {(error || message) && (
        <div className={`rounded-lg border px-3 py-2 text-sm ${error ? "border-red-500/30 bg-red-500/10 text-red-600" : "border-green-500/30 bg-green-500/10 text-green-700"}`}>
          {error ?? message}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div>
          {isEdit ? (
            <button type="button" onClick={onDelete} disabled={saving} className="px-4 py-2 rounded-lg border border-red-500/30 text-red-600 hover:bg-red-500/10 text-sm font-medium disabled:opacity-50">
              Delete
            </button>
          ) : null}
        </div>

        <button type="submit" disabled={saving || !canSubmit} className="px-4 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
          {saving ? "Saving..." : isEdit ? "Save Project" : "Create Project"}
        </button>
      </div>
    </form>
  );
}
