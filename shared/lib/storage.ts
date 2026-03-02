import { env } from "@/shared/lib/env";

// NOTE: This file uses the AWS S3-compatible client to upload to Cloudflare R2.
// Install the dependency with: pnpm add @aws-sdk/client-s3
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

let s3: S3Client | null = null;
function getS3Client() {
  if (s3) return s3;
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_BUCKET) {
    return null;
  }
  s3 = new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
  return s3;
}

export async function uploadBuffer(buffer: Buffer, key: string, contentType = "application/octet-stream"): Promise<string> {
  if (env.PREVIEW_USE_STORAGE !== "r2") {
    throw new Error("R2 storage not enabled (PREVIEW_USE_STORAGE !== 'r2')");
  }
  const client = getS3Client();
  if (!client) throw new Error("R2 client not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET");

  const cmd = new PutObjectCommand({
    Bucket: env.R2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ACL: "public-read",
  } as any);

  await client.send(cmd);

  if (env.R2_PUBLIC_BASE) return `${env.R2_PUBLIC_BASE.replace(/\/$/, "")}/${encodeURIComponent(key)}`;
  // Default public URL pattern (works if bucket is accessible at bucket.account.r2.cloudflarestorage.com)
  return `https://${env.R2_BUCKET}.${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${encodeURIComponent(key)}`;
}

export function getPublicUrl(key: string) {
  if (env.R2_PUBLIC_BASE) return `${env.R2_PUBLIC_BASE.replace(/\/$/, "")}/${encodeURIComponent(key)}`;
  return `https://${env.R2_BUCKET}.${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${encodeURIComponent(key)}`;
}

export default { uploadBuffer, getPublicUrl };
