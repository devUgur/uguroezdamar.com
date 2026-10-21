import { accessHint, listSecretNames, secretValues, setSecret } from "../lib/infisical.ts";
import type { Stage } from "../lib/stages.ts";
import {
  envNames,
  getProject,
  VERCEL_PROJECTS,
  VERCEL_TARGET,
  hasMatchingProtectionBypass,
  vercelApi,
  type App,
  type VercelProject,
} from "../lib/vercel.ts";
import { secretsFor } from "../secrets-manifest.ts";

const APPS = Object.keys(VERCEL_PROJECTS) as App[];
const BYPASS_KEY: Record<App, string> = { site: "VERCEL_BYPASS_SITE", portal: "VERCEL_BYPASS_PORTAL" };

/** The keys an app reads at a stage, from the manifest: the only list of what gets synced. */
const keysFor = (app: App, stage: Stage, { optional = true } = {}) =>
  secretsFor(stage)
    .filter((spec) => spec.apps?.includes(app) && (optional || !spec.optional))
    .map((spec) => spec.key);

function describe(app: App, project: VercelProject, bypassStatus: string): string[] {
  const expected = VERCEL_PROJECTS[app];
  const production = project.targets?.production;
  const lines = [
    `${app}: ${project.name}`,
    `  repository        ${project.link ? `${project.link.org}/${project.link.repo}, production branch ${project.link.productionBranch}` : "not connected"}`,
    `  root directory    ${project.rootDirectory}${project.rootDirectory === expected.rootDirectory ? "" : `  ✗ expected ${expected.rootDirectory}`}`,
    `  node              ${project.nodeVersion}`,
    `  production        ${production?.meta?.githubCommitSha?.slice(0, 7) ?? "no deployment"} at ${production?.alias?.[0] ?? "no address"}`,
    `  go-live           ${project.autoAssignCustomDomains === false ? "manual (promote)" : "✗ automatic on every push to the production branch"}`,
    `  protection        ${project.ssoProtection?.deploymentType ?? "✗ none"}`,
    `  smoke bypass      ${bypassStatus}`,
  ];
  for (const stage of ["dev", "prod"] as const) {
    const target = VERCEL_TARGET[stage];
    const present = envNames(project, target);
    const wanted = keysFor(app, stage);
    // An optional key has a default in the code; its absence is not a fault.
    const missing = keysFor(app, stage, { optional: false }).filter((key) => !present.includes(key));
    const extra = present.filter((key) => !wanted.includes(key));
    const state = missing.length === 0 && extra.length === 0 ? "in step" : [missing.length ? `✗ missing ${missing.join(", ")}` : "", extra.length ? `undeclared ${extra.join(", ")}` : ""].filter(Boolean).join("; ");
    lines.push(`  env ${target.padEnd(13)} ${state}`);
  }
  return lines;
}

/** What the two Vercel projects look like, against what the repository expects. Names only. */
export function hostingStatus(): number {
  let failed = false;
  for (const app of APPS) {
    const project = getProject(app);
    if (!project.ok || !project.data) {
      console.error(`${app}: ${project.error}`);
      failed = true;
      continue;
    }
    const storedBypass = secretValues("dev", [BYPASS_KEY[app]])?.[BYPASS_KEY[app]];
    const bypassStatus = hasMatchingProtectionBypass(project.data, storedBypass)
      ? "matches Infisical dev"
      : storedBypass
        ? "✗ does not match Infisical dev"
        : "✗ unavailable in Infisical dev";
    const lines = describe(app, project.data, bypassStatus);
    failed ||= lines.some((line) => line.includes("✗"));
    console.log(`${lines.join("\n")}\n`);
  }
  return failed ? 1 : 0;
}

/**
 * Project settings the release process relies on: a push to the production branch builds but
 * does not go live, and the smoke run can pass the preview protection. Idempotent.
 */
