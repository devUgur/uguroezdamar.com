import { getProfile } from "./mongo";

export type AboutProfileContent = {
  primaryText: string;
  secondaryText: string;
};

const ABOUT_PROFILE_FALLBACK: AboutProfileContent = {
  primaryText:
    "I am a Software Developer with a strong academic background in Computer Science and several years of hands-on experience in building real-world software solutions. My work is driven by a passion for clean, maintainable code and modern software architectures. I approach development in a structured, solution-oriented way and continuously expand my technical skill set.",
  secondaryText:
    "I am particularly interested in automation, artificial intelligence, and scalable systems that solve real problems. After studying Computer Science at TU Dortmund, I shifted my focus toward practical industry experience, working as a Full-Stack Developer and as a self-employed developer.",
};

export async function getProfileForAbout(handle = "main"): Promise<AboutProfileContent> {
  try {
    const profile = await getProfile(handle);
    if (!profile) return ABOUT_PROFILE_FALLBACK;

    const primaryText = profile.headline?.trim() || ABOUT_PROFILE_FALLBACK.primaryText;
    const secondaryFromProfile = [profile.subheadline, profile.bio].filter(Boolean).join(" ").trim();
    const secondaryText = secondaryFromProfile || ABOUT_PROFILE_FALLBACK.secondaryText;

    return {
      primaryText,
      secondaryText,
    };
  } catch {
    return ABOUT_PROFILE_FALLBACK;
  }
}
