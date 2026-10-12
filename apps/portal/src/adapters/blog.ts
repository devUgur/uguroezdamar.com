import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";

const contentDir = path.join(process.cwd(), "../site/content/blog");

function parseFrontmatter(raw: string) {
	const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
	if (!match) return { data: {} as Record<string, unknown>, content: raw };
	const data = parse(match[1]);
	return { data: data && typeof data === "object" ? data as Record<string, unknown> : {}, content: match[2] };
}

export async function getBlogPosts() {
	const entries = await fs.readdir(contentDir).catch(() => [] as string[]);
	const posts = await Promise.all(entries.filter((entry) => entry.endsWith(".mdx")).map(async (file) => {
		const slug = file.replace(/\.mdx$/, "");
		const raw = await fs.readFile(path.join(contentDir, file), "utf8");
		const parsed = parseFrontmatter(raw);
		return { slug, title: String(parsed.data.title ?? slug), summary: String(parsed.data.summary ?? ""), date: parsed.data.date ? String(parsed.data.date) : undefined, source: parsed.content };
	}));
	return posts.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}
