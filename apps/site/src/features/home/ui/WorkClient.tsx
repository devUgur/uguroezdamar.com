"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Layers } from "lucide-react";
import { ProjectDisplay } from "./Mockups";

export type DeviceType = "web" | "mobile" | "cli";

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
}

export default function WorkClient({ projects }: { projects: SelectedWorkProject[] }) {
  const [activeDevices, setActiveDevices] = useState<Record<number, DeviceType>>({});

  return (
    <section id="work" className="py-24 md:py-32 lg:py-40 px-6 md:px-12 lg:px-24 hairline-t">
      <div className="mb-16 md:mb-24">
        <h2 className="font-mono text-sm uppercase tracking-widest text-muted-foreground">02 — Selected Work</h2>
      </div>

      <div className="flex flex-col">
        {projects.length === 0 ? (
          <div className="py-12 text-sm text-muted-foreground">Selected Work is currently in progress. Coming soon.</div>
        ) : (
          projects.map((project, i) => (
            <div key={project.slug} className="group project-container relative py-12 md:py-24 lg:py-32 hairline-b first:hairline-t flex flex-col md:flex-row md:items-center justify-between cursor-pointer">
              <div className="absolute bottom-[-1px] left-0 w-full h-[1px] bg-foreground project-hover-line z-10 transition-all duration-500"></div>

              <div className="z-20 relative md:max-w-xl pr-8 md:pr-16 w-full">
                <div className="flex items-center gap-3 mb-6">
                  <Layers size={14} className="text-accent" />
                  <div className="flex gap-2">
                    {project.types.map((t) => {
                      const isActive = (activeDevices[i] || project.types[0]) === t;
                      return (
                        <span
                          key={t}
                          className={`font-mono text-[9px] uppercase tracking-widest border px-2 py-0.5 rounded-sm transition-all duration-300 ${
                            isActive
                              ? "bg-accent/10 border-accent/30 text-accent/90 shadow-sm"
                              : "text-muted-foreground border-border/50 hover:border-border hover:bg-surface"
                          }`}
                          onMouseEnter={() => setActiveDevices((prev) => ({ ...prev, [i]: t }))}
                        >
                          {t}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <h3 className="font-serif text-4xl md:text-5xl lg:text-6xl mb-4 group-hover:text-accent transition-colors duration-500">
                  <Link href={`/projects/${project.slug}`}>{project.name}</Link>
                </h3>
                <p className="text-secondary-foreground text-sm md:text-base leading-relaxed mb-6 max-w-md">{project.description}</p>
                <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground flex flex-wrap items-center gap-3 md:gap-4">
                  <span>{project.year}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-border"></span>
                  <span>{project.role}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-border"></span>
                  <span>{project.stack}</span>
                </div>
              </div>

              <div className="mt-12 md:mt-0 relative w-full md:w-[450px] lg:w-[600px] h-[300px] md:h-[400px] opacity-100 md:opacity-0 group-hover:opacity-100 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] z-10 md:translate-x-12 group-hover:translate-x-0">
                <ProjectDisplay project={project} activeType={activeDevices[i] || project.types[0]} />
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
