import "server-only";

import { projects } from "@ugur/server";

export async function getAdminProjectsSnapshot() {
	return projects.getProjects({ includeDrafts: true, limit: 500 });
}

export async function getAdminProjectSnapshotById(id: string) {
	return projects.getProjectBySlugMongo(id, { includeDrafts: true });
}
