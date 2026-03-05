export type CoverImage = { url: string; alt?: string } | null;

export type Links = {
  live?: string | null;
  repo?: string | null;
  github?: string | null;
};

export type WorkItem = {
  id: string;
  slug: string;
  title: string;
  summary?: string | null;
  content?: string | null; // mdx source or HTML fallback
  tags?: string[];
  coverImage?: CoverImage;
  links?: Links | null;
  previewImageUrl?: string | null;
  previewUpdatedAt?: string | null;
  featured?: boolean;
  status?: "published" | "draft" | "archived";
  publishedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};
