export const env = {
  DATABASE_URL: process.env.DATABASE_URL ?? "",
  CONTACT_RATE_LIMIT_SECRET: process.env.CONTACT_RATE_LIMIT_SECRET ?? "",
  ADMIN_API_KEY: process.env.ADMIN_API_KEY ?? "",
  ADMIN_SESSION_TTL_SECONDS: Number(process.env.ADMIN_SESSION_TTL_SECONDS ?? "86400"),
  ADMIN_INVITE_EXPIRES_HOURS: Number(process.env.ADMIN_INVITE_EXPIRES_HOURS ?? "72"),
  // Invite links: the configured origin, else the preview deployment Vercel named, else local.
  APP_URL: process.env.APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3101"),
  NODE_ENV: process.env.NODE_ENV ?? "development",
};
