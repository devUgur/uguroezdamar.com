import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { STAGES } from "../tooling/cli/src/lib/stages";
import { RETIRED, SECRETS, secretsFor } from "../tooling/cli/src/secrets-manifest";

const root = resolve(import.meta.dirname, "..");
/** Set by the platform or the toolchain, not by us. */
const PLATFORM = new Set(["NODE_ENV", "NEXT_TELEMETRY_DISABLED", "NEON_ORG_ID", "VERCEL_GIT_COMMIT_SHA", "VERCEL_URL"]);

function sources(dir: string): string[] {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      return ["node_modules", ".next", "dist", ".turbo", "drizzle"].includes(entry.name) ? [] : sources(path);
    }
    return /\.(ts|tsx|mjs)$/.test(entry.name) ? [path] : [];
  });
}

describe("secrets manifest", () => {
  const declared = new Set(SECRETS.map((spec) => spec.key));

  it("declares every environment variable the code reads", () => {
    const undeclared = new Map<string, string>();
    for (const file of ["apps", "packages", "tooling"].flatMap(sources)) {
      for (const [, key] of readFileSync(join(root, file), "utf8").matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) {
        if (!declared.has(key) && !PLATFORM.has(key)) undeclared.set(key, file);
      }
    }
    expect(Object.fromEntries(undeclared)).toEqual({});
  });

  it("lists each key once and keeps retired keys out", () => {
    expect(SECRETS.map((spec) => spec.key)).toEqual([...declared]);
    expect(RETIRED.filter((key) => declared.has(key))).toEqual([]);
  });

  it("gives every stage the database and the keys that are neither optional nor stage-limited", () => {
    for (const stage of Object.keys(STAGES) as (keyof typeof STAGES)[]) {
      const keys = secretsFor(stage).map((spec) => spec.key);
      expect(keys).toEqual(expect.arrayContaining(["DATABASE_URL", "DATABASE_URL_DIRECT"]));
    }
  });

  it("lets turbo pass every declared key through to the apps", () => {
    // Turbo runs tasks in strict env mode: an unlisted variable never reaches `next dev`.
    const turbo = JSON.parse(readFileSync(join(root, "turbo.json"), "utf8")) as {
      globalPassThroughEnv: string[];
      tasks: Record<string, { env?: string[] }>;
    };
    const passed = new Set([...turbo.globalPassThroughEnv, ...(turbo.tasks.build?.env ?? [])]);
    expect([...declared].filter((key) => !passed.has(key))).toEqual([]);
    expect(turbo.tasks.dev?.env).toEqual(turbo.tasks.build?.env);
  });

  it("keeps .env files and the retired database out of the repository", () => {
    const gitignore = readFileSync(join(root, ".gitignore"), "utf8");
    expect(gitignore).toMatch(/^\.env$/m);
    expect(gitignore).toMatch(/^\.env\.\*$/m);
    const serverPackage = readFileSync(join(root, "packages/server/package.json"), "utf8");
    expect(serverPackage).not.toContain('"mongodb"');
  });
});
