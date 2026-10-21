import { describe, expect, it } from "vitest";
import { ALL_DEV_PORTS, DEFAULT_PORTS, killPorts, resolvePorts } from "../tooling/cli/src/commands/kill-ports.ts";

describe("kill-ports resolver", () => {
  it("defaults to standard uguroezdamar.com dev ports including 3100, 3101, 3102, 3103, and 4983", () => {
    const ports = resolvePorts();
    expect(ports).toEqual([...DEFAULT_PORTS]);
    expect(ports).toContain(3100);
    expect(ports).toContain(3101);
    expect(ports).toContain(3102);
    expect(ports).toContain(3103);
    expect(ports).toContain(4983);
  });

  it("resolves user-specified positional or flag ports", () => {
    expect(resolvePorts({ ports: ["3100"] })).toEqual([3100]);
    expect(resolvePorts({ ports: [3100, 3101, 8080] })).toEqual([3100, 3101, 8080]);
    expect(resolvePorts({ ports: ["3100,3101", "8080"] })).toEqual([3100, 3101, 8080]);
  });

  it("deduplicates and sorts custom ports", () => {
    expect(resolvePorts({ ports: [3105, 3101, 3101, 3100] })).toEqual([3100, 3101, 3105]);
  });

  it("resolves the full dev port range with all: true", () => {
    const ports = resolvePorts({ all: true });
    expect(ports).toEqual([...ALL_DEV_PORTS]);
    expect(ports.length).toBeGreaterThan(DEFAULT_PORTS.length);
  });

  it("filters out invalid port numbers", () => {
    expect(resolvePorts({ ports: ["not-a-port", "-1", "70000", "4000"] })).toEqual([4000]);
    // If only invalid ports provided, safely falls back to default dev ports
    expect(resolvePorts({ ports: ["invalid"] })).toEqual([...DEFAULT_PORTS]);
  });

  it("executes killPorts without crashing", () => {
    // When called on high unused ports, cleanly returns exit code 0
    const code = killPorts({ ports: [59998] });
    expect(code).toBe(0);
  }, 30_000);
});
