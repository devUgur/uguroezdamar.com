export type ProjectStatus = "draft" | "published" | "archived";

export type ProjectKind = "web" | "mobile" | "desktop" | "cli";

export type ProjectLink = {
  platform: string; // e.g., 'web', 'ios', 'android', 'github'
  label?: string | null;
  url: string;
  kind?: ProjectKind | null;
};

export type ProjectImage = {
  url: string;
  alt?: string | null;
  kind?: ProjectKind | "cover" | "gallery" | null;
};

export type ProjectRecord = {
  id?: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  tags: string[];
  tech: string[];
  links: ProjectLink[];
  kinds: ProjectKind[];
  images: ProjectImage[];
  coverImageUrl?: string | null;
  previewImageUrl?: string | null;
  status: ProjectStatus;
  featured: boolean;
  isSecret?: boolean;
  sortIndex: number;
  publishedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};
