export interface PortfolioRepository {
  id: string;
  name: string;
  repo: string | null;
  visibility: "public" | "private";
  defaultBranch: string;
  writeMode: "dev-first" | "pr-only";
}

export interface PortfolioProject {
  id: string;
  name: string;
  summary: string | null;
  status: "active" | "paused" | "archived";
  priority: "P0" | "P1" | "P2" | "P3";
  version: number;
  createdAt: number;
  updatedAt: number;
  repositories: PortfolioRepository[];
}

export interface RepositoryProject {
  id: string;
  name: string;
  repo: string | null;
  status: string;
}
