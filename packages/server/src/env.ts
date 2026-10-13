export const env = {
  DATABASE_URL: process.env.DATABASE_URL ?? "",
  CONTACT_RATE_LIMIT_SECRET: process.env.CONTACT_RATE_LIMIT_SECRET ?? "",
  ADMIN_API_KEY: process.env.ADMIN_API_KEY ?? "",
  ADMIN_SESSION_TTL_SECONDS: Number(process.env.ADMIN_SESSION_TTL_SECONDS ?? "86400"),
  ADMIN_INVITE_EXPIRES_HOURS: Number(process.env.ADMIN_INVITE_EXPIRES_HOURS ?? "72"),
  APP_URL: process.env.APP_URL ?? "http://localhost:3001",
  NODE_ENV: process.env.NODE_ENV ?? "development",
};
