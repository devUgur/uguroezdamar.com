import "server-only";

import { getAdminSession } from "@ugur/server/admin";
import { readCookie } from "./utils";

export async function getCurrentSession() {
	const cookieStore = await readCookie("admin_session");
	return cookieStore ? getAdminSession(cookieStore) : null;
}