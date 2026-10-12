import { MongoClient } from "mongodb";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { hashAdminPassword } from "./password-hash.mjs";

// Load .env if present and variables not already set
const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const l = line.trim();
    if (!l || l.startsWith("#")) continue;
    const idx = l.indexOf("=");
    if (idx === -1) continue;
    const k = l.slice(0, idx).trim();
    let v = l.slice(idx + 1).trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1);
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set. Set it in your environment or .env file.");
  process.exit(1);
}

const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.INITIAL_ADMIN_PASSWORD;
if (!email || !password || password.length < 12) {
  console.error("Set INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD (at least 12 characters).");
  process.exit(1);
}

async function run() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db();
  const col = db.collection("admins");
  const existing = await col.findOne({ email });
  if (existing) {
    console.log("Admin already exists:", email);
    await client.close();
    return;
  }
  const pwdHash = await hashAdminPassword(password);
  const doc = {
    email,
    passwordHash: pwdHash,
    status: "active",
    role: "owner",
    createdAt: new Date(),
  };
  const res = await col.insertOne(doc);
  console.log("Seeded admin:", email, "id=", res.insertedId.toString());
  await client.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
