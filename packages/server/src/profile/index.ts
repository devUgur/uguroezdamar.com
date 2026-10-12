import "server-only";

import { getProfile, upsertProfile } from "./repo";

export { getProfile, upsertProfile } from "./repo";
export { ProfileLinksSchema, UpsertProfileSchema } from "./validators";

export const profile = {
	getProfile,
	upsertProfile,
};

export type { DbProfile, Profile, ProfileLinks } from "./repo";
export type { UpsertProfileInput } from "./validators";