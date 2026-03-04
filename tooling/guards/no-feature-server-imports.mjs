import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const appsDir = path.join(rootDir, "apps");
const allowedExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"]);
const ignoredDirs = new Set([".git", "node_modules", ".next", ".turbo", "dist", "coverage", ".repoan"]);

const forbiddenPatterns = [
	/from\s+["']@\/features\/[^"']+\/server(?:\/[^"']*)?["']/g,
	/require\(\s*["']@\/features\/[^"']+\/server(?:\/[^"']*)?["']\s*\)/g,
];

const violations = [];

function walk(dirPath) {
	if (!fs.existsSync(dirPath)) return;

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

		const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, "/");
		if (/^apps\/[^/]+\/src\/server\//.test(relativePath)) {
			continue;
		}

		const content = fs.readFileSync(fullPath, "utf8");
		for (const pattern of forbiddenPatterns) {
			const match = pattern.exec(content);
			pattern.lastIndex = 0;
			if (match) {
				violations.push(`${relativePath}: ${match[0]}`);
				break;
			}
		}
	}
}

walk(appsDir);

if (violations.length > 0) {
	console.error("\n❌ App code must not import features/*/server directly. Use @ugur/server or app-local loaders.\n");
	for (const violation of violations) {
		console.error(`- ${violation}`);
	}
	console.error("\nFix: move server logic usage behind apps/*/src/server/* loaders or use @ugur/server entrypoints.\n");
	process.exit(1);
}

console.log("✅ guard:no-feature-server-imports passed");
