import "server-only";

export function sanitizeProjectSlug(value: string) {
	return value.toLowerCase().replace(/[^a-z0-9-_]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

/** Build storage key for project assets. Use subPath for app-scoped assets (e.g. "web", "mobile"). */
export function buildProjectAssetKey(slug: string, originalFileName: string, subPath?: string) {
	const safeSlug = sanitizeProjectSlug(slug || "project");
	const ext = originalFileName.includes(".") ? originalFileName.split(".").pop() : "bin";
	const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
	const prefix = subPath ? `project-assets/${safeSlug}/${subPath}` : `project-assets/${safeSlug}`;
	return `${prefix}/${fileName}`;
}

export function collectProjectAssetUrls(project: {
	coverImageUrl?: string | null;
	previewImageUrl?: string | null;
	images?: Array<{ url?: string | null }>;
	apps?: Array<{ images?: Array<{ url?: string | null }> }>;
}) {
	return Array.from(
		new Set(
			[
				project.coverImageUrl,
				project.previewImageUrl,
				...(project.images ?? []).map((img) => img?.url ?? null),
				...(project.apps ?? []).flatMap((app) => (app.images ?? []).map((img) => img?.url ?? null)),
			].filter((value): value is string => Boolean(value)),
		),
	);
}