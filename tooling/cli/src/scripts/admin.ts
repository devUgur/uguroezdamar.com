import argon2 from "argon2";
import postgres from "postgres";
import { askHidden } from "../lib/prompt.ts";

/**
 * Admin account maintenance against the database of the stage whose secrets are in the
 * environment (started by `pnpm ugur admin …`). The password is typed at a hidden prompt.
 */
const [command, argument] = process.argv.slice(2);
const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set — run `pnpm ugur db provision --apply` first.");
  process.exit(1);
}
const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });

async function password(): Promise<string | null> {
  const first = await askHidden("Password (at least 12 characters): ");
  if (first === null) {
    console.error("Needs an interactive terminal: run it yourself in a terminal.");
    return null;
  }
  if (first.length < 12) {
    console.error("Too short — nothing changed.");
    return null;
  }
  if ((await askHidden("Repeat: ")) !== first) {
    console.error("The two entries differ — nothing changed.");
    return null;
  }
  // Same parameters as packages/server/src/admin/logic.ts.
  return argon2.hash(first, { type: argon2.argon2id, memoryCost: 65_536, timeCost: 3, parallelism: 1 });
}

async function main(): Promise<number> {
  const email = argument?.trim().toLowerCase();
  switch (command) {
    case "create": {
      if (!email || !email.includes("@")) return usage();
      const [existing] = await sql`select id from admins where email = ${email}`;
      if (existing) {
        console.error(`${email} already exists. Use \`admin set-password\` to change the password.`);
        return 1;
      }
      const hash = await password();
      if (!hash) return 1;
      await sql`insert into admins (email, password_hash, status, role) values (${email}, ${hash}, 'active', 'owner')`;
      console.log(`✓ owner ${email} created`);
      return 0;
    }
    case "set-password": {
      if (!email) return usage();
      const [existing] = await sql`select id from admins where email = ${email}`;
      if (!existing) {
        console.error(`No admin ${email}.`);
        return 1;
      }
      const hash = await password();
      if (!hash) return 1;
      await sql.begin(async (tx) => {
        await tx`update admins set password_hash = ${hash} where id = ${existing.id}`;
        await tx`delete from admin_sessions where admin_id = ${existing.id}`;
      });
      console.log(`✓ password changed for ${email}; existing sessions signed out`);
      return 0;
    }
    case "list": {
      const rows = await sql`select email, role, status, last_login from admins order by created_at`;
      for (const row of rows) {
        const login = row.last_login ? new Date(row.last_login).toISOString() : "never";
        console.log(`${row.email}  ${row.role}  ${row.status}  last login: ${login}`);
      }
      if (rows.length === 0) console.log("No admins yet — `pnpm ugur admin create <email>`.");
      return 0;
    }
    case "unlock": {
      const result = await sql`delete from admin_login_attempts`;
      console.log(`✓ ${result.count} failed login attempt(s) cleared`);
      return 0;
    }
    default:
      return usage();
  }
}

function usage(): number {
  console.error("Usage: pnpm ugur admin <create <email> | set-password <email> | list | unlock> [--stage dev|prod]");
  return 1;
}

try {
  process.exitCode = await main();
} catch (error) {
  // Driver errors can quote the connection string; report the kind of failure only.
  console.error(`Database error: ${(error as { code?: string }).code ?? (error as Error).name}`);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
