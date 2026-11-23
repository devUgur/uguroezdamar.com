import { ProfileSchema, type ProfileInput } from "@/src/content/profile";

/**
 * Explicitly translated profile facts for German pages. Keep empty until the corresponding
 * English facts have been reviewed and a German version is ready; never fall back silently.
 */
const profile: ProfileInput = {
  headline: "",
  bio: "",
  experience: [],
  education: [],
};

export default ProfileSchema.parse(profile);
