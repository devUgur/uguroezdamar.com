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
    const col = db.collection("leads");

    console.log("Creating index: createdAt -1");
    await col.createIndex({ createdAt: -1 });

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
    
    // Ensure work_items indexes
    const workCol = db.collection("work_items");
    console.log("Creating work_items indexes (slug unique, status, featured/sort/publishedAt)");
    await workCol.createIndex({ slug: 1 }, { unique: true });
    await workCol.createIndex({ status: 1 });
    await workCol.createIndex({ featured: -1, sortIndex: 1, publishedAt: -1 });
    // admin_invites indexes
    const invitesCol = db.collection("admin_invites");
    console.log("Creating admin_invites indexes (tokenHash unique, expiresAt TTL)");
    await invitesCol.createIndex({ tokenHash: 1 }, { unique: true });
    await invitesCol.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    
    const retention = process.env.LEADS_RETENTION_DAYS;
    if (retention) {
      const days = Number(retention);
      if (!Number.isNaN(days) && days > 0) {
        console.log(`Creating TTL index (expireAfterSeconds=${days * 24 * 60 * 60})`);
        await col.createIndex({ createdAt: 1 }, { expireAfterSeconds: days * 24 * 60 * 60 });
      }
    }

    console.log("Indexes created");
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
