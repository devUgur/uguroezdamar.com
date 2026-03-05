#!/usr/bin/env node
import { readFileSync } from "fs";
import { resolve } from "path";
import { MongoClient } from "mongodb";

// If env var not set, try to load from .env in project root
if (!process.env.MONGODB_URI) {
  try {
    const envPath = resolve(process.cwd(), ".env");
    const raw = readFileSync(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let [, k, v] = m;
      // strip surrounding quotes
      if ((v.startsWith("\"") && v.endsWith("\"")) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {
    // ignore - we'll check below and exit with helpful message
  }
}

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set");
  process.exit(1);
}

async function main() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();

    // Ensure contact_requests index on createdAt -1
    const contactCol = db.collection("contact_requests");
    console.log("Creating contact_requests index: createdAt -1");
    await contactCol.createIndex({ createdAt: -1 });

    // Ensure admin_sessions TTL index on `expiresAt`
    const sessionsCol = db.collection("admin_sessions");
    console.log("Creating admin_sessions TTL index on expiresAt");
    await sessionsCol.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

    // Ensure admin_login_attempts TTL index on createdAt (window)
    const loginWindow = Number(process.env.ADMIN_LOGIN_RATE_LIMIT_WINDOW_SECONDS ?? "900");
    if (loginWindow > 0) {
      const attemptsCol = db.collection("admin_login_attempts");
      console.log(`Creating admin_login_attempts TTL index on createdAt (expires after ${loginWindow}s)`);
      await attemptsCol.createIndex({ createdAt: 1 }, { expireAfterSeconds: loginWindow });
    }

    // Ensure admins unique index on email
    const adminsCol = db.collection("admins");
    console.log("Creating unique index on admins email");
    await adminsCol.createIndex({ email: 1 }, { unique: true });
    
    // Ensure projects indexes
    const projectsCol = db.collection("projects");
    console.log("Creating projects indexes (slug unique, status, featured/publishedAt)");
    await projectsCol.createIndex({ slug: 1 }, { unique: true });
    await projectsCol.createIndex({ status: 1 });
    await projectsCol.createIndex({ featured: -1, publishedAt: -1 });

    // Ensure careerEntries indexes
    const careerCol = db.collection("careerEntries");
    console.log("Creating careerEntries indexes (slug unique, status/type, visibility, dates)");
    await careerCol.createIndex({ slug: 1 }, { unique: true });
    await careerCol.createIndex({ status: 1, type: 1 });
    await careerCol.createIndex({ "visibility.about": 1, status: 1 });
    await careerCol.createIndex({ "visibility.education": 1, status: 1 });
    await careerCol.createIndex({ "date.start": -1, "date.end": -1, sortKey: 1 });

    // Ensure admin_invites indexes
    const invitesCol = db.collection("admin_invites");
    console.log("Creating admin_invites indexes (tokenHash unique, expiresAt TTL)");
    await invitesCol.createIndex({ tokenHash: 1 }, { unique: true });
    await invitesCol.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    
    console.log("Indexes created");
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
