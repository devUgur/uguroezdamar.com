import { MongoClient } from "mongodb";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { hashAdminPassword } from "./password-hash.mjs";

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
if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set in environment or .env");
  process.exit(1);
}

function usage() {
  console.log("Usage: node tooling/scripts/set-admin-password.mjs --email admin@example.com --password <new-password>");
}

const args = process.argv.slice(2);
let email = null;
let password = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--email") email = args[++i];
  if (args[i] === "--password") password = args[++i];
}

if (!email || !password || password.length < 12) {
  usage();
  console.error("Password must contain at least 12 characters.");
  process.exit(1);
}

async function run() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db();
  const col = db.collection("admins");
  const hashed = await hashAdminPassword(password);
  const result = await col.findOneAndUpdate(
    { email: email.toLowerCase() },
    { $set: { passwordHash: hashed, status: "active" } },
    { returnDocument: "after" },
  );
  if (!result.value) {
    console.error("Admin not found for email:", email);
    await client.close();
    process.exit(1);
  }
  await db.collection("admin_sessions").deleteMany({ adminId: result.value._id.toString() });
  console.log("Updated admin password for", email);
  await client.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
