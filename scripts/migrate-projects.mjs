#!/usr/bin/env node
import { MongoClient } from "mongodb";
import { readFileSync, existsSync } from "fs";
import { readdir, readFile } from "fs/promises";
import { resolve, join } from "path";
import matter from "gray-matter";

function loadEnvFile(fileName) {
  const envPath = resolve(process.cwd(), fileName);
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const l = line.trim();
    if (!l || l.startsWith("#")) continue;
    const idx = l.indexOf("=");
    if (idx === -1) continue;
    const key = l.slice(0, idx).trim();
    let value = l.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set in environment/.env/.env.local");
  process.exit(1);
}

const includeSamples = process.argv.includes("--include-samples");
const contentDir = join(process.cwd(), "content", "projects");

function isSampleProject(slug, title, summary) {
  const s = String(slug ?? "").toLowerCase();
  const t = String(title ?? "").toLowerCase();
  const d = String(summary ?? "").toLowerCase();
  return s === "my-project" || t === "my project" || t.includes("sample project") || d.includes("sample project");
}

async function run() {
  const files = (await readdir(contentDir).catch(() => [])).filter((f) => f.endsWith(".mdx"));
  if (!files.length) {
    console.log("No MDX project files found in content/projects");
    return;
  }

  const client = new MongoClient(MONGODB_URI);
  await client.connect();

  try {
    const db = client.db();
    const col = db.collection("projects");

    let imported = 0;
    let skippedSamples = 0;

    for (const file of files) {
      const slug = file.replace(/\.mdx$/, "");
      const raw = await readFile(join(contentDir, file), "utf8");
      const parsed = matter(raw);

      const title = String(parsed.data.title ?? slug);
      const summary = String(parsed.data.summary ?? "");

      if (!includeSamples && isSampleProject(slug, title, summary)) {
        skippedSamples += 1;
        continue;
      }

      const tags = Array.isArray(parsed.data.tags) ? parsed.data.tags.map(String) : [];
      const tech = Array.isArray(parsed.data.tech) ? parsed.data.tech.map(String) : [];

      const links = Array.isArray(parsed.data.links)
        ? parsed.data.links
            .map((item) => ({
              platform: String(item?.platform ?? item?.label ?? "link"),
              label: item?.label ? String(item.label) : null,
              url: item?.url ? String(item.url) : "",
            }))
            .filter((item) => !!item.url)
        : [];

      const images = Array.isArray(parsed.data.images)
        ? parsed.data.images
            .map((img) => ({
              url: String(img?.url ?? ""),
              alt: img?.alt ? String(img.alt) : null,
              kind: img?.kind ? String(img.kind) : null,
            }))
            .filter((img) => !!img.url)
        : [];

      const now = new Date();
      await col.updateOne(
        { slug },
        {
          $set: {
            slug,
            title,
            summary,
            content: parsed.content ?? "",
            tags,
            tech,
            links,
            images,
            coverImageUrl: parsed.data.coverImageUrl ? String(parsed.data.coverImageUrl) : null,
            previewImageUrl: parsed.data.previewImageUrl ? String(parsed.data.previewImageUrl) : null,
            status: "published",
            featured: Boolean(parsed.data.featured ?? false),
            sortIndex: Number(parsed.data.sortIndex ?? 0),
            publishedAt: parsed.data.publishedAt ? new Date(String(parsed.data.publishedAt)) : null,
            updatedAt: now,
            deletedAt: null,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        { upsert: true },
      );
      imported += 1;
    }

    console.log(`Migration done. Imported/updated: ${imported}. Skipped samples: ${skippedSamples}.`);
    if (imported === 0) {
      console.log("No real project data imported (likely only sample files exist). Create projects in Admin UI.");
    }
  } finally {
    await client.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
