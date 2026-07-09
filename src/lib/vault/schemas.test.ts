import { describe, it, expect } from "vitest";
import {
  VaultSceneInput,
  VaultSceneUpdate,
  VAULT_KINDS,
  VAULT_STATUSES,
  VAULT_POSITIONS,
} from "./schemas";

describe("vault schemas", () => {
  it("VaultSceneInput requires projectId and applies defaults", () => {
    const parsed = VaultSceneInput.parse({ projectId: "11111111-1111-1111-1111-111111111111" });
    expect(parsed.kind).toBe("vault_scene");
    expect(parsed.status).toBe("vaulted");
    expect(parsed.estimatedPosition).toBe("unsure");
    expect(parsed.tags).toEqual([]);
    expect(parsed.linkedCharacterIds).toEqual([]);
  });

  it("rejects invalid kind/status/position", () => {
    const base = { projectId: "11111111-1111-1111-1111-111111111111" };
    expect(() => VaultSceneInput.parse({ ...base, kind: "bogus" })).toThrow();
    expect(() => VaultSceneInput.parse({ ...base, status: "bogus" })).toThrow();
    expect(() => VaultSceneInput.parse({ ...base, estimatedPosition: "act_iv" })).toThrow();
  });

  it("VaultSceneUpdate requires id and allows partial patches", () => {
    const parsed = VaultSceneUpdate.parse({
      id: "22222222-2222-2222-2222-222222222222",
      title: "New Title",
    });
    expect(parsed.title).toBe("New Title");
  });

  it("catalogs are non-empty and unique", () => {
    for (const arr of [VAULT_KINDS, VAULT_STATUSES, VAULT_POSITIONS] as const) {
      expect(arr.length).toBeGreaterThan(0);
      expect(new Set(arr).size).toBe(arr.length);
    }
  });
});
