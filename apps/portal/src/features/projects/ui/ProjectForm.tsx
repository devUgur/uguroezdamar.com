"use client";

import { useState, useRef } from "react";
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
  GripVertical,
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
  Calendar,
  Laptop,
  Github
} from "lucide-react";
import { cn } from "@ugur/core";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from "@ugur/ui";

type Props = {
  id?: string;
  initial?: ProjectRecord;
};

type ImageRow = { url: string; alt: string };

type PreviewDevice = "default" | "mobile" | "laptop";

function kindToPreviewDevice(kind: ProjectKind): PreviewDevice {
  if (kind === "mobile") return "mobile";
  if (kind === "web" || kind === "desktop") return "laptop";
  return "default";
}

/** One app in the list: kind, repo URL, images, tags, tech. Multiple apps per kind allowed. */
type AppEntry = {
  kind: ProjectKind;
  repoUrl: string;
  images: ImageRow[];
  tags: string[];
  tech: string[];
};

type FormState = {
  slug: string;
  title: string;
  summary: string;
  content: string;
  status: "draft" | "published" | "archived";
  featured: boolean;
  isSecret: boolean;
  /** Main project repo URL */
  repoUrl: string;
  /** List of apps – each with kind, repo URL, images, tags, tech */
  apps: AppEntry[];
  /** Development period: start year */
  yearFrom: number | "";
  /** Development period: end year (empty if ongoing) */
  yearTo: number | "";
  /** Still in development */
  ongoing: boolean;
};

const KINDS: { value: ProjectKind; label: string; icon: any }[] = [
  { value: "web", label: "Web App", icon: Globe },
  { value: "mobile", label: "Mobile App", icon: Smartphone },
  { value: "desktop", label: "Desktop App", icon: Monitor },
  { value: "cli", label: "CLI Tool", icon: Terminal },
];

function buildInitialState(initial?: ProjectRecord): FormState {
  const rawApps = (initial as any)?.apps;
  const projectTags = Array.isArray(initial?.tags) ? initial.tags : [];
  const projectTech = Array.isArray(initial?.tech) ? initial.tech : [];
  const apps: AppEntry[] =
    Array.isArray(rawApps) && rawApps.length > 0
      ? rawApps.map((a: any, i: number) => ({
          kind: a.kind ?? "web",
          repoUrl: a.repoUrl ?? "",
          images: (a.images ?? []).map((img: any) => ({ url: img.url ?? "", alt: img.alt ?? "" })),
          tags: Array.isArray(a.tags) ? [...a.tags] : (i === 0 ? projectTags : []),
          tech: Array.isArray(a.tech) ? [...a.tech] : (i === 0 ? projectTech : []),
        }))
      : ((initial?.kinds ?? ["web"]) as ProjectKind[]).map((kind) => ({
          kind,
          repoUrl: "",
          images: [],
          tags: [],
          tech: [],
        }));

  const init = initial as any;
  const yFrom = init?.yearFrom != null ? Number(init.yearFrom) : "";
  const yTo = init?.yearTo != null ? Number(init.yearTo) : "";
  const ongoing = !!init?.ongoing;
  let yearFrom: number | "" = yFrom;
  let yearTo: number | "" = yTo;
  if (yearFrom === "" && initial?.publishedAt) {
    const d = new Date(initial.publishedAt);
    if (!Number.isNaN(d.getFullYear())) yearFrom = d.getFullYear();
  }

  return {
    slug: initial?.slug ?? "",
    title: initial?.title ?? "",
    summary: initial?.summary ?? "",
    content: initial?.content ?? "",
    status: initial?.status ?? "draft",
    featured: !!initial?.featured,
    isSecret: !!initial?.isSecret,
    repoUrl: (initial as any)?.repoUrl ?? "",
    apps,
    yearFrom,
    yearTo: ongoing ? "" : yearTo,
    ongoing,
  };
}

