import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import type { ProjectKind, ProjectRecord } from "./validators";

const contentDirBase = path.join(process.cwd(), "content", "projects");

async function resolveContentDir() {
	const cwd = process.cwd();
	const candidates = [
		contentDirBase,
		path.join(cwd, "apps", "site", "content", "projects"),
		path.join(cwd, "content", "projects"),
	];

	for (const candidate of candidates) {
		try {
			await fs.access(candidate);
			return candidate;
		} catch {
			continue;
		}
	}

	return contentDirBase;
}

function toProjectKind(value: unknown): ProjectKind | null {
	const kindValue = String(value ?? "").toLowerCase();
	if (kindValue === "web" || kindValue === "mobile" || kindValue === "desktop" || kindValue === "cli") {
		return kindValue;
	}
	if (kindValue === "ios" || kindValue === "android") return "mobile";
	if (kindValue === "terminal") return "cli";
	return null;
}

function mapMdxProject(slug: string, parsed: matter.GrayMatterFile<string>): ProjectRecord {
	const now = new Date().toISOString();
	return {
		_id: slug,
		slug,
		title: String(parsed.data.title ?? slug),
		summary: String(parsed.data.summary ?? ""),
		content: parsed.content,
		tags: Array.isArray(parsed.data.tags) ? parsed.data.tags.map(String) : [],
		kinds: Array.isArray(parsed.data.kinds)
			? parsed.data.kinds.map(toProjectKind).filter((kind): kind is ProjectKind => Boolean(kind))
			: [],
		tech: Array.isArray(parsed.data.tech) ? parsed.data.tech.map(String) : [],
		links: Array.isArray(parsed.data.links)
			? parsed.data.links
					.map((item: any) => ({
						platform: String(item?.platform ?? item?.label ?? "link"),
						label: item?.label ? String(item.label) : undefined,
						url: item?.url ? String(item.url) : "",
						kind: toProjectKind(item?.kind) || undefined,
					}))
					.filter((item: any) => !!item.url)
			: [],
		images: Array.isArray(parsed.data.images)
			? parsed.data.images
					.map((image: any) => ({
						url: String(image?.url ?? ""),
						alt: image?.alt ? String(image.alt) : undefined,
						kind: image?.kind === "cover" || image?.kind === "gallery" ? image.kind : (toProjectKind(image?.kind) || undefined),
					}))
					.filter((image: any) => !!image.url)
			: [],
		coverImageUrl: parsed.data.coverImageUrl ? String(parsed.data.coverImageUrl) : null,
		previewImageUrl: parsed.data.previewImageUrl ? String(parsed.data.previewImageUrl) : null,
		previewUpdatedAt: null,
		status: "published",
		featured: Boolean(parsed.data.featured ?? false),
		isSecret: Boolean(parsed.data.isSecret ?? false),
		sortIndex: Number(parsed.data.sortIndex ?? 0),
		publishedAt: null,
		createdAt: now,
		updatedAt: now,
	};
}

export async function getMdxProjects(): Promise<ProjectRecord[]> {
	const contentDir = await resolveContentDir();
	const entries = await fs.readdir(contentDir).catch(() => [] as string[]);
	const files = entries.filter((fileName) => fileName.endsWith(".mdx"));

	const projects = await Promise.all(
		files.map(async (fileName) => {
			const slug = fileName.replace(/\.mdx$/, "");
			const raw = await fs.readFile(path.join(contentDir, fileName), "utf8");
			const parsed = matter(raw);
			return mapMdxProject(slug, parsed);
		}),
	);

	return projects;
}

export async function getMdxProjectBySlug(slug: string): Promise<ProjectRecord | null> {
	const contentDir = await resolveContentDir();
	const filePath = path.join(contentDir, `${slug}.mdx`);
	const raw = await fs.readFile(filePath, "utf8").catch(() => null);
	if (!raw) return null;

	const parsed = matter(raw);
	return mapMdxProject(slug, parsed);
}
