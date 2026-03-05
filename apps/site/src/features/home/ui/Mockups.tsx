"use client";

import React from "react";
import Image from "next/image";
import { Terminal, Globe } from "lucide-react";
import type { SelectedWorkProject, DeviceType } from "./WorkClient";

export function MockupFrame({ type, image, name, zIndex = 0, scale = 1, xOffset = 0, yOffset = 0, opacity = 1 }: { type: DeviceType, image: string, name: string, zIndex?: number, scale?: number, xOffset?: number, yOffset?: number, opacity?: number }) {
  const style: React.CSSProperties = {
    zIndex,
    transform: `scale(${scale}) translate(${xOffset}px, ${yOffset}px)`,
    opacity,
  };

  if (type === 'cli') {
    return (
      <div className="w-full h-full bg-[#1e1e1e] rounded-md border border-[#333] flex flex-col overflow-hidden shadow-2xl transition-all duration-500" style={style}>
        <div className="bg-[#2d2d2d] px-3 py-1.5 flex items-center gap-2 border-b border-[#333]">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
          </div>
          <div className="text-[10px] font-mono text-gray-400 ml-2 flex items-center gap-1">
            <Terminal size={10} /> {name.toLowerCase().replace(' ', '-')}.sh
          </div>
        </div>
        <div className="p-4 font-mono text-xs text-green-400 leading-relaxed overflow-hidden">
          <div className="flex gap-2 mb-1">
            <span className="text-blue-400">➜</span>
            <span className="text-white">~/{name.toLowerCase().replace(' ', '-')}</span>
            <span className="text-gray-500">git:(main)</span>
          </div>
          <div className="mb-2">Developing high-performance CLI utilities...</div>
          <div className="animate-pulse">_</div>
          <div className="relative mt-4 h-32 w-full rounded overflow-hidden">
            <Image src={image} alt="" fill unoptimized className="object-cover opacity-20 grayscale filter blur-[1px]" />
          </div>
        </div>
      </div>
    );
  }

  if (type === 'mobile') {
    return (
      <div className="relative border-gray-800 dark:border-gray-800 bg-gray-800 border-[6px] sm:border-[8px] rounded-[2rem] sm:rounded-[2.5rem] h-[320px] w-[160px] sm:h-[380px] sm:w-[190px] md:h-[420px] md:w-[210px] lg:h-[460px] lg:w-[230px] xl:h-[500px] xl:w-[250px] shadow-2xl overflow-hidden transition-all duration-500" style={style}>
        <div className="relative rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden w-full h-full bg-white dark:bg-gray-900">
          <Image src={image} alt={name} fill unoptimized className="w-full h-full object-cover grayscale opacity-80" />
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-3 sm:w-16 sm:h-4 bg-gray-800 rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[340px] sm:max-w-[420px] md:max-w-[500px] lg:max-w-[580px] xl:max-w-[660px] aspect-video bg-[#1a1a1a] rounded-lg border border-border flex flex-col overflow-hidden shadow-2xl transition-all duration-500" style={style}>
      <div className="bg-surface px-4 py-2 flex items-center justify-between border-b border-border flex-shrink-0">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-border" />
          <div className="w-2.5 h-2.5 rounded-full bg-border" />
          <div className="w-2.5 h-2.5 rounded-full bg-border" />
        </div>
        <div className="bg-background px-3 py-0.5 rounded text-[10px] font-mono text-muted-foreground border border-border flex items-center gap-1.5 truncate max-w-[150px]">
          <Globe size={10} /> {name.toLowerCase().replace(' ', '-')}.app
        </div>
        <div className="w-10" />
      </div>
      <div className="flex-1 min-h-0 relative overflow-hidden">
        <Image
          src={image}
          alt={name}
          fill
          unoptimized
          className="object-contain grayscale opacity-90 group-hover:grayscale-[40%] transition-all duration-700"
        />
      </div>
    </div>
  );
}

export function ProjectDisplay({
  project,
  activeType,
  currentImageUrl,
}: {
  project: SelectedWorkProject;
  activeType?: DeviceType;
  /** Override: current slide image for the active type (e.g. from slideshow) */
  currentImageUrl?: string | null;
}) {
  const { types, image, deviceImages, name } = project;
  const displayType = activeType || types[0];
  const displayImage =
    currentImageUrl ?? (deviceImages && deviceImages[displayType] ? deviceImages[displayType] : image);

  return (
    <div className="relative w-full h-full flex items-center justify-center p-4">
      <div className="w-full h-full transition-all duration-500 ease-out flex items-center justify-center">
        <MockupFrame
          type={displayType}
          image={displayImage}
          name={name}
          zIndex={10}
          scale={displayType === 'mobile' ? 0.9 : 1}
          opacity={1}
        />
      </div>
    </div>
  );
}

export default MockupFrame;
