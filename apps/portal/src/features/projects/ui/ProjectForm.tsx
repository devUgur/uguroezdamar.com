"use client";

import { useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type { ProjectRecord, ProjectKind } from "@/src/features/projects/types";
import { 
  Plus, 
  Trash2, 
  Star, 
  Eye, 
  Image as ImageIcon, 
  Upload, 
  X, 
  Loader2,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  Globe,
  Smartphone,
  Monitor,
  Terminal,
  Lock,
  EyeOff
} from "lucide-react";
import { cn } from "@ugur/core";

type Props = {
  id?: string;
  initial?: ProjectRecord;
};

type LinkRow = { platform: string; label: string; url: string; kind: ProjectKind | "" };
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
  isSecret: boolean;
  kinds: ProjectKind[];
  sortIndex: string;
  publishedAt: string;
  coverImageUrl: string;
  previewImageUrl: string;
  links: LinkRow[];
  images: ImageRow[];
};

const KINDS: { value: ProjectKind; label: string; icon: any }[] = [
  { value: "web", label: "Web App", icon: Globe },
  { value: "mobile", label: "Mobile App", icon: Smartphone },
  { value: "desktop", label: "Desktop App", icon: Monitor },
  { value: "cli", label: "CLI Tool", icon: Terminal },
];

function isProjectKind(value: string): value is ProjectKind {
  return KINDS.some((kind) => kind.value === value);
}

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
    isSecret: !!initial?.isSecret,
    kinds: initial?.kinds ?? ["web"],
    sortIndex: String(initial?.sortIndex ?? 0),
    publishedAt: toDateInput(initial?.publishedAt),
    coverImageUrl: initial?.coverImageUrl ?? "",
    previewImageUrl: initial?.previewImageUrl ?? "",
    links: initial?.links?.length
      ? initial.links.map((link) => ({ 
          platform: link.platform ?? "", 
          label: link.label ?? "", 
          url: link.url ?? "",
          kind: link.kind ?? ""
        }))
      : [{ platform: "", label: "", url: "", kind: "" }],
    images: initial?.images?.length
      ? initial.images.map((image) => ({ url: image.url ?? "", alt: image.alt ?? "", kind: image.kind ?? "" }))
      : [],
  };
}

