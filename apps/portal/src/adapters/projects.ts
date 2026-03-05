import "server-only";

import { getProjects, getProjectById, getProjectBySlugMongo } from "@ugur/server";

export async function getProjectsSnapshot() {
	return getProjects({ limit: 500 });
}

export async function getProjectByIdAdapter(id: string) {
	return getProjectById(id);
}

export async function getProjectBySlugAdapter(slug: string) {
	return getProjectBySlugMongo(slug);
}
