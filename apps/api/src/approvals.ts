/**
 * What Ugur sees on an approval card. Pure, so the agent loop and the API share one wording.
 * Paths that control deployment, auth or secrets are marked as security relevant.
 */
export type ApprovalRisk = "security" | "release" | null;

export interface ApprovalDescription {
  summary: string;
  risk: ApprovalRisk;
  /** Shown in red on the card. */
  warnings: string[];
}

/** Approvals expire after a day; the agent then has to propose again. */
export const APPROVAL_TTL_SECONDS = 24 * 60 * 60;

export const PROTECTED_PATHS: { pattern: RegExp; label: string; reason: string }[] = [
  { pattern: /^\.github\/workflows\//, label: ".github/workflows/**", reason: "CI/Deploy-Workflow" },
  { pattern: /^apps\/api\/wrangler\.jsonc$/, label: "apps/api/wrangler.jsonc", reason: "API-Konfiguration (Bindings, Domains)" },
  { pattern: /^apps\/api\/src\/auth\.ts$/, label: "apps/api/src/auth.ts", reason: "Anmeldung der API" },
  { pattern: /^apps\/api\/src\/approvals\.ts$/, label: "apps/api/src/approvals.ts", reason: "Regeln für Freigaben" },
  { pattern: /^tooling\/cli\/src\/secrets-manifest\.ts$/, label: "tooling/cli/src/secrets-manifest.ts", reason: "Secret-Manifest" },
];

interface FileArg {
  path?: unknown;
  delete?: unknown;
}

export function protectedReasons(paths: string[]): string[] {
  const reasons: string[] = [];
  for (const path of paths) {
    const hit = PROTECTED_PATHS.find((entry) => entry.pattern.test(path.replace(/^\/+/, "")));
    if (hit) reasons.push(`${path}: ${hit.reason}`);
  }
  return reasons;
}

export function describeApproval(tool: string, args: Record<string, unknown>): ApprovalDescription {
  if (tool === "repo_commit_files") {
    const files = (Array.isArray(args.files) ? args.files : []) as FileArg[];
    const paths = files.map((file) => (typeof file.path === "string" ? file.path : "?"));
    const branch = typeof args.branch === "string" && args.branch ? args.branch : "dev";
    const list = files
      .map((file, index) => `${file.delete === true ? "löschen" : "schreiben"} ${paths[index]}`)
      .join(", ");
    const warnings = protectedReasons(paths).map((reason) => `Sicherheitsrelevant – ${reason}`);
    if (branch === "dev") warnings.push("Commit auf dev wird automatisch in die Dev-Umgebung ausgeliefert (api-dev, Portal-Preview).");
    return {
      summary: `Commit auf ${branch}: „${String(args.message ?? "")}“ – ${list || "keine Dateien"}`,
      risk: protectedReasons(paths).length ? "security" : null,
      warnings,
    };
  }
  if (tool === "repo_open_pull_request") {
    const branch = String(args.branch ?? "?");
    const release = branch === "dev";
    return {
      summary: `Pull Request ${branch} → ${release ? "main" : "dev"}: „${String(args.title ?? "")}“`,
      risk: release ? "release" : null,
      warnings: release ? ["Release-PR: sein Merge liefert in Produktion aus."] : [],
    };
  }
  if (tool === "project_register") {
    return {
      summary: `Projekt registrieren: ${String(args.repo ?? "?")}`,
      risk: "security",
      warnings: ["Agenten dürfen dort danach Branches agent/… und Pull Requests anlegen (jeder Commit bleibt freigabepflichtig). Lesen ging schon vorher."],
    };
  }
  if (tool === "repo_create") {
    const isPublic = args.private === false;
    return {
      summary: `Repository anlegen: ${String(args.name ?? "?")} (${isPublic ? "öffentlich" : "privat"}) und als Projekt registrieren`,
      risk: "security",
      warnings: [
        isPublic ? "ÖFFENTLICH: Jeder im Internet kann den Inhalt sehen." : "Privat, auf deinem Konto.",
        "Das Anlegen lässt sich nur auf GitHub wieder rückgängig machen (Löschen).",
      ],
    };
  }
  if (tool === "preview_deploy") {
    const target = typeof args.pullRequest === "number" ? `Pull Request #${args.pullRequest}` : `Branch ${String(args.branch ?? "?")}`;
    return {
      summary: `Preview anlegen für ${target}: bauen und als Version des Preview-Workers hochladen`,
      risk: null,
      warnings: ["Die Preview-URL ist öffentlich erreichbar (workers.dev), auch bei privaten Repositories.", "Kostet einen Workstation-Lauf (Container, wenige Minuten)."],
    };
  }
  const text = JSON.stringify(args);
  return { summary: `${tool}: ${text.length > 400 ? `${text.slice(0, 400)}…` : text}`, risk: null, warnings: [] };
}
