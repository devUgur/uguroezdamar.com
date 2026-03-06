import { describe, it, expect } from "vitest";
import * as server from "@ugur/server";

describe("server exports smoke", () => {
  it("exposes getProjects as a function", () => {
    expect(typeof server.getProjects).toBe("function");
  });

  it("exposes createCareerEntry as a function", () => {
    expect(typeof server.createCareerEntry).toBe("function");
  });

  it("exposes getCareerEntries as a function", () => {
    expect(typeof server.getCareerEntries).toBe("function");
  });
});
