export const env = {
  REVALIDATE_SECRET: process.env.REVALIDATE_SECRET ?? "",
  MONGODB_URI: process.env.MONGODB_URI ?? "",
  ADMIN_API_KEY: process.env.ADMIN_API_KEY ?? "",
  // Admin session TTL in seconds (default: 1 day)
  ADMIN_SESSION_TTL_SECONDS: Number(process.env.ADMIN_SESSION_TTL_SECONDS ?? "86400"),
  // Invite expiry in hours (default: 72 hours)
  ADMIN_INVITE_EXPIRES_HOURS: Number(process.env.ADMIN_INVITE_EXPIRES_HOURS ?? "72"),
  // Public app url used in email invite links
  APP_URL: process.env.APP_URL ?? "http://localhost:3000",
  // Node environment
  NODE_ENV: process.env.NODE_ENV ?? "development",
  // Screenshot provider
  SCREENSHOT_PROVIDER_URL: process.env.SCREENSHOT_PROVIDER_URL ?? "",
  SCREENSHOT_API_KEY: process.env.SCREENSHOT_API_KEY ?? "",
  // Storage backend flag: none|r2
  PREVIEW_USE_STORAGE: process.env.PREVIEW_USE_STORAGE ?? "none",
  // Cloudflare R2 (S3-compatible) settings
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID ?? "",
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID ?? "",
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY ?? "",
  R2_BUCKET: process.env.R2_BUCKET ?? "",
  // Optional explicit endpoint; falls back to account-based endpoint when omitted
  R2_ENDPOINT: process.env.R2_ENDPOINT ?? "",
  // R2 should typically use region "auto"
  R2_REGION: process.env.R2_REGION ?? "auto",
  // Use path style URLs for highest compatibility with S3-compatible APIs
  R2_FORCE_PATH_STYLE: process.env.R2_FORCE_PATH_STYLE ?? "true",
  // Optional: public base URL for R2 assets (custom domain recommended)
  R2_PUBLIC_BASE_URL: process.env.R2_PUBLIC_BASE_URL ?? process.env.R2_PUBLIC_BASE ?? "",
};
