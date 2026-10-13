import { ProfileSchema, type ProfileInput } from "@/src/content/profile";

/**
 * Profile, experience and education shown on the site. Only confirmed facts go here; a section
 * without content is left out of the home page instead of showing a placeholder.
 *
 * Example entry:
 *   { title: "Software Developer", organization: "Company", location: "City", period: { from: 2022, ongoing: true } }
 */
const profile: ProfileInput = {
  headline: "",
  bio: "",
  experience: [],
  education: [],
};

export default ProfileSchema.parse(profile);
