import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const serverSrc = path.join(rootDir, "packages/server/src");

const forbiddenPatterns = [
  /from\s+["']next(?:\/[^"']*)?["']/g,
  /from\s+["']next-mdx-remote(?:\/[^"']*)?["']/g,
];

const violations = [];

function walk(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    const ext = path.extname(entry.name);
    if (![".ts", ".tsx", ".js", ".jsx"].includes(ext)) continue;

    const content = fs.readFileSync(fullPath, "utf8");
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(content)) {
        const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, "/");
        violations.push(`${relativePath}`);
        break;
      }
    }
  }
}

walk(serverSrc);

if (violations.length > 0) {
  console.error("\n❌ Next.js imports detected in packages/server/src:\n");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  console.error("\nFix: Move Next.js-specific logic to app adapters.\n");
  process.exit(1);
}

console.log("✅ guard:no-next-in-server passed");
