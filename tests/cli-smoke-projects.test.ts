import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../tooling/cli/src/lib/infisical.ts", () => ({ secretValues: () => undefined }));

const origin = "http://localhost:3100";
const publishedSlugs = ["viralsync", "video-lab"] as const;

function siteFetch({ omitSitemapSlug, missingProject }: { omitSitemapSlug?: string; missingProject?: string } = {}) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = init?.method ?? "GET";

    if (url.pathname === "/api/health") {
      return Response.json({ ok: true, app: "site", commit: "a".repeat(40), database: "ok", client: null });
    }
    if (url.pathname === "/sitemap.xml") {
      const entries = publishedSlugs
        .filter((slug) => slug !== omitSitemapSlug)
        .map((slug) => `<loc>${origin}/projects/${slug}</loc>`)
        .join("");
      return new Response(`<urlset><loc>${origin}/projects</loc>${entries}</urlset>`, { status: 200 });
    }
    if (url.pathname === "/projects") return new Response("<main>ViralSync Video Lab</main>", { status: 200 });
    if (url.pathname === "/") return new Response("<main>Portfolio</main>", { status: 200 });
    if (url.pathname === "/work") return new Response(null, { status: 308 });
    if (url.pathname.startsWith("/projects/")) {
      const slug = url.pathname.slice("/projects/".length);
      const title = slug === "video-lab" ? "Video Lab" : "ViralSync";
      if (slug === missingProject) return new Response("Not found", { status: 404 });
      if (method === "HEAD") return new Response(null, { status: 200 });
      return new Response(`<html><head><title>${title} | Ugur Özdamar</title><link rel="canonical" href="${url.href}" /></head><body>${title}</body></html>`, { status: 200 });
    }
    if (url.pathname === "/api/contact") {
      if (init?.headers && new Headers(init.headers).get("content-type") !== "application/json") return new Response(null, { status: 415 });
      if (init?.headers && new Headers(init.headers).get("origin") === "https://attacker.example") return new Response(null, { status: 403 });
      return new Response(null, { status: 400 });
    }
    return new Response(null, { status: 404 });
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("portfolio smoke project routes", () => {
  it("requires each approved case study, cover, catalog card, canonical URL, and sitemap entry", async () => {
    vi.stubGlobal("fetch", siteFetch());
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { smoke } = await import("../tooling/cli/src/commands/smoke.ts");

    expect(await smoke({ site: origin })).toBe(0);
  });

  it("fails when a published project route is missing from the sitemap", async () => {
    vi.stubGlobal("fetch", siteFetch({ omitSitemapSlug: "video-lab" }));
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { smoke } = await import("../tooling/cli/src/commands/smoke.ts");

    expect(await smoke({ site: origin })).toBe(1);
  });

  it("fails when a published project detail route is a 404", async () => {
    vi.stubGlobal("fetch", siteFetch({ missingProject: "viralsync" }));
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { smoke } = await import("../tooling/cli/src/commands/smoke.ts");

    expect(await smoke({ site: origin })).toBe(1);
  });
});
