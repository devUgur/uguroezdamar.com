export type ProjectStatus = "draft" | "published" | "archived";

export type ProjectLink = {
  platform: string;
  label?: string | null;
  url: string;
};

export type ProjectImage = {
  url: string;
  alt?: string | null;
  kind?: string | null;
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
  images: ProjectImage[];
  coverImageUrl?: string | null;
  previewImageUrl?: string | null;
  status: ProjectStatus;
  featured: boolean;
  sortIndex: number;
  publishedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};