export default function ProjectForm({ id, initial }: Props) {
  const router = useRouter();
  const [state, setState] = useState<FormState>(() => buildInitialState(initial));
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [uploadingAppIndex, setUploadingAppIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetAppIndexRef = useRef<number | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; kind?: ProjectKind } | null>(null);
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>("default");
  const [draggedImage, setDraggedImage] = useState<{ appIndex: number; imgIndex: number } | null>(null);

  const isEdit = !!id;

  const reorderAppImages = (appIndex: number, fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setState((s) => {
      const next = [...s.apps];
      const imgs = [...next[appIndex].images];
      const [removed] = imgs.splice(fromIndex, 1);
      imgs.splice(toIndex, 0, removed);
      next[appIndex] = { ...next[appIndex], images: imgs };
      return { ...s, apps: next };
    });
  };

  const slugForUpload = state.slug.trim() || "project";

  const uploadOne = async (appIndex: number, file: File): Promise<string | null> => {
    const kind = state.apps[appIndex]?.kind ?? "web";
    const formData = new FormData();
    formData.set("file", file);
    formData.set("slug", slugForUpload);
    formData.set("kind", kind);
    const res = await fetch("/api/projects/uploads", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok || !data.url) throw new Error(typeof data.error === "string" ? data.error : "Upload failed");
    return data.url;
  };

  const handleAppImageUpload = async (appIndex: number, files: File | File[]) => {
    const fileList = Array.isArray(files) ? files : [files];
    if (fileList.length === 0) return;
    setUploadingAppIndex(appIndex);
    setError(null);
    try {
      const urls: string[] = [];
      for (const file of fileList) {
        const url = await uploadOne(appIndex, file);
        if (url) urls.push(url);
      }
      if (urls.length > 0) {
        setState((s) => {
          const next = [...s.apps];
          if (!next[appIndex]) return s;
          const newImages = urls.map((url) => ({ url, alt: "" }));
          next[appIndex] = { ...next[appIndex], images: [...next[appIndex].images, ...newImages] };
          return { ...s, apps: next };
        });
        toast.success(urls.length === 1 ? "Image uploaded" : `${urls.length} images uploaded`);
      }
    } catch (err: any) {
      const msg = err?.message && typeof err.message === "string" ? err.message : "Upload failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setUploadingAppIndex(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  function getErrorMessage(err: unknown): string {
    if (err && typeof err === "object" && "message" in err && typeof (err as Error).message === "string")
      return (err as Error).message;
    if (typeof err === "string") return err;
    return "Something went wrong";
  }

  const handleSave = async () => {
    setError(null);
    setFieldErrors({});

    const errors: Record<string, string> = {};
    if (!state.title.trim()) errors.title = "Title is required";
    if (!state.slug.trim()) errors.slug = "Slug is required";
    const slugBad = /[^a-z0-9-]/.test(state.slug.trim());
    if (state.slug.trim() && slugBad) errors.slug = "Slug must be lowercase letters, numbers, and hyphens only";
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError("Please fix the errors below.");
      toast.error("Please fix the errors below.");
      return;
    }

    setLoading(true);

    const payload: CreateProjectInput = {
      slug: state.slug.trim(),
      title: state.title.trim(),
      summary: state.summary.trim() || null,
      content: state.content.trim() || null,
      tags: [...new Set(state.apps.flatMap((a) => a.tags).filter((t) => t.trim().length > 0))],
      tech: [...new Set(state.apps.flatMap((a) => a.tech).filter((t) => t.trim().length > 0))],
      status: state.status,
      featured: state.featured,
      isSecret: state.isSecret,
      kinds: [...new Set(state.apps.map((a) => a.kind))],
      repoUrl: state.repoUrl.trim() || null,
      apps: state.apps.map((app) => ({
        kind: app.kind,
        repoUrl: app.repoUrl.trim() || null,
        images: app.images.filter((img) => img.url.trim()).map((img) => ({ url: img.url.trim(), alt: img.alt.trim() || undefined })),
        tags: app.tags.filter((t) => t.trim().length > 0),
        tech: app.tech.filter((t) => t.trim().length > 0),
      })),
      sortIndex: 0,
      publishedAt: state.ongoing
        ? null
        : (state.yearTo ? new Date(Number(state.yearTo), 11, 31) : state.yearFrom ? new Date(Number(state.yearFrom), 0, 1) : null)?.toISOString() ?? null,
      yearFrom: state.yearFrom === "" ? null : Number(state.yearFrom),
      yearTo: state.ongoing || state.yearTo === "" ? null : Number(state.yearTo),
      ongoing: state.ongoing,
      coverImageUrl: null,
      previewImageUrl: null,
      links: [],
      images: [],
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
        const apiError = data.error;
        const msg =
          typeof apiError === "string"
            ? apiError
            : typeof apiError === "object" && apiError !== null
              ? (apiError as { _errors?: string[] })._errors?.join("; ") || "Validation failed"
              : "Failed to save";
        const serverErrors: Record<string, string> = {};
        if (typeof apiError === "string" && (apiError.includes("title") || apiError.includes("slug"))) {
          if (apiError.includes("title")) serverErrors.title = "Title is required";
          if (apiError.includes("slug")) serverErrors.slug = serverErrors.slug || "Slug is required";
        }
        setFieldErrors((prev) => ({ ...prev, ...serverErrors }));
        setError(msg);
        toast.error(msg);
        return;
      }

      toast.success("Project saved");
      router.push("/admin/projects");
      router.refresh();
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-24">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          const index = uploadTargetAppIndexRef.current;
          if (files?.length && index !== null) {
            handleAppImageUpload(index, Array.from(files));
            uploadTargetAppIndexRef.current = null;
          }
        }}
      />
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
            <p className="text-muted-foreground text-sm">
              {isEdit ? "Update content and assets for this project." : "Create a project with apps, repo URLs, and images."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={loading}
            className="portal-btn-primary-lg gap-2 px-6 py-2.5"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Project
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium" role="alert">
          {typeof error === "string" ? error : "Something went wrong"}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <div className="p-6 bg-card border rounded-2xl shadow-sm space-y-6">
            {/* Shared input height for consistency */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold flex items-center gap-2">
                  <Type className="w-4 h-4" /> Title
                </label>
                <input
                  value={state.title}
                  onChange={(e) => {
                    setState(s => ({ ...s, title: e.target.value }));
                    if (fieldErrors.title) setFieldErrors((prev) => ({ ...prev, title: "" }));
                  }}
                  placeholder="e.g. My Awesome Project"
                  className={cn(
                    "w-full h-11 px-4 rounded-xl border bg-background text-sm focus:ring-2 focus:ring-foreground/10 outline-none transition-all",
                    fieldErrors.title && "border-red-500/50 focus:ring-red-500/20"
                  )}
                />
                {fieldErrors.title && (
                  <p className="text-xs text-red-600" role="alert">{fieldErrors.title}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold flex items-center gap-2">
                  <Code className="w-4 h-4" /> Slug
                </label>
                <input
                  value={state.slug}
                  onChange={(e) => {
                    setState(s => ({ ...s, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") }));
                    if (fieldErrors.slug) setFieldErrors((prev) => ({ ...prev, slug: "" }));
                  }}
                  placeholder="my-awesome-project"
                  className={cn(
                    "w-full h-11 px-4 rounded-xl border bg-background text-sm font-mono focus:ring-2 focus:ring-foreground/10 outline-none transition-all",
                    fieldErrors.slug && "border-red-500/50 focus:ring-red-500/20"
                  )}
                />
                {fieldErrors.slug && (
                  <p className="text-xs text-red-600" role="alert">{fieldErrors.slug}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4" /> Summary
              </label>
              <textarea
                value={state.summary}
                onChange={(e) => setState((s) => ({ ...s, summary: e.target.value }))}
                rows={2}
                placeholder="A one-sentence summary for project lists..."
                className="w-full min-h-[5.5rem] px-4 py-3 rounded-xl border bg-background text-sm focus:ring-2 focus:ring-foreground/10 outline-none transition-all resize-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold flex items-center gap-2">
                <LinkIcon className="w-4 h-4" /> Project repo URL
              </label>
              <input
                value={state.repoUrl}
                onChange={(e) => setState((s) => ({ ...s, repoUrl: e.target.value }))}
                placeholder="https://github.com/org/project"
                className="w-full h-11 px-4 rounded-xl border bg-background text-sm focus:ring-2 focus:ring-foreground/10 outline-none transition-all"
              />
            </div>
          </div>

          {/* Apps + Tags & Tech */}
          <div className="p-6 bg-card border rounded-2xl shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Apps</label>
              <button
                type="button"
                onClick={() => setState((s) => ({ ...s, apps: [...s.apps, { kind: "web", repoUrl: "", images: [], tags: [], tech: [] }] }))}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-background text-sm font-medium hover:bg-muted/50 transition-colors"
              >
                <Plus className="w-4 h-4" /> Add app
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Add one entry per app (e.g. Web, Portal, Mobile). Each can have its own kind, repo URL, and images.
            </p>

            {state.apps.map((app, appIndex) => {
              const meta = KINDS.find((k) => k.value === app.kind)!;
              const isUploading = uploadingAppIndex === appIndex;
              return (
                <div key={appIndex} className="p-4 rounded-xl border bg-muted/20 space-y-4 relative group/app">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 font-semibold text-sm">
                      <meta.icon className="w-4 h-4 text-muted-foreground" />
                      <Select
                        value={app.kind}
                        onValueChange={(value) =>
                          setState((s) => {
                            const next = [...s.apps];
                            next[appIndex] = { ...next[appIndex], kind: value as ProjectKind };
                            return { ...s, apps: next };
                          })
                        }
                      >
                        <SelectTrigger className="w-[140px] h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {KINDS.map((k) => (
                            <SelectItem key={k.value} value={k.value}>
                              {k.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <button
                      type="button"
                      onClick={() => setState((s) => ({ ...s, apps: s.apps.filter((_, i) => i !== appIndex) }))}
                      className="ml-auto p-1.5 rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors"
                      title="Remove app"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Repo URL</label>
                    <div className="flex gap-2">
                      <input
                        value={app.repoUrl}
                        onChange={(e) => {
                          const next = [...state.apps];
                          next[appIndex] = { ...next[appIndex], repoUrl: e.target.value };
                          setState((s) => ({ ...s, apps: next }));
                        }}
                        placeholder="https://github.com/org/repo"
                        className="flex-1 min-w-0 h-11 px-4 rounded-xl border bg-background text-sm focus:ring-2 focus:ring-foreground/10 outline-none transition-all"
                      />
                      <button
                        type="button"
                        disabled
                        title="Import from GitHub (coming soon)"
                        className="shrink-0 inline-flex items-center gap-2 h-11 px-4 rounded-xl border border-dashed bg-muted/50 text-muted-foreground text-sm font-medium cursor-not-allowed"
                      >
                        <Github className="w-4 h-4" /> Import with GitHub
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Images</label>
                    <p className="text-[11px] text-muted-foreground/80">Multiple select · drag to reorder · click to preview</p>
                    <div className="flex flex-wrap gap-3">
                      {app.images.map((img, idx) => (
                        <div
                          key={idx}
                          draggable
                          onDragStart={(e) => {
                            setDraggedImage({ appIndex, imgIndex: idx });
                            e.dataTransfer.setData("application/json", JSON.stringify({ appIndex, imgIndex: idx }));
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onDragEnd={() => setDraggedImage(null)}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "move";
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const data = JSON.parse(e.dataTransfer.getData("application/json")) as { appIndex: number; imgIndex: number };
                            if (data.appIndex === appIndex) reorderAppImages(appIndex, data.imgIndex, idx);
                            setDraggedImage(null);
                          }}
                          className={cn(
                            "relative group cursor-grab active:cursor-grabbing rounded-lg overflow-hidden bg-muted/50 transition-opacity",
                            draggedImage?.appIndex === appIndex && draggedImage?.imgIndex === idx && "opacity-50"
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => {
                            setPreviewImage({ url: img.url, kind: app.kind });
                            setPreviewDevice(kindToPreviewDevice(app.kind));
                          }}
                            className="block w-24 h-24 overflow-hidden ring-0 hover:ring-2 hover:ring-primary/40 focus:outline-none focus:ring-2 focus:ring-primary rounded-lg"
                          >
                            <img src={img.url} alt={img.alt || ""} className="w-full h-full object-cover" />
                          </button>
                          <div className="absolute top-1 left-1 w-7 h-7 rounded bg-black/50 flex items-center justify-center pointer-events-none">
                            <GripVertical className="w-4 h-4 text-white" />
                          </div>
                          {idx === 0 && (
                            <span className="absolute bottom-1 left-1 right-1 text-center text-[10px] font-semibold uppercase tracking-wider text-white bg-black/60 rounded py-0.5 pointer-events-none">
                              Main
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setState((s) => {
                                const next = [...s.apps];
                                next[appIndex] = { ...next[appIndex], images: next[appIndex].images.filter((_, i) => i !== idx) };
                                return { ...s, apps: next };
                              });
                            }}
                            className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          uploadTargetAppIndexRef.current = appIndex;
                          fileInputRef.current?.click();
                        }}
                        disabled={isUploading}
                        className="w-24 h-24 rounded-lg border border-dashed border-muted-foreground/30 flex flex-col items-center justify-center text-muted-foreground hover:border-foreground/40 hover:bg-muted/40 transition-colors shrink-0"
                      >
                        {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border/50">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5" /> Tags
                      </label>
                      <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border bg-background min-h-[38px] focus-within:ring-2 focus-within:ring-foreground/10">
                        {app.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md bg-muted text-xs"
                          >
                            {tag}
                            <button
                              type="button"
                              onClick={() => {
                                const next = [...state.apps];
                                next[appIndex] = { ...next[appIndex], tags: next[appIndex].tags.filter((_, i) => i !== idx) };
                                setState((s) => ({ ...s, apps: next }));
                              }}
                              className="p-0.5 rounded hover:bg-muted-foreground/20 text-muted-foreground hover:text-foreground"
                              aria-label="Remove tag"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                        <input
                          type="text"
                          placeholder={app.tags.length ? "Add tag…" : "react, typescript"}
                          className="flex-1 min-w-[80px] py-0.5 px-0 border-0 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                          onKeyDown={(e) => {
                            const v = (e.target as HTMLInputElement).value.trim();
                            if ((e.key === "Enter" || e.key === ",") && v) {
                              e.preventDefault();
                              const next = [...state.apps];
                              if (!next[appIndex].tags.includes(v)) {
                                next[appIndex] = { ...next[appIndex], tags: [...next[appIndex].tags, v] };
                                setState((s) => ({ ...s, apps: next }));
                              }
                              (e.target as HTMLInputElement).value = "";
                            }
                          }}
                          onBlur={(e) => {
                            const v = (e.target as HTMLInputElement).value.trim();
                            if (v) {
                              const next = [...state.apps];
                              if (!next[appIndex].tags.includes(v)) {
                                next[appIndex] = { ...next[appIndex], tags: [...next[appIndex].tags, v] };
                                setState((s) => ({ ...s, apps: next }));
                              }
                              (e.target as HTMLInputElement).value = "";
                            }
                          }}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <Code className="w-3.5 h-3.5" /> Tech
                      </label>
                      <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border bg-background min-h-[38px] focus-within:ring-2 focus-within:ring-foreground/10">
                        {app.tech.map((t, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md bg-muted text-xs"
                          >
                            {t}
                            <button
                              type="button"
                              onClick={() => {
                                const next = [...state.apps];
                                next[appIndex] = { ...next[appIndex], tech: next[appIndex].tech.filter((_, i) => i !== idx) };
                                setState((s) => ({ ...s, apps: next }));
                              }}
                              className="p-0.5 rounded hover:bg-muted-foreground/20 text-muted-foreground hover:text-foreground"
                              aria-label="Remove tech"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                        <input
                          type="text"
                          placeholder={app.tech.length ? "Add tech…" : "Next.js, Tailwind"}
                          className="flex-1 min-w-[80px] py-0.5 px-0 border-0 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                          onKeyDown={(e) => {
                            const v = (e.target as HTMLInputElement).value.trim();
                            if ((e.key === "Enter" || e.key === ",") && v) {
                              e.preventDefault();
                              const next = [...state.apps];
                              if (!next[appIndex].tech.includes(v)) {
                                next[appIndex] = { ...next[appIndex], tech: [...next[appIndex].tech, v] };
                                setState((s) => ({ ...s, apps: next }));
                              }
                              (e.target as HTMLInputElement).value = "";
                            }
                          }}
                          onBlur={(e) => {
                            const v = (e.target as HTMLInputElement).value.trim();
                            if (v) {
                              const next = [...state.apps];
                              if (!next[appIndex].tech.includes(v)) {
                                next[appIndex] = { ...next[appIndex], tech: [...next[appIndex].tech, v] };
                                setState((s) => ({ ...s, apps: next }));
                              }
                              (e.target as HTMLInputElement).value = "";
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status & Featured */}
          <div className="p-6 bg-card border rounded-2xl shadow-sm space-y-6">
            <div className="space-y-4">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Publishing</label>
              <Select
                value={state.status}
                onValueChange={(value) => setState(s => ({ ...s, status: value as "draft" | "published" | "archived" }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
              
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

          {/* Time period */}
          <div className="p-6 bg-card border rounded-2xl shadow-sm space-y-4">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Time period
            </label>
            <p className="text-xs text-muted-foreground">When was the project developed? Year or range.</p>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground whitespace-nowrap">From (year)</label>
                <input
                  type="number"
                  min={1990}
                  max={2100}
                  placeholder="e.g. 2022"
                  value={state.yearFrom === "" ? "" : state.yearFrom}
                  onChange={(e) => {
                    const v = e.target.value;
                    setState((s) => ({ ...s, yearFrom: v === "" ? "" : Math.min(2100, Math.max(1990, parseInt(v, 10) || 0)) }));
                  }}
                  className="w-28 h-11 px-4 rounded-xl border bg-background text-sm focus:ring-2 focus:ring-foreground/10 outline-none transition-all"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground whitespace-nowrap">To (year)</label>
                <input
                  type="number"
                  min={1990}
                  max={2100}
                  placeholder="e.g. 2024"
                  value={state.ongoing ? "" : (state.yearTo === "" ? "" : state.yearTo)}
                  disabled={state.ongoing}
                  onChange={(e) => {
                    const v = e.target.value;
                    setState((s) => ({ ...s, yearTo: v === "" ? "" : Math.min(2100, Math.max(1990, parseInt(v, 10) || 0)) }));
                  }}
                  className="w-28 h-11 px-4 rounded-xl border bg-background text-sm focus:ring-2 focus:ring-foreground/10 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={state.ongoing}
                  onChange={(e) => setState((s) => ({ ...s, ongoing: e.target.checked }))}
                  className="rounded border-input h-4 w-4"
                />
                <span className="text-sm">Still in development</span>
              </label>
            </div>
          </div>

          {/* Visibility */}
          <div className="p-6 bg-card border rounded-2xl shadow-sm space-y-4">
             <button
                onClick={() => setState((s) => ({ ...s, isSecret: !s.isSecret }))}
                className={cn(
                  "w-full flex items-center justify-between p-3 rounded-xl border transition-all",
                  state.isSecret ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-800" : "hover:bg-muted opacity-60"
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

      {/* Preview modal: default (no frame) / mobile / laptop */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="bg-card rounded-2xl shadow-xl border max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewDevice("default")}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                    previewDevice === "default" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
                  )}
                >
                  <ImageIcon className="w-4 h-4" /> Default
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice("laptop")}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                    previewDevice === "laptop" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
                  )}
                >
                  <Laptop className="w-4 h-4" /> Laptop
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice("mobile")}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                    previewDevice === "mobile" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
                  )}
                >
                  <Smartphone className="w-4 h-4" /> Mobile
                </button>
              </div>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="p-2 rounded-lg hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 flex justify-center items-center bg-muted/30 min-h-[280px]">
              {previewDevice === "default" ? (
                <div className="max-w-4xl max-h-[70vh] rounded-lg border border-border bg-background overflow-hidden">
                  <img src={previewImage.url} alt="" className="w-full h-full object-contain max-h-[70vh]" />
                </div>
              ) : previewDevice === "mobile" ? (
                <div className="w-[280px] aspect-[9/19.5] rounded-[2.5rem] border-8 border-zinc-800 bg-zinc-900 overflow-hidden shadow-2xl">
                  <div className="w-full h-full overflow-hidden bg-background">
                    <img src={previewImage.url} alt="" className="w-full h-full object-cover object-top" />
                  </div>
                </div>
              ) : (
                <div className="w-full max-w-2xl aspect-video rounded-lg border-4 border-zinc-700 bg-zinc-800 overflow-hidden shadow-2xl">
                  <div className="h-6 bg-zinc-700 flex items-center px-3 gap-2">
                    <div className="w-2 h-2 rounded-full bg-zinc-500" />
                    <div className="w-2 h-2 rounded-full bg-zinc-500" />
                    <div className="w-2 h-2 rounded-full bg-zinc-500" />
                  </div>
                  <div className="w-full h-[calc(100%-24px)] overflow-hidden bg-background">
                    <img src={previewImage.url} alt="" className="w-full h-full object-cover object-top" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