export function hostingSetup(apply: boolean): number {
  let failed = false;
  for (const app of APPS) {
    const project = getProject(app);
    if (!project.ok || !project.data) {
      console.error(`${app}: ${project.error}`);
      failed = true;
      continue;
    }
    const { id } = project.data;

    if (project.data.autoAssignCustomDomains !== false) {
      if (!apply) console.log(`${app}: would turn off automatic go-live`);
      else {
        const result = vercelApi(`/v9/projects/${id}`, { method: "PATCH", body: { autoAssignCustomDomains: false } });
        console.log(`${app}: automatic go-live ${result.ok ? "turned off" : `not changed — ${result.error}`}`);
        failed ||= !result.ok;
      }
    }

    if (Object.keys(project.data.protectionBypass ?? {}).length === 0) {
      if (!apply) console.log(`${app}: would create a protection bypass and store it as ${BYPASS_KEY[app]} (dev)`);
      else {
        const result = vercelApi<{ protectionBypass?: Record<string, unknown> }>(`/v1/projects/${id}/protection-bypass`, {
          method: "PATCH",
          body: { generate: { note: "pnpm ugur smoke" } },
        });
        // The answer is keyed by the secret itself; it goes straight to Infisical, never to the terminal.
        const secret = Object.keys(result.data?.protectionBypass ?? {})[0];
        const stored = secret ? setSecret("dev", BYPASS_KEY[app], secret) : { ok: false, error: result.error ?? "no secret returned" };
        console.log(`${app}: protection bypass ${stored.ok ? `created and stored as ${BYPASS_KEY[app]}` : `failed — ${stored.error}`}`);
        failed ||= !stored.ok;
      }
    }
  }
  if (!apply) console.log("\nDry run. Add --apply to change the projects.");
  return failed ? 1 : 0;
}

/**
 * Copies the secrets an app reads from an Infisical stage to that stage's Vercel environment.
 * Infisical stays the source: rerun this after a rotation. Values move in memory and over
 * stdin only; the terminal shows names.
 */
export function hostingEnv(stage: Stage, apply: boolean): number {
  const names = listSecretNames(stage);
  if (!names) {
    console.error(accessHint());
    return 1;
  }
  const target = VERCEL_TARGET[stage];
  let failed = false;
  for (const app of APPS) {
    const keys = keysFor(app, stage);
    const available = keys.filter((key) => names.filled.includes(key));
    const absent = keys.filter((key) => !names.filled.includes(key));
    const optional = new Set(secretsFor(stage).filter((spec) => spec.optional).map((spec) => spec.key));
    const blocking = absent.filter((key) => !optional.has(key));
    console.log(`${app} → ${VERCEL_PROJECTS[app].name} (${target}): ${available.join(", ") || "nothing"}`);
    if (blocking.length > 0) {
      console.error(`  ✗ not in Infisical ${stage}: ${blocking.join(", ")}`);
      failed = true;
      continue;
    }
    if (!apply || available.length === 0) continue;

    const values = secretValues(stage, available);
    if (!values) {
      console.error(`  ✗ ${accessHint()}`);
      failed = true;
      continue;
    }
    const body = available.map((key) => ({
      key,
      value: values[key],
      // A NEXT_PUBLIC_ value ends up in the browser bundle; everything else is write-only.
      type: key.startsWith("NEXT_PUBLIC_") ? "plain" : "sensitive",
      target: [target],
    }));
    // One request per variable: the CLI accepts an object as a body, not a list.
    const errors = body
      .map((entry) => ({ key: entry.key, result: vercelApi(`/v10/projects/${VERCEL_PROJECTS[app].name}/env?upsert=true`, { method: "POST", body: entry }) }))
      .filter(({ result }) => !result.ok);
    for (const { key, result } of errors) console.error(`  ✗ ${key}: ${result.error}`);
    console.log(`  set ${available.length - errors.length} of ${available.length} variable(s)`);
    failed ||= errors.length > 0;
  }
  if (!apply) console.log("\nDry run. Add --apply to write to Vercel.");
  else if (!failed) console.log("\nA running deployment keeps its old values; redeploy to pick up the new ones.");
  return failed ? 1 : 0;
}
