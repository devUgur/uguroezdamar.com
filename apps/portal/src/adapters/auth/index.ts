import "server-only";

import { deleteAdminSession, getAdminById, getAdminSession } from "@ugur/server";
import { readCookie } from "./utils";

export async function getCurrentSession() {
	const cookieStore = await readCookie("admin_session");
	if (!cookieStore) return null;
	const session = await getAdminSession(cookieStore);
	if (!session) return null;
	const admin = await getAdminById(session.adminId);
	if (!admin || admin.status !== "active" || admin.email !== session.email) {
		await deleteAdminSession(cookieStore);
		return null;
	}
	return session;
}
