"use client";

import { useEffect, useRef, useState } from "react";
import type { AgentActivity } from "./agentState";

export interface Point {
  x: number;
  y: number;
}

export interface FigurePose extends Point {
  walking: boolean;
}

/** The open floor idle agents stroll across (SVG units of the office, see OfficeRoom). */
const FLOOR = { left: 80, right: 880, top: 330, bottom: 510 };
const SPEED = 70; // units per second

function randomSpot(): Point {
  return {
    x: FLOOR.left + Math.random() * (FLOOR.right - FLOOR.left),
    y: FLOOR.top + Math.random() * (FLOOR.bottom - FLOOR.top),
  };
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Where each figure stands. Busy agents walk to their seat; idle ones stroll between random spots
 * with short pauses. With reduced motion, figures stay at their seats and never walk.
 */
export function useWander(seats: Record<string, Point>, activity: Record<string, AgentActivity>): Record<string, FigurePose> {
  const poses = useRef<Record<string, FigurePose>>({});
  const goals = useRef<Record<string, { spot: Point; restUntil: number }>>({});
  const [, setFrame] = useState(0);
  const seatsRef = useRef(seats);
  const activityRef = useRef(activity);
  seatsRef.current = seats;
  activityRef.current = activity;

  for (const [id, seat] of Object.entries(seats)) poses.current[id] ??= { ...seat, walking: false };

  useEffect(() => {
    if (prefersReducedMotion()) {
      for (const [id, seat] of Object.entries(seatsRef.current)) poses.current[id] = { ...seat, walking: false };
      setFrame((frame) => frame + 1);
      return;
    }
    let handle = 0;
    let last = performance.now();
    const step = (now: number) => {
      const seconds = Math.min((now - last) / 1000, 0.1);
      last = now;
      for (const [id, seat] of Object.entries(seatsRef.current)) {
        const pose = poses.current[id] ?? { ...seat, walking: false };
        let target: Point = seat;
        if ((activityRef.current[id] ?? "idle") === "idle") {
          const goal = (goals.current[id] ??= { spot: randomSpot(), restUntil: 0 });
          if (Math.hypot(goal.spot.x - pose.x, goal.spot.y - pose.y) < 2) {
            if (!goal.restUntil) goal.restUntil = now + 1500 + Math.random() * 3500;
            if (now > goal.restUntil) goals.current[id] = { spot: randomSpot(), restUntil: 0 };
          }
          target = goal.spot;
        }
        const dx = target.x - pose.x;
        const dy = target.y - pose.y;
        const distance = Math.hypot(dx, dy);
        const move = Math.min(distance, SPEED * seconds);
        poses.current[id] = distance < 1 ? { ...target, walking: false } : { x: pose.x + (dx / distance) * move, y: pose.y + (dy / distance) * move, walking: true };
      }
      setFrame((frame) => (frame + 1) % 1_000_000);
      handle = requestAnimationFrame(step);
    };
    handle = requestAnimationFrame(step);
    return () => cancelAnimationFrame(handle);
  }, []);

  return poses.current;
}
