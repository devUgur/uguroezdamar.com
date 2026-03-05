import "server-only";

import { getCareerEntries, getCareerEntryById, type CareerEntry } from "@ugur/server";

export type { CareerEntry };

export async function getCareerEntriesSnapshot() {
	return getCareerEntries();
}

export async function getCareerEntryByIdAdapter(id: string) {
	return getCareerEntryById(id);
}
