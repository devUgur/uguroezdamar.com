import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb, isUuid } from "../db/client";
import { careerEntries } from "../db/schema";
import type { CareerEntryInput, CareerEntry, UpdateCareerEntryInput } from "./validators";

type CareerRow = typeof careerEntries.$inferSelect;
type CareerInsert = typeof careerEntries.$inferInsert;

function toCareerEntry(row: CareerRow): CareerEntry {
  const { dateStart, dateEnd, isCurrent, visibility, ...rest } = row;
  return {
    ...rest,
    date: { start: dateStart.toISOString(), end: dateEnd?.toISOString() ?? null, isCurrent },
    visibility: visibility ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  } as CareerEntry;
}

/** Maps the nested API `date` object onto its columns; absent fields stay untouched. */
function toColumns(data: UpdateCareerEntryInput): Partial<CareerInsert> {
  const { date, ...fields } = data;
  return {
    ...fields,
    ...(date
      ? {
          dateStart: new Date(date.start),
          dateEnd: date.end ? new Date(date.end) : null,
          isCurrent: date.isCurrent ?? false,
        }
      : {}),
  };
}

export async function createCareerEntry(data: CareerEntryInput): Promise<CareerEntry> {
  const [row] = await getDb()
    .insert(careerEntries)
    .values(toColumns(data) as CareerInsert)
    .returning();
  return toCareerEntry(row);
}

export async function getCareerEntries(
  filter: { type?: string; status?: string; visibility?: string } = {},
): Promise<CareerEntry[]> {
  const rows = await getDb()
    .select()
    .from(careerEntries)
    .where(
      and(
        filter.type ? eq(careerEntries.type, filter.type) : undefined,
        filter.status ? eq(careerEntries.status, filter.status as CareerRow["status"]) : undefined,
        filter.visibility ? sql`${careerEntries.visibility} ->> ${filter.visibility} = 'true'` : undefined,
      ),
    )
    .orderBy(desc(careerEntries.dateStart), asc(careerEntries.sortKey));
  return rows.map(toCareerEntry);
}

export async function getCareerEntryById(id: string): Promise<CareerEntry | null> {
  if (!isUuid(id)) return null;
  const [row] = await getDb().select().from(careerEntries).where(eq(careerEntries.id, id)).limit(1);
  return row ? toCareerEntry(row) : null;
}

export async function getCareerEntryBySlug(slug: string): Promise<CareerEntry | null> {
  const [row] = await getDb().select().from(careerEntries).where(eq(careerEntries.slug, slug)).limit(1);
  return row ? toCareerEntry(row) : null;
}

export async function updateCareerEntry(id: string, data: UpdateCareerEntryInput): Promise<boolean> {
  if (!isUuid(id)) return false;
  const rows = await getDb()
    .update(careerEntries)
    .set({ ...toColumns(data), updatedAt: new Date() })
    .where(eq(careerEntries.id, id))
    .returning({ id: careerEntries.id });
  return rows.length > 0;
}

export async function deleteCareerEntry(id: string): Promise<boolean> {
  if (!isUuid(id)) return false;
  const rows = await getDb().delete(careerEntries).where(eq(careerEntries.id, id)).returning({ id: careerEntries.id });
  return rows.length > 0;
}
