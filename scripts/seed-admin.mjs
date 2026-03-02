import { getDb } from "@/shared/lib/mongodb";
import { hashPassword } from "@/features/admin";
import { env } from "@/shared/lib/env";

export async function seedAdmins() {
  const db = await getDb();
  const col = db.collection("admins");
  
  const email = "admin@example.com"; // User should change this
  const password = env.ADMIN_API_KEY || "change-me-immediately";
  
  const existing = await col.findOne({ email });
  if (!existing) {
    console.log("Seeding initial admin...");
    await col.insertOne({
      email,
      passwordHash: hashPassword(password),
      status: "active",
      role: "owner",
      createdAt: new Date(),
    });
    console.log("Admin seeded: ", email);
  }
}
