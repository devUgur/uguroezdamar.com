import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { hubObjectName, OWNER_TENANT, officeObjectName, TENANT_SCOPED_TABLES, TENANT_TABLES, threadObjectName } from "../apps/api/src/tenancy.ts";

const apiSource = resolve(import.meta.dirname, "../apps/api/src");

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return files(path);
    return entry.name.endsWith(".ts") ? [path] : [];
  });
}

/** Text of every string and template literal in a file, with the line it starts on. */
function literals(path: string): { text: string; line: number }[] {
  const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
  const found: { text: string; line: number }[] = [];
  const visit = (node: ts.Node): void => {
    let text: string | undefined;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) text = node.text;
    else if (ts.isTemplateExpression(node)) text = node.head.text + node.templateSpans.map((span) => `\${…}${span.literal.text}`).join("");
    if (text !== undefined) found.push({ text, line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1 });
    if (!ts.isTemplateExpression(node)) ts.forEachChild(node, visit);
    else node.templateSpans.forEach((span) => ts.forEachChild(span.expression, visit));
  };
  visit(source);
  return found;
}

const TABLE_REFERENCE = new RegExp(`\\b(?:FROM|JOIN|UPDATE|INTO)\\s+(?:${TENANT_SCOPED_TABLES.join("|")})\\b`);
const STATES_TENANT = /tenant_id|\/\* tenant:(?:parent|platform) \*\//;

describe("tenant isolation in the API's SQL", () => {
  it("names the tenant in every statement on a tenant table, or says why it need not", () => {
    const unscoped: string[] = [];
    for (const path of files(apiSource)) {
      for (const { text, line } of literals(path)) {
        if (TABLE_REFERENCE.test(text) && !STATES_TENANT.test(text)) {
          unscoped.push(`${path.slice(apiSource.length + 1)}:${line}: ${text.replace(/\s+/g, " ").slice(0, 90)}`);
        }
      }
    }
    // A new query without tenant_id fails here. Scope it, or tag it: tenant:parent when it only reaches rows through a
    // parent row an earlier statement read for this tenant, tenant:platform when it is deliberately across tenants.
    expect(unscoped).toEqual([]);
  });

  it("covers every table the migrations gave a tenant column", () => {
    const migration = readFileSync(resolve(apiSource, "../migrations/0011_tenants.sql"), "utf8");
    const withColumn = [...migration.matchAll(/ALTER TABLE (\w+) ADD COLUMN tenant_id/g)].map((match) => match[1]);
    expect([...withColumn].sort()).toEqual([...TENANT_TABLES].sort());
  });
});

describe("object names", () => {
  it("keeps the owner's original names so existing threads stay reachable", () => {
    expect(threadObjectName(OWNER_TENANT, "abc")).toBe("thread:abc");
    expect(hubObjectName(OWNER_TENANT)).toBe("main");
    expect(officeObjectName(OWNER_TENANT)).toBe("main");
  });

  it("gives every other tenant a namespace of its own, so one cannot address another's objects", () => {
    expect(threadObjectName("acme", "abc")).toBe("t:acme:thread:abc");
    expect(threadObjectName("acme", "abc")).not.toBe(threadObjectName("globex", "abc"));
    expect(new Set([hubObjectName("acme"), officeObjectName("acme"), hubObjectName("globex")]).size).toBe(3);
  });
});
