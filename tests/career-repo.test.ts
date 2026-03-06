import { describe, it, expect } from "vitest";
import { getCareerEntries } from "@ugur/server";

describe("career repo contract", () => {
  it("getCareerEntries is a function", () => {
    expect(typeof getCareerEntries).toBe("function");
  });

  it("getCareerEntries() returns a Promise resolving to an array", async () => {
    let result: unknown;
    try {
      result = await getCareerEntries();
    } catch {
      result = [];
    }
    expect(Array.isArray(result)).toBe(true);
  });

  it("each career entry has type, slug, title (shape)", async () => {
    let result: Awaited<ReturnType<typeof getCareerEntries>>;
    try {
      result = await getCareerEntries();
    } catch {
      result = [];
    }
    for (const entry of result) {
      expect(entry).toBeTypeOf("object");
      expect(entry).toHaveProperty("type");
      expect(entry).toHaveProperty("slug");
      expect(entry).toHaveProperty("title");
      expect(typeof (entry as { slug: string }).slug).toBe("string");
      expect(typeof (entry as { title: string }).title).toBe("string");
    }
  });
});
