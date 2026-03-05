import "server-only";

import { readCookie } from "@ugur/server";
import { getAdminSession } from "@ugur/server";

export async function getCurrentSession() {
	const cookieStore = await readCookie("admin_session");
	return cookieStore ? getAdminSession(cookieStore) : null;
}