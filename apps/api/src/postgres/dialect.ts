/**
 * The API writes SQLite SQL (D1). On PostgreSQL (ADR 0045, R2) each statement is translated once and cached. The
 * rules cover exactly what the API uses (inventory of 27.11.2026); anything else passes through unchanged and
 * fails loudly in Postgres instead of silently meaning something else.
 *
 * | SQLite | PostgreSQL |
 * | --- | --- |
 * | `?`, `?N` | `$1 … $n` (a value is repeated where `?N` is used twice) |
 * | `unixepoch()` | `CAST(EXTRACT(EPOCH FROM now()) AS BIGINT)` |
 * | `unixepoch('subsec')` | `EXTRACT(EPOCH FROM clock_timestamp())` |
 * | `INSERT OR IGNORE INTO …` | `INSERT INTO … ON CONFLICT DO NOTHING` |
 * | `json_object(` | `json_build_object(` |
 * | `MAX(a, b)`, `MIN(a, b)` (scalar) | `GREATEST(a, b)`, `LEAST(a, b)` |
 * | `LIKE` (case-insensitive in SQLite) | `ILIKE` |
 * | `? IS NULL` | `CAST($n AS TEXT) IS NULL` (Postgres cannot type a bare parameter) |
 * | FTS5 on `knowledge_fts` (`MATCH`, `bm25`) | `to_tsvector` / `websearch_to_tsquery` / `ts_rank` |
 *
 * camelCase names (`AS updatedAt`) are quoted, as Postgres would fold them to lower case.
 *
 * `rowid` stays: the Postgres schema gives the tables that order by it an identity column of that name.
 */
export interface Translated {
  text: string;
  /** For each `$k`, the index of the bound value it takes. */
  sources: number[];
}

/** Splits SQL into code and the parts the rules must not touch (string literals, quoted names, comments). */
function segments(sql: string): { code: boolean; text: string }[] {
  const parts: { code: boolean; text: string }[] = [];
  let index = 0;
  let start = 0;
  const push = (code: boolean, end: number) => {
    if (end > start) parts.push({ code, text: sql.slice(start, end) });
    start = end;
  };
  while (index < sql.length) {
    const char = sql[index];
    const next = sql[index + 1];
    let end = -1;
    if (char === "'" || char === '"') {
      end = index + 1;
      while (end < sql.length) {
        if (sql[end] === char) {
          if (sql[end + 1] === char) end += 2;
          else break;
        } else end += 1;
      }
      end += 1;
    } else if (char === "-" && next === "-") {
      end = sql.indexOf("\n", index);
      if (end === -1) end = sql.length;
    } else if (char === "/" && next === "*") {
      end = sql.indexOf("*/", index + 2);
      end = end === -1 ? sql.length : end + 2;
    }
    if (end === -1) {
      index += 1;
      continue;
    }
    push(true, index);
    push(false, end);
    index = end;
  }
  push(true, sql.length);
  return parts;
}

/** Rewrites `MAX(` / `MIN(` with two or more top-level arguments into GREATEST / LEAST. */
function scalarExtremes(code: string): string {
  let result = "";
  let index = 0;
  const pattern = /\b(MAX|MIN)\s*\(/gi;
  for (let match = pattern.exec(code); match; match = pattern.exec(code)) {
    let depth = 1;
    let commas = 0;
    let end = match.index + match[0].length;
    for (; end < code.length && depth > 0; end += 1) {
      const char = code[end];
      if (char === "(") depth += 1;
      else if (char === ")") depth -= 1;
      else if (char === "," && depth === 1) commas += 1;
    }
    if (commas === 0) continue;
    result += code.slice(index, match.index) + ((match[1] ?? "").toUpperCase() === "MAX" ? "GREATEST(" : "LEAST(");
    index = match.index + match[0].length;
  }
  return result + code.slice(index);
}

const FTS_VECTOR = "to_tsvector('simple', coalesce(heading, '') || ' ' || coalesce(text, ''))";

function rewriteCode(code: string): string {
  let out = code
    .replace(/\bunixepoch\s*\(\s*'subsec'\s*\)/gi, "EXTRACT(EPOCH FROM clock_timestamp())")
    .replace(/\bunixepoch\s*\(\s*\)/gi, "CAST(EXTRACT(EPOCH FROM now()) AS BIGINT)")
    .replace(/\bjson_object\s*\(/gi, "json_build_object(")
    .replace(/(?<![\w])LIKE\b/g, "ILIKE")
    .replace(/\?(\d*)(\s+IS\s+(?:NOT\s+)?NULL\b)/gi, "CAST(?$1 AS TEXT)$2")
    .replace(/\bknowledge_fts\s+MATCH\s+\?/gi, `${FTS_VECTOR} @@ websearch_to_tsquery('simple', ?)`)
    .replace(/\bORDER\s+BY\s+bm25\s*\(\s*knowledge_fts\s*\)/gi, `ORDER BY ts_rank(${FTS_VECTOR}, websearch_to_tsquery('simple', ?1)) DESC`);
  out = scalarExtremes(out);
  // Postgres folds unquoted names to lower case; camelCase aliases (`AS updatedAt`) keep their case quoted.
  out = out.replace(/(?<![\w"$.])([a-z][a-z0-9]*[A-Z][A-Za-z0-9]*)\b/g, '"$1"');
  return out;
}

const cache = new Map<string, Translated>();

export function toPostgres(sql: string): Translated {
  const known = cache.get(sql);
  if (known) return known;
  // `'subsec'` is a literal, which the segments below protect; this one call is rewritten first.
  const parts = segments(sql.replace(/\bunixepoch\s*\(\s*'subsec'\s*\)/gi, "EXTRACT(EPOCH FROM clock_timestamp())"));
  let ignore = false;
  for (const part of parts) {
    if (!part.code) continue;
    if (/\bINSERT\s+OR\s+IGNORE\s+INTO\b/i.test(part.text)) {
      ignore = true;
      part.text = part.text.replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/i, "INSERT INTO");
    }
    part.text = rewriteCode(part.text);
  }

  // Placeholders: `?N` takes value N, a plain `?` the next one in order (as the SQLite adapter binds them).
  const sources: number[] = [];
  let next = 0;
  for (const part of parts) {
    if (!part.code) continue;
    part.text = part.text.replace(/\?(\d*)/g, (_match, number: string) => {
      sources.push(number ? Number(number) - 1 : next++);
      return `$${sources.length}`;
    });
  }

  let text = parts.map((part) => part.text).join("").trim().replace(/;\s*$/, "");
  if (ignore) {
    // ON CONFLICT goes before a RETURNING clause, otherwise at the end.
    const returning = text.search(/\bRETURNING\b(?![\s\S]*\bRETURNING\b)/i);
    text = returning === -1 ? `${text} ON CONFLICT DO NOTHING` : `${text.slice(0, returning)}ON CONFLICT DO NOTHING ${text.slice(returning)}`;
  }
  const translated = { text, sources };
  cache.set(sql, translated);
  return translated;
}
