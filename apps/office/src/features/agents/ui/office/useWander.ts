"use client";

import { useEffect, useRef, useState } from "react";
import type { OfficeMotion } from "../../types";
import { motionIsWalking, motionPosition } from "./world/layout";

export interface Point {
  x: number;
  y: number;
}

export interface FigurePose extends Point {
  walking: boolean;
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Projects the authoritative world-space motion into the 2D fallback's SVG viewBox. */
function toSvg(motion: OfficeMotion, now: number): FigurePose {
  const position = prefersReducedMotion() ? motion.target : motionPosition(motion, now);
  return {
    x: 480 + position.x * 64.7,
    y: 110 + (position.z + 5) * 30,
    walking: !prefersReducedMotion() && motionIsWalking(motion, now),
  };
}

/** Figures use server-issued paths; this hook only renders their shared progress smoothly. */
export function useWander(
  seats: Record<string, Point>,
  motions: Record<string, OfficeMotion> | undefined,
  serverOffsetMs: number,
): Record<string, FigurePose> {
  const [, setFrame] = useState(0);
  const motionsRef = useRef(motions);
  motionsRef.current = motions;

  useEffect(() => {
    if (!motions) return;
    if (prefersReducedMotion()) {
      setFrame((frame) => frame + 1);
      return;
    }
    let handle = 0;
    const step = () => {
      setFrame((frame) => (frame + 1) % 1_000_000);
      handle = requestAnimationFrame(step);
    };
    handle = requestAnimationFrame(step);
    return () => cancelAnimationFrame(handle);
  }, [Boolean(motions)]);

  const now = Date.now() + serverOffsetMs;
  return Object.fromEntries(
    Object.entries(seats).map(([id, seat]) => [id, motionsRef.current?.[id] ? toSvg(motionsRef.current[id]!, now) : { ...seat, walking: false }]),
  );
}
