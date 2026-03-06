import { describe, it, expect } from "vitest";

describe("site projects queries (feature-local) contract", () => {
  it("getSiteProjects returns a Promise resolving to an array", async () => {
    const { getSiteProjects } = await import("../apps/site/src/features/projects/queries");
    const result = await getSiteProjects();
    expect(Array.isArray(result)).toBe(true);
  });

  it("each project has slug, title, and featured (shape)", async () => {
    const { getSiteProjects } = await import("../apps/site/src/features/projects/queries");
    const result = await getSiteProjects();
    for (const p of result) {
      expect(p).toBeTypeOf("object");
      expect(p).toHaveProperty("slug");
      expect(typeof (p as { slug: string }).slug).toBe("string");
      expect(p).toHaveProperty("title");
      expect(typeof (p as { title: string }).title).toBe("string");
      expect(p).toHaveProperty("featured");
      expect(typeof (p as { featured: boolean }).featured).toBe("boolean");
    }
  });
});
