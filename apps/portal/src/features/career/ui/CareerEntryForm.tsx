"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { CareerEntry, CareerEntryType } from "@ugur/server";
import { 
  Briefcase, 
  GraduationCap, 
  Award, 
  Mic2, 
  BookOpen, 
  Plus, 
  Trash2, 
  Save, 
  Loader2, 
  ArrowLeft,
  Calendar,
  MapPin,
  Building2,
  Tag,
  Eye,
  Type,
  FileText,
  ExternalLink,
  ChevronDown
} from "lucide-react";
import { cn } from "@ugur/core";

type Props = {
  id?: string;
  initial?: CareerEntry;
};

const TYPES: { value: CareerEntryType; label: string; icon: any }[] = [
  { value: "work", label: "Work Experience", icon: Briefcase },
  { value: "education", label: "Education", icon: GraduationCap },
  { value: "certificate", label: "Certificate", icon: Award },
  { value: "award", label: "Award", icon: Star },
  { value: "speaking", label: "Speaking", icon: Mic2 },
  { value: "publication", label: "Publication", icon: BookOpen },
  { value: "project", label: "Side Project", icon: Code },
];

function Star(props: any) {
  return <Award {...props} />;
}

function Code(props: any) {
  return <Type {...props} />;
}

function toDateInput(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function CareerEntryForm({ id, initial }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [state, setState] = useState({
    type: initial?.type ?? "work",
    slug: initial?.slug ?? "",
    title: initial?.title ?? "",
    organization: initial?.organization ?? "",
    location: initial?.location ?? "",
    startDate: toDateInput(initial?.date?.start),
    endDate: toDateInput(initial?.date?.end),
    isCurrent: initial?.date?.isCurrent ?? false,
    summary: initial?.summary ?? "",
    highlights: (initial?.highlights ?? []).join("\n"),
    tags: (initial?.tags ?? []).join(", "),
    status: initial?.status ?? "draft",
    isFeatured: initial?.isFeatured ?? false,
    sortKey: String(initial?.sortKey ?? 0),
    visibilityAbout: initial?.visibility?.about ?? false,
    visibilityEducation: initial?.visibility?.education ?? false,
    visibilityCareer: initial?.visibility?.career ?? true,
    // Type specific
    role: initial?.role ?? "",
    degree: initial?.degree ?? "",
    field: initial?.field ?? "",
    issuer: initial?.issuer ?? "",
  });

  const [links, setLinks] = useState(
    initial?.links?.length 
      ? initial.links.map(l => ({ label: l.label, url: l.url })) 
      : [{ label: "", url: "" }]
  );

  const handleSave = async () => {
    setLoading(true);
    setError(null);

    const payload = {
      type: state.type,
      slug: state.slug || state.title.toLowerCase().replace(/\s+/g, "-"),
      title: state.title,
      organization: state.organization || null,
      location: state.location || null,
      date: {
        start: state.startDate ? new Date(state.startDate).toISOString() : new Date().toISOString(),
        end: state.endDate && !state.isCurrent ? new Date(state.endDate).toISOString() : null,
        isCurrent: state.isCurrent,
      },
      summary: state.summary || null,
      highlights: state.highlights.split("\n").filter(l => l.trim().length > 0),
      tags: state.tags.split(",").map(t => t.trim()).filter(t => t.length > 0),
      links: links.filter(l => l.label && l.url),
      isFeatured: state.isFeatured,
      sortKey: parseInt(state.sortKey) || 0,
      visibility: {
        about: state.visibilityAbout,
        education: state.visibilityEducation,
        career: state.visibilityCareer,
      },
      status: state.status,
      role: state.type === "work" ? (state.role || state.title) : null,
      degree: state.type === "education" ? (state.degree || state.title) : null,
      field: state.field || null,
      issuer: state.type === "certificate" ? (state.issuer || state.organization) : null,
    };

    try {
      const url = id ? `/api/career-entries/${id}` : "/api/career-entries";
      const method = id ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to save");
      }

      router.push("/admin/career");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const currentType = TYPES.find(t => t.value === state.type) || TYPES[0];

  return (
    <div className="max-w-5xl mx-auto p-8 space-y-8 pb-24">
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
              {id ? "Edit Career Entry" : "New Career Entry"}
            </h1>
            <p className="text-muted-foreground">Define your professional milestones and achievements.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-foreground text-background rounded-xl font-medium hover:opacity-90 transition-all disabled:opacity-50 shadow-sm"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Entry
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
          {/* Type Selector */}
          <div className="p-6 bg-card border rounded-2xl shadow-sm space-y-4">
            <label className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <Type className="w-4 h-4" /> Entry Type
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setState(s => ({ ...s, type: type.value }))}
                  className={cn(
                    "flex flex-col items-center justify-center p-4 rounded-xl border transition-all gap-2",
                    state.type === type.value 
                      ? "bg-foreground text-background border-foreground shadow-md scale-[1.02]" 
                      : "hover:border-foreground/20 hover:bg-muted/50"
                  )}
                >
                  <type.icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Basic Info */}
          <div className="p-6 bg-card border rounded-2xl shadow-sm space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Title / Headline</label>
                <input
                  value={state.title}
                  onChange={(e) => setState(s => ({ ...s, title: e.target.value }))}
                  placeholder="e.g. Senior Software Engineer"
                  className="w-full px-4 py-2.5 rounded-xl border bg-background focus:ring-2 focus:ring-foreground/10 outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Organization / Issuer</label>
                <div className="relative">
                  <Building2 className="absolute left-4 top-3 w-4 h-4 text-muted-foreground" />
                  <input
                    value={state.organization}
                    onChange={(e) => setState(s => ({ ...s, organization: e.target.value }))}
                    placeholder="e.g. Acme Corp or University of X"
                    className="w-full pl-11 pr-4 py-2.5 rounded-xl border bg-background focus:ring-2 focus:ring-foreground/10 outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Location</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-3 w-4 h-4 text-muted-foreground" />
                  <input
                    value={state.location}
                    onChange={(e) => setState(s => ({ ...s, location: e.target.value }))}
                    placeholder="e.g. Remote or Berlin, DE"
                    className="w-full pl-11 pr-4 py-2.5 rounded-xl border bg-background focus:ring-2 focus:ring-foreground/10 outline-none transition-all"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Slug</label>
                <input
                  value={state.slug}
                  onChange={(e) => setState(s => ({ ...s, slug: e.target.value }))}
                  placeholder="senior-engineer-acme"
                  className="w-full px-4 py-2.5 rounded-xl border bg-background font-mono text-xs focus:ring-2 focus:ring-foreground/10 outline-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="p-6 bg-card border rounded-2xl shadow-sm space-y-6">
            <label className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <Calendar className="w-4 h-4" /> Time Period
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Start Date</label>
                <input
                  type="date"
                  value={state.startDate}
                  onChange={(e) => setState(s => ({ ...s, startDate: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border bg-background focus:ring-2 focus:ring-foreground/10 outline-none"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">End Date</label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={state.isCurrent}
                      onChange={(e) => setState(s => ({ ...s, isCurrent: e.target.checked }))}
                      className="rounded border-gray-300 text-foreground focus:ring-foreground"
                    />
                    <span className="text-[10px] font-bold uppercase tracking-tighter">Ongoing</span>
                  </label>
                </div>
                <input
                  type="date"
                  disabled={state.isCurrent}
                  value={state.endDate}
                  onChange={(e) => setState(s => ({ ...s, endDate: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border bg-background focus:ring-2 focus:ring-foreground/10 outline-none disabled:bg-muted/50 disabled:text-muted-foreground"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sort Priority</label>
                <input
                  type="number"
                  value={state.sortKey}
                  onChange={(e) => setState(s => ({ ...s, sortKey: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border bg-background focus:ring-2 focus:ring-foreground/10 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 bg-card border rounded-2xl shadow-sm space-y-6">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                <FileText className="w-4 h-4" /> Summary
              </label>
              <textarea
                value={state.summary}
                onChange={(e) => setState(s => ({ ...s, summary: e.target.value }))}
                rows={3}
                placeholder="A brief overview of your role or achievement..."
                className="w-full px-4 py-3 rounded-xl border bg-background focus:ring-2 focus:ring-foreground/10 outline-none transition-all resize-none"
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                <Tag className="w-4 h-4" /> Highlights (One per line)
              </label>
              <textarea
                value={state.highlights}
                onChange={(e) => setState(s => ({ ...s, highlights: e.target.value }))}
                rows={5}
                placeholder="• Developed scalable microservices&#10;• Mentored junior developers..."
                className="w-full px-4 py-3 rounded-xl border bg-background font-mono text-sm focus:ring-2 focus:ring-foreground/10 outline-none transition-all"
              />
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
              </select>
              
              <button
                onClick={() => setState(s => ({ ...s, isFeatured: !s.isFeatured }))}
                className={cn(
                  "w-full flex items-center justify-between p-4 rounded-xl border transition-all",
                  state.isFeatured ? "bg-yellow-50 border-yellow-200 text-yellow-700" : "hover:bg-muted"
                )}
              >
                <div className="flex items-center gap-3">
                  <Star className={cn("w-5 h-5", state.isFeatured && "fill-current")} />
                  <span className="font-semibold text-sm">Featured</span>
                </div>
                <div className={cn(
                  "w-10 h-5 rounded-full relative transition-colors",
                  state.isFeatured ? "bg-yellow-400" : "bg-muted-foreground/20"
                )}>
                  <div className={cn(
                    "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                    state.isFeatured ? "right-1" : "left-1"
                  )} />
                </div>
              </button>
            </div>
          </div>

          {/* Visibility */}
          <div className="p-6 bg-card border rounded-2xl shadow-sm space-y-6">
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              <Eye className="w-4 h-4" /> Visibility Settings
            </label>
            <div className="space-y-2">
              {[
                { id: 'visibilityAbout', label: 'Show in About section', key: 'visibilityAbout' },
                { id: 'visibilityEducation', label: 'Show in Education section', key: 'visibilityEducation' },
                { id: 'visibilityCareer', label: 'Show in Career/CV page', key: 'visibilityCareer' },
              ].map((v) => (
                <button
                  key={v.id}
                  onClick={() => setState(s => ({ ...s, [v.key]: !s[v.key as keyof typeof s] }))}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left",
                    state[v.key as keyof typeof state] ? "bg-green-50 border-green-200 text-green-700" : "hover:bg-muted opacity-60"
                  )}
                >
                  <span className="text-xs font-bold uppercase tracking-tight">{v.label}</span>
                  {state[v.key as keyof typeof state] ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                </button>
              ))}
            </div>
          </div>

          {/* Links */}
          <div className="p-6 bg-card border rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">External Links</label>
              <button
                onClick={() => setLinks([...links, { label: "", url: "" }])}
                className="p-1.5 hover:bg-muted rounded-lg transition-colors text-blue-500"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              {links.map((link, idx) => (
                <div key={idx} className="space-y-2 p-3 bg-muted/30 rounded-xl border relative group">
                  <button
                    onClick={() => setLinks(links.filter((_, i) => i !== idx))}
                    className="absolute -right-2 -top-2 w-6 h-6 bg-red-500 text-white rounded-full items-center justify-center hidden group-hover:flex shadow-md hover:bg-red-600 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <input
                    placeholder="Label (e.g. Website)"
                    value={link.label}
                    onChange={(e) => {
                      const newLinks = [...links];
                      newLinks[idx].label = e.target.value;
                      setLinks(newLinks);
                    }}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border bg-background outline-none"
                  />
                  <input
                    placeholder="https://..."
                    value={link.url}
                    onChange={(e) => {
                      const newLinks = [...links];
                      newLinks[idx].url = e.target.value;
                      setLinks(newLinks);
                    }}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border bg-background outline-none"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Type-Specific Fields */}
          {(state.type === "work" || state.type === "education" || state.type === "certificate") && (
             <div className="p-6 bg-card border rounded-2xl shadow-sm space-y-4">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Type Details</label>
                {state.type === "work" && (
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Specific Role</label>
                      <input
                        value={state.role}
                        onChange={(e) => setState(s => ({ ...s, role: e.target.value }))}
                        placeholder="e.g. Lead Frontend"
                        className="w-full px-4 py-2 rounded-xl border bg-background text-sm"
                      />
                   </div>
                )}
                {state.type === "education" && (
                   <>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Degree</label>
                        <input
                          value={state.degree}
                          onChange={(e) => setState(s => ({ ...s, degree: e.target.value }))}
                          placeholder="e.g. Bachelor of Science"
                          className="w-full px-4 py-2 rounded-xl border bg-background text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Field of Study</label>
                        <input
                          value={state.field}
                          onChange={(e) => setState(s => ({ ...s, field: e.target.value }))}
                          placeholder="e.g. Computer Science"
                          className="w-full px-4 py-2 rounded-xl border bg-background text-sm"
                        />
                      </div>
                   </>
                )}
                {state.type === "certificate" && (
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Issuer</label>
                      <input
                        value={state.issuer}
                        onChange={(e) => setState(s => ({ ...s, issuer: e.target.value }))}
                        placeholder="e.g. AWS, Google, etc."
                        className="w-full px-4 py-2 rounded-xl border bg-background text-sm"
                      />
                   </div>
                )}
             </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EyeOff(props: any) {
  return <Eye className={cn("opacity-20", props.className)} />;
}

function X(props: any) {
  return <Trash2 {...props} />;
}
