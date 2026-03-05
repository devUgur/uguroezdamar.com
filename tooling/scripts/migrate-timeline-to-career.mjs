#!/usr/bin/env node
import { MongoClient } from "mongodb";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

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

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-");
}

function toIsoDate(input) {
  if (!input) return null;
  if (input instanceof Date) return input.toISOString();
  try {
    return new Date(input).toISOString();
  } catch {
    return null;
  }
}

async function run() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();

  try {
    const db = client.db();
    
    // 1. MIGRATION: Timeline -> Career
    console.log("--- Migrating Career Entries ---");
    const oldTimelineCol = db.collection("timelineItems");
    const careerCol = db.collection("careerEntries");
    const timelineItems = await oldTimelineCol.find({}).toArray();
    console.log(`Found ${timelineItems.length} timeline items.`);

    for (const item of timelineItems) {
      const type = item.type === "experience" ? "work" : item.type;
      const slug = item.slug || `${slugify(item.title)}-${item._id.toString().slice(-4)}`;
      
      const careerEntry = {
        type,
        slug,
        title: item.title,
        organization: item.organization || null,
        location: item.location || null,
        date: {
          start: toIsoDate(item.startDate),
          end: toIsoDate(item.endDate),
          isCurrent: !!item.isCurrent,
        },
        summary: item.description || null,
        highlights: item.highlights || [],
        tags: [],
        links: [],
        isFeatured: false,
        sortKey: item.sortIndex || 0,
        visibility: {
          about: !!item.visibility?.about,
          education: !!item.visibility?.education,
          career: true,
        },
        status: item.status || "published",
        role: type === "work" ? item.title : null,
        degree: type === "education" ? item.title : null,
        field: null,
        issuer: null,
        createdAt: item.createdAt ? toIsoDate(item.createdAt) : new Date().toISOString(),
        updatedAt: item.updatedAt ? toIsoDate(item.updatedAt) : new Date().toISOString(),
      };

      await careerCol.updateOne({ slug: careerEntry.slug }, { $set: careerEntry }, { upsert: true });
    }
    console.log("Career migration done.");

    // 2. MIGRATION: Work/Case Studies -> Projects
    console.log("\n--- Migrating Portfolio Projects ---");
    const projectCol = db.collection("projects");
    
    // Helper to migrate items from any collection to "projects"
    const migrateToProjects = async (sourceCollectionName) => {
      const sourceCol = db.collection(sourceCollectionName);
      const items = await sourceCol.find({}).toArray();
      console.log(`Found ${items.length} items in ${sourceCollectionName}.`);

      for (const item of items) {
        // Map old structure to unified Project schema
        const project = {
          slug: item.slug,
          title: item.title,
          summary: item.summary || item.description || "",
          content: item.content || null,
          tags: item.tags || [],
          tech: item.tech || [],
          status: item.status || "published",
          featured: !!item.featured,
          isSecret: !!item.isSecret,
          sortIndex: item.sortIndex || 0,
          publishedAt: toIsoDate(item.publishedAt),
          previewImageUrl: item.previewImageUrl || item.coverImageUrl || null,
          previewUpdatedAt: toIsoDate(item.previewUpdatedAt),
          coverImageUrl: item.coverImageUrl || null,
          // Handle links array vs structured links
          links: Array.isArray(item.links) ? item.links : [
            item.links?.live && { platform: "live", url: item.links.live },
            item.links?.repo && { platform: "repo", url: item.links.repo },
            item.links?.github && { platform: "github", url: item.links.github },
          ].filter(Boolean),
          kinds: item.kinds || (item.type ? [item.type] : ["web"]),
          images: item.images || [],
          createdAt: item.createdAt ? toIsoDate(item.createdAt) : new Date().toISOString(),
          updatedAt: item.updatedAt ? toIsoDate(item.updatedAt) : new Date().toISOString(),
        };

        await projectCol.updateOne({ slug: project.slug }, { $set: project }, { upsert: true });
      }
    };

    await migrateToProjects("work_items");
    await migrateToProjects("case_studies");
    
    // Also handle existing projects in the "projects" collection (normalize them)
    const existingProjects = await projectCol.find({}).toArray();
    for (const p of existingProjects) {
       if (!p.createdAt) {
          await projectCol.updateOne({ _id: p._id }, { $set: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } });
       }
    }

    console.log("Portfolio migration done.");
    console.log("\nMigration completed successfully.");

  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await client.close();
  }
}

run();
