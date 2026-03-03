import { env } from "@/shared/lib/env";

// NOTE: This file uses the AWS S3-compatible client to upload to Cloudflare R2.
// Install the dependency with: pnpm add @aws-sdk/client-s3
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

let s3: S3Client | null = null;
function getS3Client() {
  if (s3) return s3;
  if (!env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_BUCKET) {
    return null;
  }

  const endpoint = env.R2_ENDPOINT || (env.R2_ACCOUNT_ID ? `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : "");
  if (!endpoint) return null;

  s3 = new S3Client({
    region: env.R2_REGION || "auto",
    endpoint,
    forcePathStyle: env.R2_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
  return s3;
}

function encodeKeyForUrl(key: string) {
  return key
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export async function uploadBuffer(
  buffer: Buffer,
  key: string,
  contentType = "application/octet-stream",
  options?: { cacheControl?: string },
): Promise<string> {
  if (env.PREVIEW_USE_STORAGE !== "r2") {
    throw new Error("R2 storage not enabled (PREVIEW_USE_STORAGE !== 'r2')");
  }
  const client = getS3Client();
  if (!client) throw new Error("R2 client not configured. Set R2_ENDPOINT (or R2_ACCOUNT_ID), R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET");

  const cmd = new PutObjectCommand({
    Bucket: env.R2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: options?.cacheControl,
  });

  await client.send(cmd);

  const encodedKey = encodeKeyForUrl(key);
  if (env.R2_PUBLIC_BASE_URL) return `${env.R2_PUBLIC_BASE_URL.replace(/\/$/, "")}/${encodedKey}`;
  if (!env.R2_ACCOUNT_ID) {
    throw new Error("R2 public URL cannot be built without R2_PUBLIC_BASE_URL or R2_ACCOUNT_ID");
  }
  return `https://${env.R2_BUCKET}.${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${encodedKey}`;
}

export function getPublicUrl(key: string) {
  const encodedKey = encodeKeyForUrl(key);
  if (env.R2_PUBLIC_BASE_URL) return `${env.R2_PUBLIC_BASE_URL.replace(/\/$/, "")}/${encodedKey}`;
  return `https://${env.R2_BUCKET}.${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${encodedKey}`;
}

export default { uploadBuffer, getPublicUrl };
