import "server-only";

import { projects } from "@ugur/server";

export async function getProjectsSnapshot() {
	return projects.getProjects({ includeDrafts: true, limit: 500 });
}

export async function getProjectById(id: string) {
	return projects.getProjectBySlugMongo(id, { includeDrafts: true });
}
