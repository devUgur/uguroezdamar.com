import { MongoClient } from "mongodb";
import { createHash } from "crypto";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// Load .env if present
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
const ADMIN_API_KEY = process.env.ADMIN_API_KEY ?? "";

if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set in environment or .env");
  process.exit(1);
}

function hashPassword(pwd) {
  return createHash("sha256").update(pwd + (ADMIN_API_KEY ?? "")).digest("hex");
}

function usage() {
  console.log("Usage: node scripts/set-admin-password.mjs --email admin@example.com --password newpass");
}

const args = process.argv.slice(2);
let email = null;
let password = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--email") email = args[++i];
  if (args[i] === "--password") password = args[++i];
}

if (!email || !password) {
  usage();
  process.exit(1);
}

async function run() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db();
  const col = db.collection("admins");
  const hashed = hashPassword(password);
  const res = await col.findOneAndUpdate({ email: email.toLowerCase() }, { $set: { passwordHash: hashed, status: "active" } }, { returnDocument: "after" });
  if (!res.value) {
    console.error("Admin not found for email:", email);
    await client.close();
    process.exit(1);
  }
  console.log("Updated admin password for", email);
  await client.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
