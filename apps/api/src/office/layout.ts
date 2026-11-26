/** Coordinates shared with the portal's 3D scene (world units, not pixels). */
export interface Vec2 {
  x: number;
  z: number;
}

export interface OfficeBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface DeskAssignment {
  agentId: string;
  desk: Vec2;
  seat: Vec2;
}

export interface OfficeLayout {
  agents: DeskAssignment[];
  bounds: OfficeBounds;
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

export function randomSpot(bounds: OfficeBounds): Vec2 {
  const values = new Uint32Array(2);
  crypto.getRandomValues(values);
  return {
    x: bounds.minX + ((values[0] ?? 0) / 0xffffffff) * (bounds.maxX - bounds.minX),
    z: bounds.minZ + ((values[1] ?? 0) / 0xffffffff) * (bounds.maxZ - bounds.minZ),
  };
}

const DESK_COLUMNS = 4;
const DESK_SPACING_X = 3.4;
const ROW_SPACING_Z = 3.6;
const FIRST_ROW_Z = -3;
const SEAT_OFFSET_Z = 1.15;
const MIN_HALF_WIDTH = 5.5;

/** Keep desk slots aligned with the public 3D layout implementation in the portal. */
export function buildOfficeLayout(agents: { id: string; deskX: number; deskY: number }[]): OfficeLayout {
  const slots = agents.map(({ deskX, deskY }, index) => ({
    column: (Math.max(1, deskX || index + 1) - 1) % DESK_COLUMNS,
    row: Math.max(1, deskY || 1) - 1,
  }));
  const columns = slots.map(({ column }) => column);
  const first = columns.length ? Math.min(...columns) : 0;
  const last = columns.length ? Math.max(...columns) : 0;
  const center = (first + last) / 2;
  const layoutAgents = slots.map(({ column, row }, index) => {
    const x = (column - center) * DESK_SPACING_X;
    const z = FIRST_ROW_Z + row * ROW_SPACING_Z;
    return {
      agentId: agents[index]?.id ?? "",
      desk: { x, z },
      seat: { x, z: z + SEAT_OFFSET_Z },
    };
  });
  const halfWidth = Math.max(MIN_HALF_WIDTH, ((last - first + 1) * DESK_SPACING_X + 3) / 2);
  const rowZ = layoutAgents.reduce((deepest, agent) => Math.max(deepest, agent.desk.z), FIRST_ROW_Z);

  return {
    agents: layoutAgents,
    bounds: { minX: -halfWidth + 0.5, maxX: halfWidth - 0.5, minZ: rowZ + 2.4, maxZ: rowZ + 6 },
  };
}