export default function ProjectForm({ id, initial }: Props) {
  const router = useRouter();
  const isEdit = Boolean(id);

  const [state, setState] = useState<FormState>(buildInitialState(initial));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removingIndex, setRemovingIndex] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSubmit = useMemo(() => {
    const slugValue = (isEdit ? id ?? "" : state.slug).trim();
    return Boolean(slugValue && state.title.trim());
  }, [isEdit, id, state.slug, state.title]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  function setLink<K extends keyof LinkRow>(index: number, key: K, value: LinkRow[K]) {
    setState((prev) => {
      const links = [...prev.links];
      links[index] = { ...links[index], [key]: value };
      return { ...prev, links };
    });
  }

  function addLink() {
    setState((prev) => ({ ...prev, links: [...prev.links, { platform: "", label: "", url: "", kind: "" }] }));
  }

  function toggleKind(kind: ProjectKind) {
    setState(prev => {
      const kinds = prev.kinds.includes(kind) 
        ? prev.kinds.filter(k => k !== kind)
        : [...prev.kinds, kind];
      return { ...prev, kinds };
    });
  }

  function removeLink(index: number) {
    setState((prev) => ({
      ...prev,
      links: prev.links.length > 1 ? prev.links.filter((_, i) => i !== index) : [{ platform: "", label: "", url: "", kind: "" }],
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

  async function deleteAssetByUrl(url: string) {
    if (!url) return;
    const res = await fetch("/api/admin/projects/assets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error ?? "Asset delete failed");
    }
  }

  async function removeImage(index: number) {
    const current = state.images[index];
    if (!current) return;

    if (!window.confirm("Dieses Bild wirklich löschen?")) return;

    setError(null);
    setMessage(null);
    setRemovingIndex(index);

    try {
      if (isEdit && current.url) {
        await deleteAssetByUrl(current.url);
      }

      setState((prev) => {
        const newImages = prev.images.filter((_, i) => i !== index);
        const newState = {
          ...prev,
          images: newImages.length > 0 ? newImages : [{ url: "", alt: "", kind: "gallery" }],
        };

        if (prev.coverImageUrl === current.url) newState.coverImageUrl = "";
        if (prev.previewImageUrl === current.url) newState.previewImageUrl = "";
        
        return newState;
      });

      setMessage("Bild erfolgreich entfernt.");
    } catch (err: unknown) {
      setError((err as Error)?.message ?? "Löschen fehlgeschlagen");
    } finally {
      setRemovingIndex(null);
    }
  }

  async function clearAssetField(field: "coverImageUrl" | "previewImageUrl") {
    const url = state[field].trim();
    if (!url) {
      setField(field, "");
      return;
    }

    setError(null);
    setMessage(null);
    try {
      if (isEdit) {
        await deleteAssetByUrl(url);
      }
      setField(field, "");
      setMessage("Asset entfernt.");
    } catch (err: unknown) {
      setError((err as Error)?.message ?? "Löschen fehlgeschlagen");
    }
  }

  async function handleMultiUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    
    setError(null);
    setMessage(null);
    setUploading(true);

    const uploadedUrls: string[] = [];

    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        form.append("slug", (isEdit ? id : state.slug) || state.title || "project");

        const res = await fetch("/api/admin/projects/upload", {
          method: "POST",
          body: form,
        });
        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.ok) {
          throw new Error(data?.error || "Upload fehlgeschlagen");
        }
        uploadedUrls.push(data.url);
      }

      setState((prev) => {
        // Filter out the empty initial row if it exists
        const currentImages = prev.images.filter(img => img.url);
        const newImages = [
          ...currentImages,
          ...uploadedUrls.map(url => ({ url, alt: "", kind: "gallery" }))
        ];
        
        const newState = { ...prev, images: newImages };
        
        // Auto-set cover and preview if not already set
        if (!prev.coverImageUrl && uploadedUrls.length > 0) {
          newState.coverImageUrl = uploadedUrls[0];
          newImages[currentImages.length].kind = "cover";
        }
        if (!prev.previewImageUrl && uploadedUrls.length > 0) {
          newState.previewImageUrl = uploadedUrls[0];
        }

        return newState;
      });

      setMessage(`${uploadedUrls.length} Bilder erfolgreich hochgeladen.`);
    } catch (err: unknown) {
      setError((err as Error)?.message ?? "Upload fehlgeschlagen");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function toggleCover(url: string) {
    setState(prev => {
      const isCurrentlyCover = prev.coverImageUrl === url;
      const newCoverUrl = isCurrentlyCover ? "" : url;
      
      const newImages = prev.images.map(img => ({
        ...img,
        kind: img.url === newCoverUrl ? "cover" : (img.kind === "cover" ? "gallery" : img.kind)
      }));

      return {
        ...prev,
        coverImageUrl: newCoverUrl,
        images: newImages
      };
    });
  }

  function togglePreview(url: string) {
    setField("previewImageUrl", state.previewImageUrl === url ? "" : url);
  }

  function toggleImageKind(index: number, kind: string) {
    setState(prev => {
      const images = [...prev.images];
      const currentKind = images[index].kind;
      images[index] = { 
        ...images[index], 
        kind: currentKind === kind ? "gallery" : kind 
      };
      return { ...prev, images };
    });
  }

  function moveImage(index: number, direction: "up" | "down") {
    setState(prev => {
      const newImages = [...prev.images];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      
      if (targetIndex < 0 || targetIndex >= newImages.length) return prev;
      
      const temp = newImages[index];
      newImages[index] = newImages[targetIndex];
      newImages[targetIndex] = temp;
      
      return { ...prev, images: newImages };
    });
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
      .map((link) => ({ 
        platform: link.platform.trim(), 
        label: link.label.trim() || undefined, 
        url: link.url.trim(),
        kind: link.kind || undefined
      }))
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
      kinds: state.kinds,
      images,
      coverImageUrl: state.coverImageUrl.trim() || undefined,
      previewImageUrl: state.previewImageUrl.trim() || undefined,
      status: state.status,
      featured: state.featured,
      isSecret: state.isSecret,
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

      {/* Project Types (Kinds) */}
      <div className="space-y-3">
        <span className="text-sm font-medium flex items-center gap-2">
          Project Types (Hover Device Display)
        </span>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {KINDS.map((kind) => {
            const Icon = kind.icon;
            const isSelected = state.kinds.includes(kind.value);
            return (
              <button
                key={kind.value}
                type="button"
                onClick={() => toggleKind(kind.value)}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                  isSelected 
                    ? "bg-foreground text-background border-transparent shadow-md" 
                    : "bg-muted/30 border-muted-foreground/10 text-muted-foreground hover:bg-muted/50"
                )}
              >
                <Icon className={cn("w-5 h-5", isSelected ? "text-background" : "text-muted-foreground")} />
                <span className="text-sm font-medium">{kind.label}</span>
              </button>
            );
          })}
        </div>
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

        <label className="inline-flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={state.featured} onChange={(e) => setField("featured", e.target.checked)} className="rounded" />
          Featured
        </label>

        <label className="inline-flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={state.isSecret} onChange={(e) => setField("isSecret", e.target.checked)} className="rounded" />
          <span className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            Secret Project (Private)
          </span>
        </label>
      </div>

      <div className="space-y-4 border-t pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <ExternalLink className="w-5 h-5" />
              Project Links
            </h3>
            <p className="text-sm text-muted-foreground">Live Demo, GitHub Repository, etc.</p>
          </div>
          <button type="button" onClick={addLink} className="flex items-center gap-2 px-3 py-1.5 border rounded-lg text-xs font-medium hover:bg-muted transition-colors">
            <Plus className="w-4 h-4" />
            Link hinzufügen
          </button>
        </div>
        
        <div className="grid grid-cols-1 gap-3">
          {state.links.map((link, idx) => (
            <div key={idx} className="group flex flex-wrap md:flex-nowrap gap-3 items-end bg-muted/20 border rounded-xl p-4 transition-all hover:bg-muted/30">
              <div className="w-full md:w-40 space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Plattform</span>
                <input value={link.platform} onChange={(e) => setLink(idx, "platform", e.target.value)} className="w-full bg-background border rounded-lg px-3 py-1.5 text-sm" placeholder="web, github, appstore" />
              </div>
              <div className="w-full md:w-40 space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Device</span>
                <select 
                  value={link.kind || ""} 
                  onChange={(e) => setLink(idx, "kind", isProjectKind(e.target.value) ? e.target.value : "")} 
                  className="w-full bg-background border rounded-lg px-3 py-1.5 text-sm"
                >
                  <option value="">Standard</option>
                  <option value="web">Web</option>
                  <option value="mobile">Mobile</option>
                  <option value="desktop">Desktop</option>
                </select>
              </div>
              <div className="w-full md:w-40 space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Label</span>
                <input value={link.label} onChange={(e) => setLink(idx, "label", e.target.value)} className="w-full bg-background border rounded-lg px-3 py-1.5 text-sm" placeholder="Live Demo, Source" />
              </div>
              <div className="w-full md:flex-1 space-y-1">
                <span className="text-xs font-medium text-muted-foreground">URL</span>
                <input value={link.url} onChange={(e) => setLink(idx, "url", e.target.value)} className="w-full bg-background border rounded-lg px-3 py-1.5 text-sm" placeholder="https://..." />
              </div>
              <button 
                type="button" 
                onClick={() => removeLink(idx)} 
                className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                title="Link entfernen"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4 border-t pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              Media & Assets
            </h3>
            <p className="text-sm text-muted-foreground">Bilder hochladen und Cover/Vorschau festlegen.</p>
          </div>
          
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Bilder hinzufügen
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => handleMultiUpload(e.target.files)}
          />
        </div>

        {/* Dropzone area if no images */}
        {state.images.filter(img => img.url).length === 0 && (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center gap-3 bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center group-hover:scale-110 transition-transform">
              <Upload className="w-6 h-6 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="font-medium">Klicke oder ziehe Bilder hierher</p>
              <p className="text-xs text-muted-foreground">Unterstützt PNG, JPG, WebP</p>
            </div>
          </div>
        )}

        {/* Image Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {state.images.filter(img => img.url).map((image, idx) => {
            const isCover = state.coverImageUrl === image.url;
            const isPreview = state.previewImageUrl === image.url;
            
            return (
              <div key={`${image.url}-${idx}`}>
                <div 
                  className={cn(
                    "group relative aspect-square rounded-xl border bg-muted/30 overflow-hidden transition-all",
                    isCover && "ring-2 ring-foreground border-transparent shadow-lg"
                  )}
                >
                  {/* Image Preview */}
                  <img 
                    src={image.url} 
                    alt={image.alt || ""} 
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />

                  {/* Overlays & Controls */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => toggleCover(image.url)}
                          className={cn(
                            "p-1.5 rounded-md transition-colors",
                            isCover ? "bg-foreground text-background" : "bg-background/80 text-foreground hover:bg-background"
                          )}
                          title={isCover ? "Als Cover entfernen" : "Als Cover festlegen"}
                        >
                          <Star className={cn("w-4 h-4", isCover && "fill-current")} />
                        </button>
                        <button
                          type="button"
                          onClick={() => togglePreview(image.url)}
                          className={cn(
                            "p-1.5 rounded-md transition-colors",
                            isPreview ? "bg-blue-600 text-white" : "bg-background/80 text-foreground hover:bg-background"
                          )}
                          title={isPreview ? "Als Vorschau entfernen" : "Als Vorschau festlegen"}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => toggleImageKind(idx, "web")}
                          className={cn(
                            "p-1.5 rounded-md transition-colors",
                            image.kind === "web" ? "bg-indigo-600 text-white" : "bg-background/80 text-foreground hover:bg-background"
                          )}
                          title="Als Web-Device Bild"
                        >
                          <Monitor className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleImageKind(idx, "mobile")}
                          className={cn(
                            "p-1.5 rounded-md transition-colors",
                            image.kind === "mobile" ? "bg-emerald-600 text-white" : "bg-background/80 text-foreground hover:bg-background"
                          )}
                          title="Als Mobile-Device Bild"
                        >
                          <Smartphone className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        disabled={removingIndex === idx}
                        className="p-1.5 rounded-md bg-red-500/80 text-white hover:bg-red-500 transition-colors"
                        title="Bild löschen"
                      >
                        {removingIndex === idx ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>

                    <div className="flex justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => moveImage(idx, "up")}
                        className="p-1 rounded-md bg-background/80 text-foreground hover:bg-background disabled:opacity-30"
                        disabled={idx === 0}
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveImage(idx, "down")}
                        className="p-1 rounded-md bg-background/80 text-foreground hover:bg-background disabled:opacity-30"
                        disabled={idx === state.images.filter(img => img.url).length - 1}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Status Badges */}
                  <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
                    {isCover && (
                      <span className="px-1.5 py-0.5 rounded-md bg-foreground text-background text-[10px] font-bold uppercase tracking-wider">
                        Cover
                      </span>
                    )}
                    {isPreview && (
                      <span className="px-1.5 py-0.5 rounded-md bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider">
                        Preview
                      </span>
                    )}
                    {image.kind === "web" && (
                      <span className="px-1.5 py-0.5 rounded-md bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                        <Monitor className="w-2.5 h-2.5" />
                        Web
                      </span>
                    )}
                    {image.kind === "mobile" && (
                      <span className="px-1.5 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                        <Smartphone className="w-2.5 h-2.5" />
                        Mobile
                      </span>
                    )}
                  </div>
                </div>

                {/* Alt-Text Input below thumbnail */}
                <div className="mt-1 space-y-1">
                  <input 
                    value={image.alt || ""} 
                    onChange={(e) => setImage(idx, "alt", e.target.value)}
                    placeholder="Alt-Text hinzufügen..."
                    className="w-full bg-muted/30 border-none hover:bg-muted/50 focus:bg-background focus:ring-1 focus:ring-foreground rounded px-2 py-1 text-[11px] transition-all"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {(error || message) && (
        <div className={`rounded-lg border px-3 py-2 text-sm flex items-center justify-between ${error ? "border-red-500/30 bg-red-500/10 text-red-600" : "border-green-500/30 bg-green-500/10 text-green-700"}`}>
          <span>{error ?? message}</span>
          <button onClick={() => { setError(null); setMessage(null); }} className="p-1 hover:bg-black/5 rounded">
            <X className="w-3 h-3" />
          </button>
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
