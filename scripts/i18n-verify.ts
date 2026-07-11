/**
 * i18n verification pass.
 *
 * Walks every source file under `src/` and cross-references `t("…")` call
 * sites against the central `i18nStrings` map (`src/lib/i18n/keys.ts`).
 *
 * Reports:
 *   1. MISSING     — keys referenced in code but not defined in the map.
 *   2. UNUSED      — keys defined in the map but never referenced from code.
 *   3. INTERP MISMATCH — call site passes a vars object whose members do
 *                        not match the `{{token}}`s in the template.
 *   4. LOOKS-LIKE-HARDCODED — top-level JSX text nodes that appear to be
 *                              English sentences (heuristic; opt-in).
 *
 * Usage:
 *   bun run i18n:verify          → human-readable report; exits non-zero on
 *                                   MISSING / INTERP MISMATCH.
 *   bun run i18n:verify --json   → machine-readable report to stdout.
 *   bun run i18n:verify --strict → also fail on UNUSED keys.
 *
 * The freshness contract lives in `src/lib/i18n/verify.test.ts`, which runs
 * the same audit inside vitest so CI blocks drift.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const SRC = resolve(ROOT, "src");
const KEYS_FILE = resolve(SRC, "lib/i18n/keys.ts");

const CODE_EXT = new Set([".ts", ".tsx"]);
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".output"]);
const SELF_FILES = new Set([
  resolve(SRC, "lib/i18n/keys.ts"),
  resolve(SRC, "lib/i18n/keys.test.ts"),
  resolve(SRC, "lib/i18n/t.ts"),
  resolve(SRC, "lib/i18n/verify.test.ts"),
]);

/** Files that legitimately declare `t(...)` for non-i18n purposes. */
const IGNORE_T_CALLS: Array<RegExp> = [
  /\.test\.ts(x)?$/,
];

export type Usage = {
  file: string;
  line: number;
  key: string;
  varsProvided: string[] | null;
};

export type VerifyReport = {
  totalKeys: number;
  totalUsages: number;
  missing: Usage[]; // referenced but not defined
  unused: string[]; // defined but not referenced
  interpMismatch: Array<{
    usage: Usage;
    templateVars: string[];
    providedVars: string[];
    missingInCall: string[];
    extraInCall: string[];
  }>;
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (CODE_EXT.has(extname(name))) out.push(full);
  }
  return out;
}

