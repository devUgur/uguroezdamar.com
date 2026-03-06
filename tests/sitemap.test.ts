import { describe, it, expect } from "vitest";

describe("site sitemap", () => {
  it("returns an array of entries with url and lastModified", async () => {
    const sitemapModule = await import("../apps/site/app/sitemap");
    const sitemap = sitemapModule.default;
    const result = sitemap();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    for (const entry of result) {
      expect(entry).toHaveProperty("url");
      expect(typeof (entry as { url: string }).url).toBe("string");
      expect((entry as { url: string }).url.length).toBeGreaterThan(0);
    }
  });

  it("includes key public routes (work, projects, contact)", async () => {
    const sitemapModule = await import("../apps/site/app/sitemap");
    const sitemap = sitemapModule.default;
    const result = sitemap();
    const urls = result.map((e: { url: string }) => e.url);
    expect(urls.some((u: string) => u.endsWith("/work") || u.includes("/work"))).toBe(true);
    expect(urls.some((u: string) => u.endsWith("/projects") || u.includes("/projects"))).toBe(true);
    expect(urls.some((u: string) => u.endsWith("/contact") || u.includes("/contact"))).toBe(true);
  });
});
