import { MongoClient } from "mongodb";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// Load .env manually if present
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
  console.error("MONGODB_URI is not set in .env or environment. Aborting.");
  process.exit(1);
}

const args = process.argv.slice(2);
let ip = null;
let all = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--ip") ip = args[++i];
  if (args[i] === "--all") all = true;
}

async function run() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db();
  const col = db.collection("admin_login_attempts");
  if (all) {
    const res = await col.deleteMany({});
    console.log(`Deleted ${res.deletedCount} login attempt(s)`);
  } else if (ip) {
    const res = await col.deleteMany({ ip });
    console.log(`Deleted ${res.deletedCount} login attempt(s) for ip=${ip}`);
  } else {
    // default: delete attempts older than 15 minutes
    const since = new Date(Date.now() - 15 * 60 * 1000);
    const res = await col.deleteMany({ createdAt: { $lt: since } });
    console.log(`Deleted ${res.deletedCount} login attempt(s) older than 15 minutes`);
  }
  await client.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
