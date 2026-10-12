import "server-only";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb, isUuid, omit } from "../db/client";
import { projects } from "../db/schema";
import type { CreateProjectInput, ProjectRecord, UpdateProjectInput } from "./validators";

type ProjectRow = typeof projects.$inferSelect;

const iso = (value: Date | null) => value?.toISOString() ?? null;
const date = (value: string | null | undefined) => (value ? new Date(value) : null);

function toProjectRecord(row: ProjectRow): ProjectRecord {
	return {
		...omit(row, "deletedAt"),
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
		publishedAt: iso(row.publishedAt),
		previewUpdatedAt: iso(row.previewUpdatedAt),
	} as ProjectRecord;
}

const notDeleted = isNull(projects.deletedAt);
const isPublic = and(eq(projects.status, "published"), eq(projects.isSecret, false));

export async function getProjects(options?: {
	status?: string;
	featured?: boolean;
	publicOnly?: boolean;
	limit?: number;
}): Promise<ProjectRecord[]> {
	const rows = await getDb()
		.select()
		.from(projects)
		.where(
			and(
				notDeleted,
				options?.publicOnly ? isPublic : options?.status ? eq(projects.status, options.status as ProjectRow["status"]) : undefined,
				options?.featured === undefined ? undefined : eq(projects.featured, options.featured),
			),
		)
		.orderBy(desc(projects.featured), asc(projects.sortIndex), sql`${projects.publishedAt} desc nulls last`)
		.limit(options?.limit ?? 100);

	return rows.map(toProjectRecord);
}

export async function getProjectBySlug(slug: string, options?: { publicOnly?: boolean }): Promise<ProjectRecord | null> {
	const [row] = await getDb()
		.select()
		.from(projects)
		.where(and(eq(projects.slug, slug), notDeleted, options?.publicOnly ? isPublic : undefined))
		.limit(1);
	return row ? toProjectRecord(row) : null;
}

export async function getProjectById(id: string): Promise<ProjectRecord | null> {
	if (!isUuid(id)) return null;
	const [row] = await getDb().select().from(projects).where(and(eq(projects.id, id), notDeleted)).limit(1);
	return row ? toProjectRecord(row) : null;
}

export async function createProject(input: CreateProjectInput): Promise<ProjectRecord> {
	const now = new Date();
	const [row] = await getDb()
		.insert(projects)
		.values({
			...input,
			createdAt: now,
			updatedAt: now,
			publishedAt: input.status === "published" ? (date(input.publishedAt) ?? now) : null,
			previewUpdatedAt: date(input.previewUpdatedAt),
		})
		.returning();
	return toProjectRecord(row);
}

export async function updateProject(id: string, input: UpdateProjectInput): Promise<boolean> {
	if (!isUuid(id)) return false;
	const { publishedAt, previewUpdatedAt, ...fields } = input;
	const update: Partial<typeof projects.$inferInsert> = { ...fields, updatedAt: new Date() };

	if (input.status === "published" && !publishedAt) {
		update.publishedAt = new Date();
	} else if (publishedAt) {
		update.publishedAt = new Date(publishedAt);
	}
	if (previewUpdatedAt) {
		update.previewUpdatedAt = new Date(previewUpdatedAt);
	}

	const rows = await getDb().update(projects).set(update).where(eq(projects.id, id)).returning({ id: projects.id });
	return rows.length > 0;
}

/** Set sortIndex for each project by position in orderedIds, atomically. */
export async function reorderProjects(orderedIds: string[]): Promise<void> {
	const ids = orderedIds.filter(isUuid);
	if (ids.length === 0) return;

	const now = new Date();
	await getDb().transaction(async (tx) => {
		for (const [index, id] of ids.entries()) {
			await tx
				.update(projects)
				.set({ sortIndex: index, updatedAt: now })
				.where(and(eq(projects.id, id), notDeleted));
		}
	});
}

export async function softDeleteProject(id: string): Promise<boolean> {
	if (!isUuid(id)) return false;
	const now = new Date();
	const rows = await getDb()
		.update(projects)
		.set({ deletedAt: now, updatedAt: now })
		.where(eq(projects.id, id))
		.returning({ id: projects.id });
	return rows.length > 0;
}
