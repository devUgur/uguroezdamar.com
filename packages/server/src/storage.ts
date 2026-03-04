import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  type ListObjectsV2CommandOutput,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { env } from "./env";

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

function decodeKeyFromUrlPath(path: string) {
  return path
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment))
    .join("/");
}

function extractKeyFromPublicUrl(url: string): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);

    if (env.R2_PUBLIC_BASE_URL) {
      const base = new URL(env.R2_PUBLIC_BASE_URL);
      if (parsed.origin === base.origin && parsed.pathname.startsWith(base.pathname.replace(/\/$/, "") + "/")) {
        const relativePath = parsed.pathname.slice(base.pathname.replace(/\/$/, "").length + 1);
        return decodeKeyFromUrlPath(relativePath);
      }
    }

    if (env.R2_ACCOUNT_ID) {
      const fallbackHost = `${env.R2_BUCKET}.${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
      if (parsed.hostname === fallbackHost) {
        return decodeKeyFromUrlPath(parsed.pathname);
      }
    }
  } catch {
    return null;
  }

  return null;
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

export async function deleteObjectByKey(key: string): Promise<boolean> {
  if (env.PREVIEW_USE_STORAGE !== "r2") return false;
  const client = getS3Client();
  if (!client || !key) return false;

  await client.send(
    new DeleteObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
    }),
  );

  return true;
}

export async function deleteObjectByUrl(url: string): Promise<boolean> {
  const key = extractKeyFromPublicUrl(url);
  if (!key) return false;
  return deleteObjectByKey(key);
}

export async function deleteObjectsByUrls(urls: string[]): Promise<{ deleted: number; skipped: number }> {
  if (env.PREVIEW_USE_STORAGE !== "r2") return { deleted: 0, skipped: urls.length };
  const client = getS3Client();
  if (!client) return { deleted: 0, skipped: urls.length };

  const keys = urls
    .map((url) => extractKeyFromPublicUrl(url))
    .filter((key): key is string => Boolean(key));

  if (!keys.length) return { deleted: 0, skipped: urls.length };

  const chunks: string[][] = [];
  for (let index = 0; index < keys.length; index += 1000) {
    chunks.push(keys.slice(index, index + 1000));
  }

  let deleted = 0;
  for (const chunk of chunks) {
    const res = await client.send(
      new DeleteObjectsCommand({
        Bucket: env.R2_BUCKET,
        Delete: { Objects: chunk.map((key) => ({ Key: key })), Quiet: true },
      }),
    );
    deleted += res.Deleted?.length ?? 0;
  }

  return { deleted, skipped: Math.max(urls.length - keys.length, 0) };
}

export async function deleteObjectsByPrefix(prefix: string): Promise<number> {
  if (env.PREVIEW_USE_STORAGE !== "r2") return 0;
  const client = getS3Client();
  if (!client || !prefix) return 0;

  let continuationToken: string | undefined = undefined;
  let deleted = 0;

  do {
    const listed: ListObjectsV2CommandOutput = await client.send(
      new ListObjectsV2Command({
        Bucket: env.R2_BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    const keys = (listed.Contents ?? [])
      .map((item: { Key?: string }) => item.Key)
      .filter((key: string | undefined): key is string => Boolean(key));
    if (keys.length) {
      const res = await client.send(
        new DeleteObjectsCommand({
          Bucket: env.R2_BUCKET,
          Delete: { Objects: keys.map((key: string) => ({ Key: key })), Quiet: true },
        }),
      );
      deleted += res.Deleted?.length ?? 0;
    }

    continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (continuationToken);

  return deleted;
}

export default {
  uploadBuffer,
  getPublicUrl,
  deleteObjectByKey,
  deleteObjectByUrl,
  deleteObjectsByUrls,
  deleteObjectsByPrefix,
};
