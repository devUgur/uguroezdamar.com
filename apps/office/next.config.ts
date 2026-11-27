import type { NextConfig } from "next";

/** The office app (ADR 0039): Next.js on Cloudflare Workers via OpenNext. It reads no database; data comes from apps/api. */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Workspace packages ship TypeScript source; the app compiles them (ADR 0017).
  transpilePackages: ["@ugur/core", "@ugur/ui"],
  experimental: {
    // Visited office pages stay in the client cache for 30 s: going back and forth between room and chats does not
    // wait for the Worker again. Live data refreshes on its own (WebSocket, board refresh).
    staleTimes: { dynamic: 30 },
  },
};

export default nextConfig;
