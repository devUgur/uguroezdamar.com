import { describe, it, expect } from "vitest";

describe("site selected-work queries (feature-local)", () => {
  it("exposes getSiteWorkItems, getSiteWorkSlugs, getSiteWorkItemBySlug as functions", async () => {
    const work = await import("../apps/site/src/features/selected-work/queries");
    expect(typeof work.getSiteWorkItems).toBe("function");
    expect(typeof work.getSiteWorkSlugs).toBe("function");
    expect(typeof work.getSiteWorkItemBySlug).toBe("function");
  });

  it("getSiteWorkSlugs returns a Promise resolving to array of { slug: string }", async () => {
    const { getSiteWorkSlugs } = await import("../apps/site/src/features/selected-work/queries");
    const result = await getSiteWorkSlugs();
    expect(Array.isArray(result)).toBe(true);
    expect(result.every((item) => typeof item === "object" && item !== null && "slug" in item && typeof (item as { slug: string }).slug === "string")).toBe(true);
  });
});
