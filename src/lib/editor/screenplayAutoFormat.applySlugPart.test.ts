import { describe, it, expect } from "vitest";
import {
  applySlugPart,
  isSceneHeadingComplete,
} from "@/components/editor/screenplayAutoFormat";

describe("applySlugPart — prefix", () => {
  it("prepends a prefix to an empty line", () => {
    expect(applySlugPart("", "EXT.", "prefix")).toMatch(/^EXT\.\s*$/);
  });

  it("prepends a prefix while preserving existing body", () => {
    expect(applySlugPart("garage - night", "INT.", "prefix")).toBe(
      "INT. GARAGE - NIGHT",
    );
  });

  it("swaps INT. to EXT. without stacking", () => {
    expect(applySlugPart("INT. GARAGE - NIGHT", "EXT.", "prefix")).toBe(
      "EXT. GARAGE - NIGHT",
    );
  });

  it("is idempotent — tapping the same prefix twice does not stack", () => {
    const once = applySlugPart("GARAGE - NIGHT", "EXT.", "prefix");
    const twice = applySlugPart(once, "EXT.", "prefix");
    expect(twice).toBe(once);
  });

  it("swaps INT. → INT./EXT. cleanly", () => {
    expect(applySlugPart("INT. GARAGE - NIGHT", "INT./EXT.", "prefix")).toBe(
      "INT./EXT. GARAGE - NIGHT",
    );
  });
});

describe("applySlugPart — time", () => {
  it("appends a time when none present", () => {
    expect(applySlugPart("EXT. LIBYAN PLATEAU", "DAY", "time")).toBe(
      "EXT. LIBYAN PLATEAU - DAY",
    );
  });

  it("swaps NIGHT → DAY without stacking", () => {
    expect(applySlugPart("EXT. GARAGE - NIGHT", "DAY", "time")).toBe(
      "EXT. GARAGE - DAY",
    );
  });

  it("preserves the location body", () => {
    const out = applySlugPart("EXT. LIBYAN PLATEAU - NIGHT", "DAY", "time");
    expect(out).toContain("LIBYAN PLATEAU");
    expect(out).toContain("DAY");
    expect(out).not.toContain("NIGHT");
  });

  it("is idempotent for time", () => {
    const once = applySlugPart("EXT. GARAGE", "DAY", "time");
    const twice = applySlugPart(once, "DAY", "time");
    expect(twice).toBe(once);
  });
});

describe("isSceneHeadingComplete", () => {
  it("returns false for empty", () => {
    expect(isSceneHeadingComplete("")).toBe(false);
  });
  it("returns false without prefix", () => {
    expect(isSceneHeadingComplete("GARAGE - DAY")).toBe(false);
  });
  it("returns false without time", () => {
    expect(isSceneHeadingComplete("EXT. GARAGE")).toBe(false);
  });
  it("returns false without location body", () => {
    expect(isSceneHeadingComplete("EXT. - DAY")).toBe(false);
  });
  it("returns true when prefix + location + time all present", () => {
    expect(isSceneHeadingComplete("EXT. LIBYAN PLATEAU - DAY")).toBe(true);
  });
});
