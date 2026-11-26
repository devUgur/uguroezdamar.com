import { describe, expect, it } from "vitest";
import { buildOfficeLayout } from "../apps/api/src/office/layout.ts";
import { buildOffice } from "../apps/office/src/features/agents/ui/office/world/layout.ts";

/**
 * apps/api cannot import workspace packages (ADR 0024), so the desk layout exists twice: on the
 * server, where it decides where agents stand, and in the portal, where it draws them and serves as
 * the offline preview. ADR 0025 requires both to stay identical; this test is what enforces it.
 */
const CASES: { name: string; desks: { x: number; y: number }[] }[] = [
  { name: "no agents", desks: [] },
  { name: "one agent at the first desk", desks: [{ x: 1, y: 1 }] },
  { name: "one agent without a desk", desks: [{ x: 0, y: 0 }] },
  { name: "one full row", desks: [1, 2, 3, 4].map((x) => ({ x, y: 1 })) },
  { name: "two rows", desks: [{ x: 1, y: 1 }, { x: 3, y: 2 }, { x: 2, y: 3 }] },
  { name: "more agents than columns", desks: [1, 2, 3, 4, 5, 6].map((x) => ({ x, y: 1 })) },
  { name: "list order decides without desks", desks: [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }] },
];

describe("desk layout: server and portal agree", () => {
  for (const { name, desks } of CASES) {
    it(name, () => {
      const portal = buildOffice(desks);
      const server = buildOfficeLayout(desks.map((desk, index) => ({ id: `agent-${index}`, deskX: desk.x, deskY: desk.y })));

      expect(server.agents.map(({ desk, seat }) => ({ desk, seat }))).toEqual(portal.placements);
      expect(server.bounds).toEqual(portal.bounds);
    });
  }
});
