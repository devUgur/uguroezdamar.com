import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BrandMark } from "../apps/site/src/features/navigation/ui/BrandMark";

const iconSvg = readFileSync(resolve(import.meta.dirname, "../apps/site/app/icon.svg"), "utf8");

function attrs(svg: string, name: string) {
  return [...svg.matchAll(new RegExp(`\s${name}="([^"]+)"`, "g"))].map((m) => m[1].replace(/\s+/g, " "));
}

describe("site brand mark", () => {
  const html = renderToStaticMarkup(<BrandMark />);

  it("uses the geometry of the canonical app/icon.svg", () => {
    expect(attrs(html, "viewBox")).toEqual(attrs(iconSvg, "viewBox"));
    expect(attrs(html, "d")).toEqual(attrs(iconSvg, "d"));
    expect(attrs(html, "rx")).toEqual(attrs(iconSvg, "rx"));
    expect(attrs(html, "stroke-width")).toEqual(attrs(iconSvg, "stroke-width"));
  });

  it("uses the colours of the canonical app/icon.svg", () => {
    expect(attrs(html, "fill")).toEqual(attrs(iconSvg, "fill"));
    expect(attrs(html, "stroke")).toEqual(attrs(iconSvg, "stroke"));
  });

  it("is decorative; the surrounding link carries the accessible name", () => {
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toMatch(/<text|UÖ/);
  });
});
