import "server-only";

import { profile } from "@ugur/server";

export async function getProfileSnapshot(handle = "main") {
	return profile.getProfile(handle);
}