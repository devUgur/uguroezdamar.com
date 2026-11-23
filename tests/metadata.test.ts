import { resolve } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

const siteDir = resolve(import.meta.dirname, "../apps/site");

vi.mock("next/font/local", () => ({
  default: () => ({ variable: "mock-font-var" }),
}));

describe("OpenGraph & Twitter metadata coverage", () => {
  beforeAll(() => {
    vi.spyOn(process, "cwd").mockReturnValue(siteDir);
  });

  it("en layout exports full social card metadata with image", async () => {
    const { metadata } = await import("../apps/site/app/(en)/layout");
    expect(metadata.openGraph).toBeDefined();
    expect(metadata.openGraph?.images).toEqual([
      expect.objectContaining({ url: "/og-image.png", width: 1200, height: 630 }),
    ]);
    expect(metadata.twitter).toBeDefined();
    expect(metadata.twitter?.images).toEqual(["/og-image.png"]);
  });

  it("de layout exports full German social card metadata with image", async () => {
    const { metadata } = await import("../apps/site/app/(de)/layout");
    expect(metadata.openGraph).toBeDefined();
    expect(metadata.openGraph?.images).toEqual([
      expect.objectContaining({ url: "/og-image-de.png", width: 1200, height: 630 }),
    ]);
    expect(metadata.twitter).toBeDefined();
    expect(metadata.twitter?.images).toEqual(["/og-image-de.png"]);
  });

  it("project detail pages generate og and twitter images", async () => {
    const enModule = await import("../apps/site/app/(en)/(marketing)/projects/[slug]/page");
    const enMeta = await enModule.generateMetadata({
      params: Promise.resolve({ slug: "viralsync" }),
    });
    expect(enMeta.openGraph?.images).toBeDefined();
    expect(enMeta.twitter?.images).toBeDefined();

    const deModule = await import("../apps/site/app/(de)/de/projects/[slug]/page");
    const deMeta = await deModule.generateMetadata({
      params: Promise.resolve({ slug: "viralsync" }),
    });
    expect(deMeta.openGraph?.images).toBeDefined();
    expect(deMeta.twitter?.images).toBeDefined();
  });
});
