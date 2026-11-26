/**
 * What a workstation may run (ADR 0035). The model picks a name from this list; it never sends a command line.
 * Every step is an argv list, run without a shell, each with its own time limit.
 */
export const WORKSTATION_COMMANDS = {
  install: { argv: ["pnpm", "install", "--frozen-lockfile"], timeoutSeconds: 300 },
  check: { argv: ["pnpm", "check"], timeoutSeconds: 420 },
  test: { argv: ["pnpm", "test"], timeoutSeconds: 420 },
  lint: { argv: ["pnpm", "lint"], timeoutSeconds: 240 },
  typecheck: { argv: ["pnpm", "typecheck"], timeoutSeconds: 240 },
  build: { argv: ["pnpm", "build"], timeoutSeconds: 420 },
} as const satisfies Record<string, { argv: readonly string[]; timeoutSeconds: number }>;

export type WorkstationCommand = keyof typeof WORKSTATION_COMMANDS;

export const COMMAND_NAMES = Object.keys(WORKSTATION_COMMANDS) as WorkstationCommand[];

/** Container size of every run; see the cost table in ADR 0035. */
export const INSTANCE_TYPE = "standard-1";
/** Wall time of a whole run; the container is destroyed after it at the latest. */
export const MAX_RUN_SECONDS = 600;
/** Runs one tenant may start per UTC day. */
export const DAILY_RUNS_PER_TENANT = 20;
/** Output kept per step; the end is kept, because that is where errors are. */
export const MAX_OUTPUT_CHARS = 16_000;

export function isCommand(value: unknown): value is WorkstationCommand {
  return typeof value === "string" && value in WORKSTATION_COMMANDS;
}

/**
 * Steps of a run: install first (unless that is the command), then the command. A repository without a
 * lockfile still gets `pnpm install`, without --frozen-lockfile, so a plain package.json works too.
 */
export function stepsFor(command: WorkstationCommand, hasLockfile: boolean): { name: string; argv: string[]; timeoutSeconds: number }[] {
  const install = { name: "install", argv: hasLockfile ? [...WORKSTATION_COMMANDS.install.argv] : ["pnpm", "install"], timeoutSeconds: WORKSTATION_COMMANDS.install.timeoutSeconds };
  if (command === "install") return [install];
  const step = WORKSTATION_COMMANDS[command];
  return [install, { name: command, argv: [...step.argv], timeoutSeconds: step.timeoutSeconds }];
}

/**
 * Steps of a preview upload (ADR 0035): install, the repository's own build if it has one, then a new version of
 * the project's preview Worker with an alias. Wrangler talks to api.cloudflare.com only through the gateway.
 */
export function previewSteps(hasLockfile: boolean, workerName: string, alias: string): { name: string; argv: string[]; timeoutSeconds: number }[] {
  return [
    ...stepsFor("install", hasLockfile),
    { name: "build", argv: ["pnpm", "run", "--if-present", "build"], timeoutSeconds: WORKSTATION_COMMANDS.build.timeoutSeconds },
    {
      name: "upload",
      argv: ["pnpm", "dlx", "wrangler@4", "versions", "upload", "--name", workerName, "--preview-alias", alias],
      timeoutSeconds: 240,
    },
  ];
}

const SECRET_PATTERNS = [
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{16,}/gi,
  /\/\/[^/\s:@]+:[^/\s@]+@/g,
];

/** Removes anything that looks like a credential. The container holds none, but output is checked anyway. */
export function redact(text: string): string {
  return SECRET_PATTERNS.reduce((result, pattern) => result.replace(pattern, (match) => (match.startsWith("//") ? "//[geschwärzt]@" : "[geschwärzt]")), text);
}

/** Keeps the last `limit` characters of an output, redacted, and says whether something was cut. */
export function tail(text: string, limit = MAX_OUTPUT_CHARS): { text: string; truncated: boolean } {
  const clean = redact(text);
  if (clean.length <= limit) return { text: clean, truncated: false };
  return { text: `[… ${clean.length - limit} Zeichen gekürzt …]\n${clean.slice(-limit)}`, truncated: true };
}

const REF_FORMAT = /^(?![-/.])(?!.*\.\.)[A-Za-z0-9._/-]{1,200}$/;

/** A branch, tag or commit as git accepts it; nothing that could be read as an option. */
export function assertRef(ref: string): string {
  if (!REF_FORMAT.test(ref)) throw new Error(`Ungültiger Branch oder Commit: ${ref.slice(0, 60)}`);
  return ref;
}

export const isCommitSha = (ref: string): boolean => /^[0-9a-f]{40}$/.test(ref);
