import { describe, it, expect } from "vitest";
import { runVerify } from "../../../scripts/i18n-verify";

/**
 * Freshness contract for the i18n key map.
 *
 *   MISSING keys and INTERPOLATION MISMATCH are hard failures — they mean
 *   the app will render `undefined` at runtime or drop a variable on the
 *   floor. UNUSED keys are surfaced as a soft warning (not a failure) so
 *   they can be pruned in dedicated cleanup passes without blocking work.
 *
 * The full report also runs from the CLI: `bun run i18n:verify`.
 */
describe("i18n key verification", () => {
  const report = runVerify();

  it("has no missing translation keys", () => {
    const detail = report.missing
      .map((u) => `  · ${u.key}    ${u.file}:${u.line}`)
      .join("\n");
    expect(
      report.missing,
      `Referenced but not defined in src/lib/i18n/keys.ts:\n${detail}`,
    ).toHaveLength(0);
  });

  it("has no interpolation variable mismatches", () => {
    const detail = report.interpMismatch
      .map((m) => {
        const missing = m.missingInCall.length
          ? `missing in call: ${m.missingInCall.join(", ")}`
          : "";
        const extra = m.extraInCall.length
          ? `unused in template: ${m.extraInCall.join(", ")}`
          : "";
        return `  · ${m.usage.key}    ${m.usage.file}:${m.usage.line}   ${[missing, extra].filter(Boolean).join(" | ")}`;
      })
      .join("\n");
    expect(
      report.interpMismatch,
      `Interpolation drift between template {{tokens}} and t() vars:\n${detail}`,
    ).toHaveLength(0);
  });

  it("audited every translation key and call site", () => {
    expect(report.totalKeys).toBeGreaterThan(0);
    expect(report.totalUsages).toBeGreaterThan(0);
  });
});
