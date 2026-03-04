import "server-only";

import { readCookie } from "@ugur/server";
import { getAdminSession } from "@/features/admin";

export async function getCurrentAdminSession() {
	const cookieStore = await readCookie("admin_session");
	return cookieStore ? getAdminSession(cookieStore) : null;
}