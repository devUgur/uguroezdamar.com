import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

export type PostRecord = {
	slug: string;
	title: string;
	summary: string;
	date?: string;
	source: string;
};

const contentDir = path.join(process.cwd(), "content", "blog");

export async function getAllPosts(): Promise<PostRecord[]> {
	const entries = await fs.readdir(contentDir).catch(() => [] as string[]);
	const files = entries.filter((entry) => entry.endsWith(".mdx"));

	const posts = await Promise.all(
		files.map(async (file) => {
			const slug = file.replace(/\.mdx$/, "");
			const raw = await fs.readFile(path.join(contentDir, file), "utf8");
			const parsed = matter(raw);

			return {
				slug,
				title: String(parsed.data.title ?? slug),
				summary: String(parsed.data.summary ?? ""),
				date: parsed.data.date ? String(parsed.data.date) : undefined,
				source: parsed.content,
			} satisfies PostRecord;
		}),
	);

	posts.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
	return posts;
}

export async function getPostBySlug(slug: string): Promise<PostRecord | null> {
	const filePath = path.join(contentDir, `${slug}.mdx`);
	const raw = await fs.readFile(filePath, "utf8").catch(() => null);
	if (!raw) {
		return null;
	}

	const parsed = matter(raw);
	return {
		slug,
		title: String(parsed.data.title ?? slug),
		summary: String(parsed.data.summary ?? ""),
		date: parsed.data.date ? String(parsed.data.date) : undefined,
		source: parsed.content,
	} satisfies PostRecord;
}