import "server-only";

import { ensureProfileIndexes, getProfile, upsertProfile } from "./repo";

export { ensureProfileIndexes, getProfile, upsertProfile } from "./repo";
export { ProfileLinksSchema, UpsertProfileSchema } from "./validators";

export const profile = {
	getProfile,
	upsertProfile,
	ensureProfileIndexes,
};

export type { DbProfile, Profile, ProfileLinks } from "./repo";
export type { UpsertProfileInput } from "./validators";