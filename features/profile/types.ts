export type ProfileLinks = {
  github?: string | null;
  linkedin?: string | null;
  website?: string | null;
};

export type Profile = {
  id: string;
  handle: string;
  headline: string;
  subheadline?: string | null;
  bio: string;
  location?: string | null;
  email?: string | null;
  links: ProfileLinks;
  updatedAt: string;
  createdAt: string;
};
