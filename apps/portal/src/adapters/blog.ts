import "server-only";

import { getAllPosts } from "@ugur/server";

export async function getBlogPosts() {
	return getAllPosts();
}
