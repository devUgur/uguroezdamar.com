import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const allowedExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"]);
const ignoredDirs = new Set([".git", "node_modules", ".next", ".turbo", "dist", "coverage"]);
const forbiddenPatterns = [
  /from\s+["'][^"']*shared\/ui[^"']*["']/g,
  /require\(\s*["'][^"']*shared\/ui[^"']*["']\s*\)/g,
];

const violations = [];

function walk(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) {
        walk(fullPath);
      }
      continue;
    }

    const ext = path.extname(entry.name);
    if (!allowedExtensions.has(ext)) continue;

    const content = fs.readFileSync(fullPath, "utf8");
    for (const pattern of forbiddenPatterns) {
      const match = pattern.exec(content);
      pattern.lastIndex = 0;
      if (match) {
        const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, "/");
        violations.push(`${relativePath}: ${match[0]}`);
        break;
      }
    }
  }
}

walk(rootDir);

if (violations.length > 0) {
  console.error("Legacy shared/ui imports detected:\n");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("No legacy shared/ui imports found.");
