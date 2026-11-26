import type { NextConfig } from "next";

/** The office app (ADR 0039): Next.js on Cloudflare Workers via OpenNext. It reads no database; data comes from apps/api. */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Workspace packages ship TypeScript source; the app compiles them (ADR 0017).
  transpilePackages: ["@ugur/core", "@ugur/ui"],
};

export default nextConfig;
