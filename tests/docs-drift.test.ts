import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");

/** Records of the past: they may name what was true then. */
const HISTORICAL = [/^docs\/audits\//, /^docs\/product\/evidence\//, /^docs\/architecture\/decisions\/00(0\d|1[0-5])-/];
const SKIPPED_DIRS = ["node_modules", ".next", "dist", ".turbo", ".git", ".claude", ".pnpm-store"];

function markdown(dir: string): string[] {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return SKIPPED_DIRS.includes(entry.name) ? [] : markdown(path);
    return entry.name.endsWith(".md") ? [path] : [];
  });
}

const living = markdown("").filter((file) => !HISTORICAL.some((pattern) => pattern.test(file)));

describe("documentation stays in step with the system", () => {
  it("keeps one rule source and pointer files that hold no rules of their own", () => {
    expect(existsSync(join(root, "AGENTS.md"))).toBe(true);
    for (const pointer of ["CLAUDE.md", ".github/copilot-instructions.md", ".trae/rules/project.md"]) {
      const text = readFileSync(join(root, pointer), "utf8");
      expect(text, pointer).toContain("AGENTS.md");
      expect(text.split("\n").length, pointer).toBeLessThan(8);
    }
    expect(existsSync(join(root, ".github/instructions"))).toBe(false);
  });

  it("does not present retired technology as current", () => {
    // A line may name the old stack only while saying that it is gone.
    const retired = /mongodb|netlify|static export|statischer export|\.env\.example/i;
    const pastTense =
      /ersetzt|entfernt|existiert nicht mehr|zurückgezogen|früher|statt|abgelehnt|nicht mehr|keine|gab es|nannte|hätte|wurde|zeigten|gewählt/i;
    const offenders = living.flatMap((file) =>
      readFileSync(join(root, file), "utf8")
        .split("\n")
        .map((line, index) => ({ line, where: `${file}:${index + 1}` }))
        .filter(({ line }) => retired.test(line) && !pastTense.test(line))
        .map(({ where }) => where),
    );
    expect(offenders).toEqual([]);
  });

  it("links only to files that exist", () => {
    const broken = living.flatMap((file) => {
      const dir = file.includes("/") ? file.slice(0, file.lastIndexOf("/")) : "";
      return [...readFileSync(join(root, file), "utf8").matchAll(/\]\((?!https?:|#|mailto:)([^)#\s]+)(#[^)]*)?\)/g)]
        .map((match) => decodeURI(match[1] as string))
        .filter((target) => !existsSync(resolve(root, dir, target)))
        .map((target) => `${file} → ${target}`);
    });
    expect(broken).toEqual([]);
  });
});
