import { parseArgs } from "node:util";
import { db } from "./commands/db.ts";
import { dev, localRun } from "./commands/dev.ts";
import { doctor } from "./commands/doctor.ts";
import {
  secretsAudit,
  secretsCopy,
  secretsGenerate,
  secretsImport,
  secretsPrune,
  secretsRun,
  secretsSet,
} from "./commands/secrets.ts";
import { hostingEnv, hostingSetup, hostingStatus } from "./commands/hosting.ts";
import { setup } from "./commands/setup.ts";
import { smoke } from "./commands/smoke.ts";
import { run } from "./lib/exec.ts";
import { accessHint, withSecrets } from "./lib/infisical.ts";
import { parseStage, STAGES, type Stage } from "./lib/stages.ts";

const HELP = `uguroezdamar.com CLI — pnpm ugur <command>

  setup [--relink]           One-time: sign in to Infisical and Neon in the browser, link the project
                             (--relink chooses a different Infisical project)
  doctor                     Check tools, logins and required secrets
  dev [--filter site|portal] Run the site with dev secrets injected and localhost addresses
      [--all]                (--filter portal for the portal, --all for both)
  run -- <cmd>               Run a command with secrets and localhost addresses (e.g. a local build)
  smoke --site <url>         Check a deployment over HTTP: commit, database, client address,
      [--portal <url>]       refusals. Stores nothing. --commit <sha> pins the expected commit
  hosting status             Compare the two Vercel projects with what the repository expects
  hosting setup [--apply]    Manual go-live for production, protection bypass for the smoke run
  hosting env [--apply]      Copy an app's secrets from Infisical --stage to its Vercel environment
  secrets audit              Compare Infisical with the secrets manifest (names only)
  secrets set <KEY>          Set a declared key from a hidden prompt (both stages unless --stage)
  secrets generate [--apply] Create missing random keys and tokens; --rotate replaces existing ones
  secrets copy <KEY…>        Copy keys between stages: --from dev --to prod [--apply] [--overwrite]
  secrets import <file>      Move declared keys from a .env file into Infisical [--apply] [--overwrite]
  secrets prune [--apply]    Remove retired keys
  secrets run -- <cmd>       Run a command with the stage's secrets exactly as stored
  db provision [--apply]     Neon project, a branch per stage, connection strings → Infisical
  db generate | check        Create a migration / verify none is missing (offline)
  db migrate | studio        Apply migrations / open Drizzle Studio on --stage
  admin create <email>       Create an owner account (password from a hidden prompt)
  admin set-password <email> Change a password and sign the account out everywhere
  admin list | unlock        Show accounts / clear failed login attempts

Options:  --stage dev|prod   (default: dev)      Destructive or cloud-changing commands are dry runs
                                                 until you add --apply.
`;

const separator = process.argv.indexOf("--");
const argv = process.argv.slice(2, separator === -1 ? undefined : separator);
const passthrough = separator === -1 ? [] : process.argv.slice(separator + 1);

const { values, positionals } = parseArgs({
  args: argv,
  allowPositionals: true,
  options: {
    stage: { type: "string" },
    filter: { type: "string", multiple: true },
    from: { type: "string" },
    to: { type: "string" },
    overwrite: { type: "boolean", default: false },
    rotate: { type: "boolean", default: false },
    relink: { type: "boolean", default: false },
    all: { type: "boolean", default: false },
    site: { type: "string" },
    portal: { type: "string" },
    commit: { type: "string" },
    apply: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

const [command, sub] = positionals;

async function main(): Promise<number> {
  if (values.help || !command) {
    console.log(HELP);
    return 0;
  }
  const stage = parseStage(values.stage);
  switch (`${command} ${sub ?? ""}`.trim()) {
    case "setup":
      return setup(values.relink);
    case "doctor":
      return doctor(stage);
    case "dev":
      return dev(values.filter ?? [], { all: values.all });
    case "smoke":
      return smoke({ site: values.site, portal: values.portal, commit: values.commit });
    case "run":
      return localRun(stage, passthrough);
    case "hosting status":
      return hostingStatus();
    case "hosting setup":
      return hostingSetup(values.apply);
    case "hosting env":
      return hostingEnv(stage, values.apply);
    case "secrets audit":
      return secretsAudit(stage);
    case "secrets prune":
      return secretsPrune(stage, values.apply);
    case "secrets set":
      return secretsSet(positionals[2], values.stage ? [stage] : (Object.keys(STAGES) as Stage[]));
    case "secrets generate":
      return secretsGenerate(stage, values.apply, values.rotate);
    case "secrets copy":
      return secretsCopy(
        positionals.slice(2),
        parseStage(values.from, "dev"),
        parseStage(values.to, "prod"),
        values.apply,
        values.overwrite,
      );
    case "secrets import":
      return secretsImport(positionals[2], stage, values.apply, values.overwrite);
    case "secrets run":
      return secretsRun(stage, passthrough);
    default:
      if (command === "db") return db(sub, stage, values.apply, values.overwrite);
      if (command === "admin") {
        const invocation = withSecrets(stage, [
          "node",
          "tooling/cli/src/scripts/admin.ts",
          ...positionals.slice(1),
        ]);
        if (!invocation) {
          console.error(accessHint());
          return 1;
        }
        return run(...invocation).code;
      }
      console.error(`Unknown command "${positionals.join(" ")}".\n\n${HELP}`);
      return 1;
  }
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
}
