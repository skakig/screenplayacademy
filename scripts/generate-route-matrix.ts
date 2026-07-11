/**
 * Regenerates the machine-derived route matrix from the Studio Menu manifest.
 *
 *   bun run route-matrix          → writes docs/ROUTE_MATRIX.generated.md
 *                                    and  docs/route-matrix.generated.json
 *   bun run route-matrix:check    → exits non-zero if the committed files drift
 *
 * The hand-written narrative in docs/ROUTE_MATRIX.md is intentionally left
 * alone; this script owns only the `*.generated.*` companions.
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { MENU_MANIFEST } from "../src/components/studioMenuManifest";
import { buildRouteMatrix, renderMatrixMarkdown, summarize } from "../src/components/studioMenuMatrix";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const MD_PATH = resolve(ROOT, "docs/ROUTE_MATRIX.generated.md");
const JSON_PATH = resolve(ROOT, "docs/route-matrix.generated.json");

function serialize() {
  const md = renderMatrixMarkdown(MENU_MANIFEST) + "\n";
  const json =
    JSON.stringify(
      {
        generatedFrom: "src/components/studioMenuManifest.ts",
        summary: summarize(MENU_MANIFEST),
        entries: buildRouteMatrix(MENU_MANIFEST),
      },
      null,
      2,
    ) + "\n";
  return { md, json };
}

function ensureDir(path: string) {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function main() {
  const mode = process.argv.includes("--check") ? "check" : "write";
  const { md, json } = serialize();

  if (mode === "check") {
    const missing = !existsSync(MD_PATH) || !existsSync(JSON_PATH);
    if (missing) {
      console.error("Route matrix files missing. Run: bun run route-matrix");
      process.exit(1);
    }
    const currentMd = readFileSync(MD_PATH, "utf8");
    const currentJson = readFileSync(JSON_PATH, "utf8");
    if (currentMd !== md || currentJson !== json) {
      console.error(
        "Route matrix is stale. Studio Menu changed but docs/route-matrix.* were not regenerated.\n" +
          "Run: bun run route-matrix",
      );
      process.exit(1);
    }
    console.log("Route matrix is up to date.");
    return;
  }

  ensureDir(MD_PATH);
  writeFileSync(MD_PATH, md);
  writeFileSync(JSON_PATH, json);
  console.log(`Wrote ${MD_PATH}`);
  console.log(`Wrote ${JSON_PATH}`);
}

main();
