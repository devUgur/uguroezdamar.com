import { createRequire } from "node:module";
import { resolve } from "node:path";

const requireServerDependency = createRequire(resolve(process.cwd(), "packages/server/package.json"));
const argon2 = requireServerDependency("argon2");

export async function hashAdminPassword(password) {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65_536,
    timeCost: 3,
    parallelism: 1,
  });
}
