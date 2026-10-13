import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const allowedExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"]);

// What each shared package must never import (docs/architecture/README.md, ADR 0017).
const forbiddenImports = {
  core: ["@ugur/", "@/", "next", "react", "server-only"],
  ui: ["@ugur/server", "@/", "server-only"],
  server: ["@ugur/ui", "@/", "react"],
};

const violations = [];

function importsOf(content) {
  const specifiers = [];
  const pattern = /(?:from\s+|import\s+|import\(\s*|require\(\s*)["']([^"']+)["']/g;
  for (const match of content.matchAll(pattern)) specifiers.push(match[1]);
  return specifiers;
}

function walk(dirPath, onFile) {
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) walk(fullPath, onFile);
    else if (allowedExtensions.has(path.extname(entry.name))) onFile(fullPath);
  }
}

for (const [name, forbidden] of Object.entries(forbiddenImports)) {
  const packageDir = path.join(rootDir, "packages", name);
  const relative = (fullPath) => path.relative(rootDir, fullPath).split(path.sep).join("/");

  walk(path.join(packageDir, "src"), (fullPath) => {
    for (const specifier of importsOf(fs.readFileSync(fullPath, "utf8"))) {
      const hit = forbidden.find((prefix) =>
        prefix.endsWith("/") ? specifier.startsWith(prefix) : specifier === prefix || specifier.startsWith(`${prefix}/`),
      );
      if (hit) violations.push(`${relative(fullPath)}: imports "${specifier}"`);
    }
  });

  // Source-first contract: apps compile these packages themselves, so nothing may be built first.
  const manifestPath = path.join(packageDir, "package.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  for (const [subpath, target] of Object.entries(manifest.exports ?? {})) {
    if (typeof target !== "string" || !target.startsWith("./src/")) {
      violations.push(`${relative(manifestPath)}: export "${subpath}" must point at a file in ./src`);
    }
  }
  for (const script of ["build", "dev"]) {
    if (manifest.scripts?.[script]) {
      violations.push(`${relative(manifestPath)}: has a "${script}" script, but shared packages are not built`);
    }
  }
}

if (violations.length > 0) {
  console.error("\n❌ Shared package boundary violated:\n");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  console.error("\nFix: keep packages source-first and move app- or server-specific code to its owner.\n");
  process.exit(1);
}

console.log("✅ guard:package-boundaries passed");
