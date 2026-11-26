import { describe, expect, it } from "vitest";
import {
  BACK_WALL_Z,
  buildOffice,
  distance,
  randomSpot,
  stepToward,
  turnToward,
  yawToward,
} from "../apps/office/src/features/agents/ui/office/world/layout.ts";

describe("3D office layout", () => {
  it("seats every agent at its own desk, in front of the back wall, looking at it", () => {
    const { placements } = buildOffice([1, 2, 3, 4, 5].map((slot) => ({ x: slot, y: 1 })));
    const seats = new Set(placements.map((placement) => `${placement.seat.x.toFixed(2)},${placement.seat.z.toFixed(2)}`));
    expect(seats.size).toBe(4); // five slots on four columns share a desk: the data decides, the layout never throws
    for (const { desk, seat } of placements) {
      expect(desk.z).toBeGreaterThan(BACK_WALL_Z);
      expect(seat.z).toBeGreaterThan(desk.z);
      expect(Math.cos(yawToward(seat, desk))).toBeLessThan(-0.99); // faces -z, towards the desk
    }
  });

  it("centers a single agent and falls back to list order without a desk", () => {
    expect(buildOffice([{ x: 1, y: 1 }]).placements[0]?.desk.x).toBeCloseTo(0);
    expect(buildOffice([{ x: 0, y: 0 }, { x: 0, y: 0 }]).placements[1]?.desk.x).toBeGreaterThan(buildOffice([{ x: 0, y: 0 }]).placements[0]?.desk.x ?? 0);
  });

  it("sizes the room to the desks and keeps the open floor in front of the last row", () => {
    const wide = buildOffice([1, 2, 3, 4].map((slot) => ({ x: slot, y: 1 })));
    const single = buildOffice([{ x: 1, y: 1 }]);
    expect(wide.halfWidth).toBeGreaterThan(single.halfWidth);
    const office = buildOffice([{ x: 1, y: 1 }, { x: 1, y: 2 }]);
    expect(office.bounds.minZ).toBeGreaterThan(Math.max(...office.placements.map((placement) => placement.seat.z)));
    expect(BACK_WALL_Z + office.depth).toBeGreaterThan(office.bounds.maxZ);
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const spot = randomSpot(office.bounds);
      expect(spot.x).toBeGreaterThanOrEqual(office.bounds.minX);
      expect(spot.z).toBeLessThanOrEqual(office.bounds.maxZ);
    }
  });
});

describe("figure motion", () => {
  it("moves at a constant speed and stops exactly on the target", () => {
    const first = stepToward({ x: 0, z: 0 }, { x: 3, z: 4 }, 2, 0.5);
    expect(first.moved).toBe(true);
    expect(distance({ x: 0, z: 0 }, first.position)).toBeCloseTo(1);
    const last = stepToward({ x: 2.9, z: 3.9 }, { x: 3, z: 4 }, 2, 1);
    expect(last.position).toEqual({ x: 3, z: 4 });
    expect(stepToward({ x: 3, z: 4 }, { x: 3, z: 4 }, 2, 1).moved).toBe(false);
  });

  it("turns along the shorter way and never past the target", () => {
    expect(turnToward(3, -3, 0.1)).toBeGreaterThan(3); // across ±π, not through 0
    expect(turnToward(0, 0.05, 0.1)).toBeCloseTo(0.05);
  });
});
