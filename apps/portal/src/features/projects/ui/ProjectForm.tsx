"use client";

import { useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ProjectRecord, ProjectKind, CreateProjectInput } from "@ugur/server";
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
  EyeOff,
  Save,
  ArrowLeft,
  FileText,
  Type,
  Code,
  Tag,
  Link as LinkIcon,
  Sparkles,
  Calendar
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
  const [state, setState] = useState<FormState>(() => buildInitialState(initial));
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!id;

  const handleSave = async () => {
    setLoading(true);
    setError(null);

    const payload: CreateProjectInput = {
      slug: state.slug.trim(),
      title: state.title.trim(),
      summary: state.summary.trim() || null,
      content: state.content.trim() || null,
      tags: state.tags.split(",").map(t => t.trim()).filter(Boolean),
      tech: state.tech.split(",").map(t => t.trim()).filter(Boolean),
      status: state.status,
      featured: state.featured,
      isSecret: state.isSecret,
      kinds: state.kinds,
      sortIndex: parseInt(state.sortIndex) || 0,
      publishedAt: state.publishedAt ? new Date(state.publishedAt).toISOString() : null,
      coverImageUrl: state.coverImageUrl || null,
      previewImageUrl: state.previewImageUrl || null,
      links: state.links
        .filter(l => l.url.trim())
        .map(l => ({
          platform: l.platform.trim() || "link",
          label: l.label.trim() || undefined,
          url: l.url.trim(),
          kind: l.kind || undefined
        })),
      images: state.images
        .filter(img => img.url.trim())
        .map(img => ({
          url: img.url.trim(),
          alt: img.alt.trim() || undefined,
          kind: (img.kind as any) || undefined
        })),
    };

    try {
      const url = isEdit ? `/api/projects/${id}` : "/api/projects";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to save");
      }

      router.push("/admin/projects");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const refreshPreview = async () => {
    if (!isEdit) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${id}/preview`, { method: "POST" });
      const data = await res.json();
      if (data.ok && data.url) {
        setState(s => ({ ...s, previewImageUrl: data.url }));
      } else {
        setError(data.error || "Failed to refresh preview");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.back()}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {isEdit ? "Edit Project" : "New Project"}
            </h1>
            <p className="text-muted-foreground">Portfolio item & Case Study unifier.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-foreground text-background rounded-xl font-medium hover:opacity-90 transition-all disabled:opacity-50 shadow-sm"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Project
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-medium">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <div className="p-6 bg-card border rounded-2xl shadow-sm space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold flex items-center gap-2">
                  <Type className="w-4 h-4" /> Title
                </label>
                <input
                  value={state.title}
                  onChange={(e) => setState(s => ({ ...s, title: e.target.value }))}
                  placeholder="e.g. My Awesome Project"
                  className="w-full px-4 py-2.5 rounded-xl border bg-background focus:ring-2 focus:ring-foreground/10 outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold flex items-center gap-2">
                  <Code className="w-4 h-4" /> Slug
                </label>
                <input
                  value={state.slug}
                  onChange={(e) => setState(s => ({ ...s, slug: e.target.value }))}
                  placeholder="my-awesome-project"
                  className="w-full px-4 py-2.5 rounded-xl border bg-background font-mono text-xs focus:ring-2 focus:ring-foreground/10 outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4" /> Summary (Short description)
              </label>
              <textarea
                value={state.summary}
                onChange={(e) => setState(s => ({ ...s, summary: e.target.value }))}
                rows={2}
                placeholder="A one-sentence summary for project lists..."
                className="w-full px-4 py-3 rounded-xl border bg-background focus:ring-2 focus:ring-foreground/10 outline-none transition-all resize-none"
              />
            </div>
          </div>

          {/* Long Form Content (Case Study) */}
          <div className="p-6 bg-card border rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
                <FileText className="w-4 h-4" /> Case Study Content (MDX)
              </label>
              <div className="text-[10px] font-bold text-blue-500 uppercase tracking-tighter">Optional</div>
            </div>
            <textarea
              value={state.content}
              onChange={(e) => setState(s => ({ ...s, content: e.target.value }))}
              rows={12}
              placeholder="# Problem\nDescribe the challenge...\n\n# Solution\nHow you solved it..."
              className="w-full px-4 py-3 rounded-xl border bg-background font-mono text-sm focus:ring-2 focus:ring-foreground/10 outline-none transition-all"
            />
          </div>

          {/* Platforms & Tech */}
          <div className="p-6 bg-card border rounded-2xl shadow-sm space-y-6">
             <div className="space-y-4">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Platforms</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {KINDS.map((kind) => (
                    <button
                      key={kind.value}
                      onClick={() => {
                        const next = state.kinds.includes(kind.value)
                          ? state.kinds.filter(k => k !== kind.value)
                          : [...state.kinds, kind.value];
                        setState(s => ({ ...s, kinds: next }));
                      }}
                      className={cn(
                        "flex flex-col items-center justify-center p-4 rounded-xl border transition-all gap-2",
                        state.kinds.includes(kind.value)
                          ? "bg-foreground text-background border-foreground shadow-md"
                          : "hover:border-foreground/20 hover:bg-muted/50"
                      )}
                    >
                      <kind.icon className="w-5 h-5" />
                      <span className="text-xs font-medium">{kind.label}</span>
                    </button>
                  ))}
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                <div className="space-y-2">
                  <label className="text-sm font-semibold flex items-center gap-2">
                    <Tag className="w-4 h-4" /> Tags
                  </label>
                  <input
                    value={state.tags}
                    onChange={(e) => setState(s => ({ ...s, tags: e.target.value }))}
                    placeholder="react, typescript, nodejs"
                    className="w-full px-4 py-2.5 rounded-xl border bg-background text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold flex items-center gap-2">
                    <Code className="w-4 h-4" /> Tech Stack
                  </label>
                  <input
                    value={state.tech}
                    onChange={(e) => setState(s => ({ ...s, tech: e.target.value }))}
                    placeholder="Tailwind, Next.js, MongoDB"
                    className="w-full px-4 py-2.5 rounded-xl border bg-background text-sm"
                  />
                </div>
             </div>
          </div>

          {/* Links */}
          <div className="p-6 bg-card border rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Project Links</label>
              <button
                onClick={() => setState(s => ({ ...s, links: [...s.links, { platform: "", label: "", url: "", kind: "" }] }))}
                className="p-1.5 hover:bg-muted rounded-lg transition-colors text-blue-500"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              {state.links.map((link, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-muted/30 rounded-xl border relative group">
                  <button
                    onClick={() => setState(s => ({ ...s, links: s.links.filter((_, i) => i !== idx) }))}
                    className="absolute -right-2 -top-2 w-6 h-6 bg-red-500 text-white rounded-full items-center justify-center hidden group-hover:flex shadow-md"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <input
                    placeholder="Platform (e.g. Live, GitHub)"
                    value={link.platform}
                    onChange={(e) => {
                      const newLinks = [...state.links];
                      newLinks[idx].platform = e.target.value;
                      setState(s => ({ ...s, links: newLinks }));
                    }}
                    className="px-3 py-2 text-xs rounded-lg border bg-background outline-none"
                  />
                  <input
                    placeholder="Label (optional)"
                    value={link.label}
                    onChange={(e) => {
                      const newLinks = [...state.links];
                      newLinks[idx].label = e.target.value;
                      setState(s => ({ ...s, links: newLinks }));
                    }}
                    className="px-3 py-2 text-xs rounded-lg border bg-background outline-none"
                  />
                  <input
                    placeholder="https://..."
                    value={link.url}
                    onChange={(e) => {
                      const newLinks = [...state.links];
                      newLinks[idx].url = e.target.value;
                      setState(s => ({ ...s, links: newLinks }));
                    }}
                    className="px-3 py-2 text-xs rounded-lg border bg-background outline-none"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status & Featured */}
          <div className="p-6 bg-card border rounded-2xl shadow-sm space-y-6">
            <div className="space-y-4">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Publishing</label>
              <select
                value={state.status}
                onChange={(e) => setState(s => ({ ...s, status: e.target.value as any }))}
                className="w-full px-4 py-2.5 rounded-xl border bg-background focus:ring-2 focus:ring-foreground/10 outline-none font-medium"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
              
              <button
                onClick={() => setState(s => ({ ...s, featured: !s.featured }))}
                className={cn(
                  "w-full flex items-center justify-between p-4 rounded-xl border transition-all",
                  state.featured ? "bg-yellow-50 border-yellow-200 text-yellow-700" : "hover:bg-muted"
                )}
              >
                <div className="flex items-center gap-3">
                  <Star className={cn("w-5 h-5", state.featured && "fill-current")} />
                  <span className="font-semibold text-sm">Selected Work</span>
                </div>
                <div className={cn(
                  "w-10 h-5 rounded-full relative transition-colors",
                  state.featured ? "bg-yellow-400" : "bg-muted-foreground/20"
                )}>
                  <div className={cn(
                    "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                    state.featured ? "right-1" : "left-1"
                  )} />
                </div>
              </button>
            </div>
          </div>

          {/* Time & Sorting */}
          <div className="p-6 bg-card border rounded-2xl shadow-sm space-y-6">
             <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Published Date
                </label>
                <input
                  type="date"
                  value={state.publishedAt}
                  onChange={(e) => setState(s => ({ ...s, publishedAt: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border bg-background"
                />
             </div>
             <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <ChevronUp className="w-4 h-4" /> Sort Priority
                </label>
                <input
                  type="number"
                  value={state.sortIndex}
                  onChange={(e) => setState(s => ({ ...s, sortIndex: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border bg-background"
                />
             </div>
          </div>

          {/* Preview Image */}
          <div className="p-6 bg-card border rounded-2xl shadow-sm space-y-4">
             <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" /> Preview Image
                </label>
                {isEdit && (
                   <button
                    onClick={refreshPreview}
                    disabled={busy}
                    className="p-1.5 hover:bg-muted rounded-lg transition-colors text-blue-500"
                    title="Generate screenshot"
                   >
                     {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                   </button>
                )}
             </div>
             
             {state.previewImageUrl ? (
                <div className="relative group aspect-video rounded-xl overflow-hidden border">
                   <img src={state.previewImageUrl} alt="Preview" className="w-full h-full object-cover" />
                   <button
                    onClick={() => setState(s => ({ ...s, previewImageUrl: "" }))}
                    className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                   >
                     <X className="w-3 h-3" />
                   </button>
                </div>
             ) : (
                <div className="aspect-video rounded-xl border border-dashed flex flex-col items-center justify-center text-muted-foreground bg-muted/20">
                   <ImageIcon className="w-8 h-8 opacity-20 mb-2" />
                   <span className="text-[10px] font-bold uppercase tracking-tighter">No Preview</span>
                </div>
             )}
             
             <input
                value={state.previewImageUrl}
                onChange={(e) => setState(s => ({ ...s, previewImageUrl: e.target.value }))}
                placeholder="Manual URL..."
                className="w-full px-3 py-2 text-[10px] font-mono rounded-lg border bg-background"
             />
          </div>

          {/* Visibility */}
          <div className="p-6 bg-card border rounded-2xl shadow-sm space-y-4">
             <button
                onClick={() => setState(s => ({ ...s, isSecret: !s.isSecret }))}
                className={cn(
                  "w-full flex items-center justify-between p-3 rounded-xl border transition-all",
                  state.isSecret ? "bg-red-50 border-red-200 text-red-700" : "hover:bg-muted opacity-60"
                )}
              >
                <div className="flex items-center gap-3">
                  {state.isSecret ? <Lock className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  <span className="font-semibold text-xs uppercase tracking-tight">Secret Project</span>
                </div>
                {state.isSecret ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </button>
          </div>
        </div>
      </div>
    </div>
  );
}
