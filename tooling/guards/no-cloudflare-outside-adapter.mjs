import fs from "node:fs";
import path from "node:path";

/**
 * ADR 0040, phase P1: the agent core in apps/api/src speaks to ports (src/platform/ports.ts). Cloudflare's module
 * and binding types appear only in the adapter folder src/cloudflare/, so another host can run the same core.
 */
const rootDir = process.cwd();
const apiSrc = path.join(rootDir, "apps/api/src");
const adapterDir = path.join(apiSrc, "cloudflare");

const forbidden = [
  { pattern: /from\s+["']cloudflare:[a-z]+["']/, what: "import from cloudflare:*" },
  {
    pattern: /\b(D1Database|D1PreparedStatement|KVNamespace|R2Bucket|VectorizeIndex|DurableObjectState|DurableObjectNamespace|DurableObjectStorage|DurableObjectId|ExportedHandler|ExecutionContext|WorkerEntrypoint|AiModels)\b/,
    what: "Cloudflare binding type",
  },
  { pattern: /\.idFromName\(/, what: "Durable Object lookup (use the ActorDirectory port)" },
];

const violations = [];

function walk(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (fullPath !== adapterDir) walk(fullPath);
      continue;
    }
    if (!/\.(ts|tsx|mts)$/.test(entry.name) || entry.name.endsWith(".d.ts")) continue;
    const lines = fs.readFileSync(fullPath, "utf8").split("\n");
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;
      for (const rule of forbidden) {
        if (rule.pattern.test(line)) {
          violations.push(`${path.relative(rootDir, fullPath).replace(/\\/g, "/")}:${index + 1} ${rule.what}`);
        }
      }
    });
  }
}

walk(apiSrc);

if (violations.length > 0) {
  console.error("\n❌ Cloudflare outside apps/api/src/cloudflare/:\n");
  for (const violation of violations) console.error(`- ${violation}`);
  console.error("\nFix: use the ports in apps/api/src/platform/ports.ts; Cloudflare code lives in src/cloudflare/ (ADR 0040).\n");
  process.exit(1);
}

console.log("✅ guard:no-cloudflare-outside-adapter passed");