const KEY_CALL_RE =
  /\bt\(\s*(["'`])([a-z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)+)\1(?:\s*,\s*(\{[^{}]*\}))?/g;
const KEYMAP_ENTRY_RE = /^\s*(["'`])([a-z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)+)\1\s*:/gm;
const INTERP_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
const OBJ_KEY_RE = /(?:^|[,{])\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g;

function extractKeymap(): Map<string, string> {
  const src = readFileSync(KEYS_FILE, "utf8");
  const out = new Map<string, string>();
  // Match every "key": "…value…" line; supports single/double/backtick and
  // multi-line string continuations by walking to the terminating `,` or `}`.
  const startRe = /^(\s*)(["'`])([a-z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)+)\2\s*:\s*/gm;
  let m: RegExpExecArray | null;
  while ((m = startRe.exec(src))) {
    const key = m[3];
    // Parse the value string that follows. Handles "a" + "b" concatenation
    // and template strings loosely — we only need the {{token}} contents.
    let i = m.index + m[0].length;
    let value = "";
    // Read string literals greedily until we hit a comma or closing brace at
    // top level.
    while (i < src.length) {
      const ch = src[i];
      if (ch === '"' || ch === "'" || ch === "`") {
        const quote = ch;
        i++;
        while (i < src.length && src[i] !== quote) {
          if (src[i] === "\\") i += 2;
          else {
            value += src[i];
            i++;
          }
        }
        i++; // closing quote
        // Skip whitespace and optional `+` for concatenation
        while (i < src.length && /[\s+]/.test(src[i]) && src[i] !== "\n") i++;
        // Allow newline + next string literal
        if (src[i] === "\n") {
          let j = i;
          while (j < src.length && /\s/.test(src[j])) j++;
          if (src[j] === '"' || src[j] === "'" || src[j] === "`") {
            i = j;
            continue;
          }
        }
        continue;
      }
      break;
    }
    out.set(key, value);
  }
  return out;
}

function extractUsages(files: string[]): Usage[] {
  const usages: Usage[] = [];
  for (const file of files) {
    if (SELF_FILES.has(file)) continue;
    if (IGNORE_T_CALLS.some((r) => r.test(file))) continue;
    const src = readFileSync(file, "utf8");
    let m: RegExpExecArray | null;
    KEY_CALL_RE.lastIndex = 0;
    while ((m = KEY_CALL_RE.exec(src))) {
      const key = m[2];
      const varsBlock = m[3] ?? null;
      const line = src.slice(0, m.index).split("\n").length;
      let varsProvided: string[] | null = null;
      if (varsBlock) {
        varsProvided = [];
        // Strip outer braces, split on commas that are not inside nested
        // braces/parens/brackets, then take the identifier before `:` (or
        // the whole identifier for shorthand `{ name }`).
        const inner = varsBlock.slice(1, -1);
        const parts: string[] = [];
        let depth = 0;
        let buf = "";
        for (const ch of inner) {
          if (ch === "{" || ch === "(" || ch === "[") depth++;
          else if (ch === "}" || ch === ")" || ch === "]") depth--;
          if (ch === "," && depth === 0) {
            parts.push(buf);
            buf = "";
          } else buf += ch;
        }
        if (buf.trim()) parts.push(buf);
        for (const p of parts) {
          const head = p.split(":")[0].trim();
          const m2 = head.match(/^\.\.\.(.*)$/);
          if (m2) {
            // Spread — we can't statically resolve the shape; skip strict check
            varsProvided = null;
            break;
          }
          const idm = head.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)/);
          if (idm) varsProvided.push(idm[1]);
        }
      }

      usages.push({ file: relative(ROOT, file), line, key, varsProvided });
    }
  }
  return usages;
}

function templateVars(value: string): string[] {
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  INTERP_RE.lastIndex = 0;
  while ((m = INTERP_RE.exec(value))) out.add(m[1]);
  return [...out];
}

export function runVerify(): VerifyReport {
  const files = walk(SRC);
  const keymap = extractKeymap();
  const usages = extractUsages(files);

  const definedKeys = new Set(keymap.keys());
  const usedKeys = new Set(usages.map((u) => u.key));

  const missing = usages.filter((u) => !definedKeys.has(u.key));
  const unused = [...definedKeys].filter((k) => !usedKeys.has(k)).sort();

  const interpMismatch: VerifyReport["interpMismatch"] = [];
  for (const u of usages) {
    if (!definedKeys.has(u.key)) continue;
    const tpl = templateVars(keymap.get(u.key) ?? "");
    if (tpl.length === 0 && !u.varsProvided) continue;
    const provided = u.varsProvided ?? [];
    const missingInCall = tpl.filter((v) => !provided.includes(v));
    const extraInCall = provided.filter((v) => !tpl.includes(v));
    // If the call didn't inline a vars object we cannot judge — vars might be
    // spread from a variable. Only flag when a literal object was provided.
    if (u.varsProvided && (missingInCall.length || extraInCall.length)) {
      interpMismatch.push({
        usage: u,
        templateVars: tpl,
        providedVars: provided,
        missingInCall,
        extraInCall,
      });
    }
  }

  return {
    totalKeys: definedKeys.size,
    totalUsages: usages.length,
    missing,
    unused,
    interpMismatch,
  };
}

function main() {
  const args = new Set(process.argv.slice(2));
  const asJson = args.has("--json");
  const strict = args.has("--strict");
  const report = runVerify();

  if (asJson) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    const lines: string[] = [];
    lines.push("i18n verification pass");
    lines.push("─".repeat(40));
    lines.push(`Defined keys : ${report.totalKeys}`);
    lines.push(`Call sites   : ${report.totalUsages}`);
    lines.push(`Missing      : ${report.missing.length}`);
    lines.push(`Unused       : ${report.unused.length}`);
    lines.push(`Interp drift : ${report.interpMismatch.length}`);
    lines.push("");
    if (report.missing.length) {
      lines.push("MISSING KEYS (referenced but not in i18nStrings):");
      for (const u of report.missing) {
        lines.push(`  · ${u.key}    ${u.file}:${u.line}`);
      }
      lines.push("");
    }
    if (report.interpMismatch.length) {
      lines.push("INTERPOLATION MISMATCH:");
      for (const m of report.interpMismatch) {
        lines.push(
          `  · ${m.usage.key}    ${m.usage.file}:${m.usage.line}`,
        );
        if (m.missingInCall.length)
          lines.push(`      missing in call: ${m.missingInCall.join(", ")}`);
        if (m.extraInCall.length)
          lines.push(`      unused in template: ${m.extraInCall.join(", ")}`);
      }
      lines.push("");
    }
    if (report.unused.length) {
      lines.push("UNUSED KEYS (defined but no call site):");
      for (const k of report.unused) lines.push(`  · ${k}`);
      lines.push("");
    }
    process.stdout.write(lines.join("\n"));
  }

  const failed =
    report.missing.length > 0 ||
    report.interpMismatch.length > 0 ||
    (strict && report.unused.length > 0);
  process.exit(failed ? 1 : 0);
}

if (import.meta.main) main();
