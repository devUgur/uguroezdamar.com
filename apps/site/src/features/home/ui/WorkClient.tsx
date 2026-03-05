"use client";

import React, { useState, useCallback } from "react";
import Link from "next/link";
import { ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { ProjectDisplay } from "./Mockups";

export type DeviceType = "web" | "mobile" | "desktop" | "cli";

export interface WorkImage {
  url: string;
  alt?: string | null;
  kind?: string | null;
  /** When from an app, e.g. "Web", "Mobile" */
  appKind?: string;
}

export interface WorkApp {
  kind: DeviceType;
  repoUrl?: string | null;
  images: WorkImage[];
  tags?: string[];
  tech?: string[];
}

export interface SelectedWorkProject {
  slug: string;
  name: string;
  year: string;
  role: string;
  stack: string;
  types: DeviceType[];
  image: string;
  deviceImages?: Record<DeviceType, string>;
  description: string;
  /** Images per device type for slideshow (one main image + stepper) */
  imagesByKind: Partial<Record<DeviceType, WorkImage[]>>;
  apps: WorkApp[];
  links?: { platform: string; label?: string; url: string; kind?: DeviceType | null }[];
  tech?: string[];
  tags?: string[];
}

export default function WorkClient({ projects }: { projects: SelectedWorkProject[] }) {
  const [activeDevices, setActiveDevices] = useState<Record<number, DeviceType>>({});
  const [slideIndex, setSlideIndex] = useState<Record<number, Partial<Record<DeviceType, number>>>>({});

  const getImagesForType = useCallback((project: SelectedWorkProject, type: DeviceType): WorkImage[] => {
    const list = project.imagesByKind[type];
    if (list?.length) return list;
    const fallback = project.deviceImages?.[type] || project.image;
    return fallback ? [{ url: fallback, alt: project.name }] : [];
  }, []);

  const setSlide = useCallback((projectIndex: number, type: DeviceType, index: number) => {
    setSlideIndex((prev) => ({
      ...prev,
      [projectIndex]: { ...prev[projectIndex], [type]: index },
    }));
  }, []);

  const projectCards = projects.map((project, i) => {
    const indexLabel = String(i + 1).padStart(2, "0");

    return (
      <div key={project.slug} className="group relative grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-8 items-center">
        {/* Device Image Area */}
        <div className="flex flex-col gap-6 order-2 lg:order-1 lg:col-span-7">
          <div className="relative w-full min-h-[220px] sm:min-h-[280px] md:min-h-[320px] lg:min-h-[380px] xl:min-h-[440px] aspect-video max-h-[260px] sm:max-h-[360px] md:max-h-[420px] lg:max-h-[500px] xl:max-h-[580px] flex items-center justify-center overflow-visible bg-muted/20 rounded-2xl group-hover:bg-muted/40 transition-colors duration-700">
            <ProjectDisplay
              project={project}
              activeType={activeDevices[i] ?? project.types[0]}
              currentImageUrl={(() => {
                const type = activeDevices[i] ?? project.types[0];
                const images = getImagesForType(project, type);
                const current = slideIndex[i]?.[type] ?? 0;
                const idx = Math.max(0, Math.min(current, images.length - 1));
                return images[idx]?.url;
              })()}
            />
          </div>

          {/* Device Slides Stepper */}
          {(() => {
            const type = activeDevices[i] ?? project.types[0];
            const images = getImagesForType(project, type);
            if (images.length <= 1) return null;
            const current = Math.max(0, Math.min(slideIndex[i]?.[type] ?? 0, images.length - 1));
            return (
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setSlide(i, type, current === 0 ? images.length - 1 : current - 1)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Previous image"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="flex gap-2" role="tablist">
                  {images.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      role="tab"
                      aria-selected={idx === current}
                      aria-label={`Image ${idx + 1} of ${images.length}`}
                      onClick={() => setSlide(i, type, idx)}
                      className={`h-[2px] rounded-full transition-all duration-300 ${idx === current ? "w-6 bg-foreground" : "w-3 bg-border hover:bg-muted-foreground/50"
                        }`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setSlide(i, type, current === images.length - 1 ? 0 : current + 1)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Next image"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            );
          })()}
        </div>

        {/* Project Meta Information Area */}
        <div className="flex flex-col order-1 lg:order-2 lg:col-span-4 lg:col-start-9">
          <div className="flex items-baseline gap-4 mb-5">
            <span className="font-mono text-sm text-muted-foreground/50">{indexLabel}</span>
            <h3 className="font-serif text-3xl md:text-4xl text-foreground">
              <Link href={`/projects/${project.slug}`} className="hover:text-accent transition-colors duration-300">
                {project.name}
              </Link>
            </h3>
          </div>

          <p className="font-sans text-base md:text-lg leading-[1.6] text-muted-foreground mb-8">
            {project.description}
          </p>

          <div className="flex flex-col mb-8 relative">
            <div className="absolute left-[5px] top-2 bottom-2 w-[1px] bg-border/40 hidden lg:block"></div>
            <div className="space-y-4 lg:pl-6">
              <div className="flex flex-wrap items-center gap-3 font-mono text-xs uppercase tracking-widest text-secondary-foreground">
                <span>{project.year}</span>
                <span className="w-1 h-1 rounded-full bg-border" />
                <span>{project.role}</span>
                <span className="w-1 h-1 rounded-full bg-border" />
                <span>{project.stack}</span>
              </div>

              {project.types.length > 0 && (
                <div className="flex flex-wrap gap-5 pt-1">
                  {project.types.map((t) => {
                    const isActive = (activeDevices[i] ?? project.types[0]) === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        className={`font-mono text-[10px] uppercase tracking-widest pb-1 border-b transition-all duration-300 ${isActive
                          ? "border-foreground text-foreground"
                          : "border-transparent text-muted-foreground hover:text-foreground/80 hover:border-foreground/30"
                          }`}
                        onMouseEnter={() => setActiveDevices((prev) => ({ ...prev, [i]: t }))}
                        onClick={() => setActiveDevices((prev) => ({ ...prev, [i]: t }))}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {project.tech && project.tech.length > 0 && (
            <div className="font-mono text-[11px] leading-relaxed text-muted-foreground/60 uppercase tracking-wider mb-6">
              {project.tech.join(" • ")}
            </div>
          )}

          {project.links && project.links.length > 0 && (
            <div className="flex flex-wrap gap-6 mt-2">
              {project.links.slice(0, 4).map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group/link flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-foreground hover:text-accent transition-colors"
                >
                  {link.label || link.platform}
                  <ExternalLink size={12} className="relative -top-[1px] group-hover/link:translate-x-[2px] group-hover/link:-translate-y-[2px] transition-transform" />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  });

  return (
    <section id="work" className="py-24 md:py-32 lg:py-40 px-6 md:px-12 lg:px-24 hairline-t">
      <h2 className="font-mono text-sm uppercase tracking-widest text-muted-foreground mb-16 md:mb-24">
        02 — Selected Work
      </h2>

      {projects.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          Selected Work is currently in progress. Coming soon.
        </div>
      ) : (
        <div className="flex flex-col gap-32 md:gap-40 lg:gap-56">
          {projectCards}
        </div>
      )}
    </section>
  );
}
