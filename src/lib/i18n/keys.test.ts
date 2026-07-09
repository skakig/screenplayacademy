import { describe, it, expect } from "vitest";
import { i18nStrings } from "./keys";

describe("i18n keys", () => {
  it("has no duplicate keys (object shape guarantees this)", () => {
    const keys = Object.keys(i18nStrings);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every key uses dot-namespaced form (namespace.name...)", () => {
    for (const k of Object.keys(i18nStrings)) {
      expect(k, `key "${k}" must include a dot namespace`).toMatch(/^[a-z][a-zA-Z0-9_]*\.[a-zA-Z0-9_.]+$/);
    }
  });

  it("every value is a non-empty string", () => {
    for (const [k, v] of Object.entries(i18nStrings)) {
      expect(typeof v, `key "${k}" must be a string`).toBe("string");
      expect((v as string).length, `key "${k}" must not be empty`).toBeGreaterThan(0);
    }
  });
});
