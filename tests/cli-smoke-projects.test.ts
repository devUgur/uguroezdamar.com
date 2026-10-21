import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../tooling/cli/src/lib/infisical.ts", () => ({ secretValues: () => undefined }));

const origin = "http://localhost:3100";
const publishedSlugs = ["viralsync", "video-lab"] as const;
const localizedPaths = [
  "/", "/de", "/projects", "/de/projects", "/about", "/de/about", "/education", "/de/education",
  "/contact", "/de/contact", "/blog", "/de/blog", "/privacy", "/de/privacy", "/imprint", "/de/imprint",
  ...publishedSlugs.flatMap((slug) => [`/projects/${slug}`, `/de/projects/${slug}`]),
];

function localizedHtml(pathname: string, content: string) {
  const german = pathname === "/de" || pathname.startsWith("/de/");
  const enPath = german ? (pathname === "/de" ? "/" : pathname.slice(3)) : pathname;
  const dePath = enPath === "/" ? "/de" : `/de${enPath}`;
  const canonical = `${origin}${pathname}`;
  return `<html lang="${german ? "de" : "en"}"><head><link rel="canonical" href="${canonical}" /><link rel="alternate" hrefLang="en" href="${origin}${enPath}" /><link rel="alternate" hrefLang="de" href="${origin}${dePath}" /><title>${content}</title></head><body>${content}</body></html>`;
}

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
    if (url.pathname === "/projects" || url.pathname === "/de/projects") return new Response(localizedHtml(url.pathname, "ViralSync Video Lab"), { status: 200 });
    if (url.pathname === "/" || url.pathname === "/de") return new Response(localizedHtml(url.pathname, "Portfolio"), { status: 200 });
    if (url.pathname === "/work") return new Response(null, { status: 308 });
    if (url.pathname.startsWith("/projects/") || url.pathname.startsWith("/de/projects/")) {
      const slug = url.pathname.startsWith("/de/") ? url.pathname.slice("/de/projects/".length) : url.pathname.slice("/projects/".length);
      const title = slug === "video-lab" ? "Video Lab" : "ViralSync";
      if (slug === missingProject) return new Response("Not found", { status: 404 });
      if (method === "HEAD") return new Response(null, { status: 200 });
      return new Response(localizedHtml(url.pathname, `${title} | Ugur Özdamar`), { status: 200 });
    }
    if (localizedPaths.includes(url.pathname)) return new Response(localizedHtml(url.pathname, "Localized page"), { status: 200 });
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
