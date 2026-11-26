/**
 * Geometry of the 3D office in meters, free of Three.js so it can be tested. The office has its back
 * wall at z = BACK_WALL_Z, desks in rows from there towards the camera, and an open floor in
 * front of the last row where idle agents stroll. Figures face +z by default (yaw 0).
 */
export interface Vec2 {
  x: number;
  z: number;
}

export interface Placement {
  desk: Vec2;
  /** Where the agent sits: between the desk and the open floor, looking at the desk. */
  seat: Vec2;
}

export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export const BACK_WALL_Z = -5;
export const WALL_HEIGHT = 3.4;
export const DESK_COLUMNS = 4;

const DESK_SPACING_X = 3.4;
const ROW_SPACING_Z = 3.6;
const FIRST_ROW_Z = -3;
const SEAT_OFFSET_Z = 1.15;

export interface Office {
  placements: Placement[];
  /** Half the room width; grows with the number of desk columns in use. */
  halfWidth: number;
  depth: number;
  bounds: Bounds;
}

const MIN_HALF_WIDTH = 5.5;

/**
 * Places every agent at the desk its row in the `agents` table names (desk_x, desk_y start at 1;
 * empty falls back to the list order), centers the used columns, and sizes the room to fit.
 */
export function buildOffice(desks: { x: number; y: number }[]): Office {
  const slots = desks.map((desk, index) => {
    const slot = Math.max(1, desk.x || index + 1) - 1;
    return { column: slot % DESK_COLUMNS, row: Math.max(1, desk.y || 1) - 1 };
  });
  const columns = slots.map((slot) => slot.column);
  const first = columns.length ? Math.min(...columns) : 0;
  const last = columns.length ? Math.max(...columns) : 0;
  const center = (first + last) / 2;

  const placements = slots.map(({ column, row }) => {
    const x = (column - center) * DESK_SPACING_X;
    const z = FIRST_ROW_Z + row * ROW_SPACING_Z;
    return { desk: { x, z }, seat: { x, z: z + SEAT_OFFSET_Z } };
  });

  const halfWidth = Math.max(MIN_HALF_WIDTH, ((last - first + 1) * DESK_SPACING_X + 3) / 2);
  const rowZ = placements.reduce((deepest, placement) => Math.max(deepest, placement.desk.z), FIRST_ROW_Z);
  return {
    placements,
    halfWidth,
    depth: rowZ + 6.5 - BACK_WALL_Z,
    // The open floor in front of the last desk row, where idle agents walk.
    bounds: { minX: -halfWidth + 0.5, maxX: halfWidth - 0.5, minZ: rowZ + 2.4, maxZ: rowZ + 6 },
  };
}

export function randomSpot(bounds: Bounds, random: () => number = Math.random): Vec2 {
  return {
    x: bounds.minX + random() * (bounds.maxX - bounds.minX),
    z: bounds.minZ + random() * (bounds.maxZ - bounds.minZ),
  };
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

/** Reconstruct the same position in every browser from the server's movement plan. */
export function motionPosition(motion: import("../../../types").OfficeMotion, now: number): Vec2 {
  const gap = distance(motion.from, motion.target);
  if (gap < 0.001) return motion.target;
  const progress = Math.min(1, Math.max(0, ((now - motion.startedAt) / 1000) * motion.speed / gap));
  return {
    x: motion.from.x + (motion.target.x - motion.from.x) * progress,
    z: motion.from.z + (motion.target.z - motion.from.z) * progress,
  };
}

export function motionIsWalking(motion: import("../../../types").OfficeMotion, now: number): boolean {
  return distance(motionPosition(motion, now), motion.target) > 0.02;
}

/** Deterministic visual-only motion for API outages; each browser derives the same walk from wall time. */
export function localFallbackMotion(
  agentId: string,
  activity: import("../../../types").OfficeMotion["activity"],
  seat: Vec2,
  bounds: Bounds,
  now: number,
): import("../../../types").OfficeMotion {
  if (activity !== "idle") {
    return { agentId, activity, from: seat, target: seat, startedAt: now, speed: 1.5, restUntil: null, lastEventId: 0 };
  }

  const hash = (value: string): number => {
    let result = 2166136261;
    for (const char of value) result = Math.imul(result ^ char.charCodeAt(0), 16777619);
    return result >>> 0;
  };
  const pointAt = (step: number): Vec2 => {
    const seed = hash(`${agentId}:${step}`);
    const xSeed = hash(`${agentId}:${step}:x`);
    return {
      x: bounds.minX + (seed / 0xffffffff) * (bounds.maxX - bounds.minX),
      z: bounds.minZ + (xSeed / 0xffffffff) * (bounds.maxZ - bounds.minZ),
    };
  };
  const travelMs = 2_800;
  const restMs = 1_800;
  const cycleMs = travelMs + restMs;
  const offset = hash(agentId) % cycleMs;
  const elapsed = now + offset;
  const step = Math.floor(elapsed / cycleMs);
  const phase = elapsed % cycleMs;
  const from = pointAt(step);
  const target = pointAt(step + 1);
  if (phase < travelMs) {
    const gap = distance(from, target);
    return { agentId, activity, from, target, startedAt: now - phase, speed: gap / (travelMs / 1_000), restUntil: null, lastEventId: 0 };
  }
  return {
    agentId,
    activity,
    from: target,
    target,
    startedAt: now - travelMs,
    speed: 1.5,
    restUntil: now + cycleMs - phase,
    lastEventId: 0,
  };
}

/** One step towards a target at a constant speed; never overshoots. */
export function stepToward(position: Vec2, target: Vec2, speed: number, seconds: number): { position: Vec2; moved: boolean } {
  const gap = distance(position, target);
  if (gap < 0.01) return { position: { ...target }, moved: false };
  const length = Math.min(gap, speed * seconds);
  return {
    position: { x: position.x + ((target.x - position.x) / gap) * length, z: position.z + ((target.z - position.z) / gap) * length },
    moved: true,
  };
}

/** Yaw that makes a figure (facing +z at yaw 0) look from one point to another. */
export function yawToward(from: Vec2, to: Vec2): number {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

/** Turns `current` towards `target` along the shorter way by at most `maxStep` radians. */
export function turnToward(current: number, target: number, maxStep: number): number {
  const difference = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + Math.max(-maxStep, Math.min(maxStep, difference));
}
