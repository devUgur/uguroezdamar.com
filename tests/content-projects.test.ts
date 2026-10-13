import { resolve } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

const siteDir = resolve(import.meta.dirname, "../apps/site");

const valid = {
  title: "Example",
  summary: "What it is.",
  category: "Tooling",
  status: "active",
  technologies: ["TypeScript"],
  repositoryVisibility: "none",
  updatedAt: "2026-10-13",
  role: "Developer",
  contributions: ["Built it"],
};

describe("project content", () => {
  let content: typeof import("../apps/site/src/content/projects");
  beforeAll(async () => {
    // The site reads `content/` relative to its own directory, as `next build` runs it.
    vi.spyOn(process, "cwd").mockReturnValue(siteDir);
    content = await import("../apps/site/src/content/projects");
  });

  it("parses every file in content/projects", async () => {
    const projects = await content.getProjects({ includeDrafts: true });
    expect(projects.length).toBeGreaterThan(0);
    for (const project of projects) {
      expect(project.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(project.body.trim().length).toBeGreaterThan(0);
    }
  });

  it("never returns a draft unless drafts are asked for", async () => {
    const published = await content.getProjects({ includeDrafts: false });
    expect(published.every((project) => !project.draft)).toBe(true);
    const drafts = (await content.getProjects({ includeDrafts: true })).filter((project) => project.draft);
    for (const draft of drafts) {
      expect(await content.getProjectBySlug(draft.slug, { includeDrafts: false })).toBeNull();
    }
  });

  it("keeps drafts out of the sitemap", async () => {
    const sitemap = (await import("../apps/site/app/sitemap")).default;
    const urls = (await sitemap()).map((entry) => entry.url);
    const drafts = (await content.getProjects({ includeDrafts: true })).filter((project) => project.draft);
    for (const draft of drafts) {
      expect(urls.some((url) => url.endsWith(`/projects/${draft.slug}`))).toBe(false);
    }
    expect(urls.some((url) => url.endsWith("/projects"))).toBe(true);
    expect(urls.some((url) => url.endsWith("/contact"))).toBe(true);
  });

  it("accepts a complete project and applies defaults", () => {
    const project = content.parseProject("example", valid, "Body");
    expect(project).toMatchObject({ slug: "example", featured: false, draft: false, links: {} });
  });

  it("refuses to publish a case study without role and contributions", () => {
    const { role: _role, contributions: _contributions, ...incomplete } = valid;
    expect(() => content.parseProject("example", incomplete, "Body")).toThrow(/role[\s\S]*contributions|required to publish/);
    expect(() => content.parseProject("example", { ...incomplete, draft: true }, "Body")).not.toThrow();
  });

  it("refuses a link to a repository that is not public", () => {
    const linked = { ...valid, repositoryVisibility: "private", links: { github: "https://github.com/example/private" } };
    expect(() => content.parseProject("example", linked, "Body")).toThrow(/public repository/);
  });

  it("rejects unknown keys and malformed values", () => {
    expect(() => content.parseProject("example", { ...valid, sumary: "typo" }, "Body")).toThrow(/content\/projects\/example\.mdx/);
    expect(() => content.parseProject("example", { ...valid, updatedAt: "yesterday" }, "Body")).toThrow();
    expect(() => content.parseProject("example", { ...valid, cover: { src: "https://elsewhere.example/a.png", alt: "x" } }, "Body")).toThrow();
  });

  it("formats periods", () => {
    expect(content.formatPeriod(undefined)).toBeNull();
    expect(content.formatPeriod({ from: 2024, ongoing: true })).toBe("2024–Present");
    expect(content.formatPeriod({ from: 2022, to: 2024, ongoing: false })).toBe("2022–2024");
    expect(content.formatPeriod({ from: 2023, to: 2023, ongoing: false })).toBe("2023");
  });
});

describe("profile content", () => {
  it("orders entries newest first and hides empty sections", async () => {
    const profile = await import("../apps/site/src/content/profile");
    const parsed = profile.ProfileSchema.parse({
      experience: [
        { title: "Old", period: { from: 2018, to: 2020 } },
        { title: "Current", period: { from: 2021, ongoing: true } },
      ],
    });
    expect(profile.byRecency(parsed.experience).map((entry) => entry.title)).toEqual(["Current", "Old"]);
    expect(profile.hasAbout(parsed)).toBe(true);
    expect(profile.hasEducation(parsed)).toBe(false);
    expect(profile.hasAbout(profile.ProfileSchema.parse({}))).toBe(false);
  });
});
