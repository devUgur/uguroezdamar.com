import "server-only";

import { profile } from "@ugur/server";

export async function getAdminProfileSnapshot(handle = "main") {
	return profile.getProfile(handle);
}