"use client";

import React, { useState, useCallback } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import type { WorkImage } from "./WorkClient";

interface WorkGalleryProps {
  images: WorkImage[];
  projectName: string;
  /** Optional: show compact strip instead of grid when many images */
  variant?: "grid" | "strip" | "auto";
  className?: string;
}

export function WorkGallery({ images, projectName, variant = "auto", className = "" }: WorkGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const open = useCallback((index: number) => setLightboxIndex(index), []);
  const close = useCallback(() => setLightboxIndex(null), []);

  if (!images.length) return null;

  const useStrip = variant === "strip" || (variant === "auto" && images.length > 4);
  const useGrid = !useStrip;

  return (
    <>
      <div
        className={
          useStrip
            ? `flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border hover:scrollbar-thumb-muted-foreground/30 ${className}`
            : `grid gap-2 ${images.length === 1 ? "grid-cols-1" : images.length === 2 ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-3"} ${className}`
        }
      >
        {images.map((img, index) => (
          <button
            key={`${img.url}-${index}`}
            type="button"
            onClick={() => open(index)}
            className={`
              relative overflow-hidden rounded-lg border border-border/60 bg-muted/20
              transition-all duration-300 hover:border-accent/40 hover:shadow-lg hover:shadow-accent/5
              focus:outline-none focus:ring-2 focus:ring-accent/50 focus:ring-offset-2 focus:ring-offset-background
              ${useStrip ? "min-w-[180px] h-[120px] flex-shrink-0" : "aspect-video min-h-[100px]"}
            `}
          >
            <Image
              src={img.url}
              alt={img.alt ?? projectName}
              fill
              unoptimized
              sizes={useStrip ? "180px" : "(max-width: 768px) 100vw, 33vw"}
              className="object-cover transition-transform duration-300 hover:scale-[1.02]"
            />
            {img.appKind && (
              <span className="absolute bottom-1 left-1 rounded bg-background/80 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {img.appKind}
              </span>
            )}
          </button>
        ))}
      </div>

      {lightboxIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Image gallery lightbox"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={close}
        >
          <button
            type="button"
            onClick={close}
            className="absolute right-4 top-4 rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X size={24} />
          </button>
          <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <Image
              src={images[lightboxIndex].url}
              alt={images[lightboxIndex].alt ?? projectName}
              width={1200}
              height={800}
              unoptimized
              className="max-h-[90vh] w-auto rounded-lg object-contain shadow-2xl"
            />
            {images.length > 1 && (
              <div className="mt-2 flex justify-center gap-1">
                {images.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setLightboxIndex(i)}
                    className={`h-2 rounded-full transition-all ${
                      i === lightboxIndex ? "w-6 bg-accent" : "w-2 bg-white/40 hover:bg-white/60"
                    }`}
                    aria-label={`View image ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
