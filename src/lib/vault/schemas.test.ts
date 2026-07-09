import { test } from "node:test";
import assert from "node:assert/strict";
import { VaultSceneInput, VaultSceneUpdate, VAULT_KINDS, VAULT_STATUSES, VAULT_POSITIONS } from "./schemas";

test("VaultSceneInput requires projectId and applies defaults", () => {
  const parsed = VaultSceneInput.parse({ projectId: "11111111-1111-1111-1111-111111111111" });
  assert.equal(parsed.kind, "vault_scene");
  assert.equal(parsed.status, "vaulted");
  assert.equal(parsed.estimatedPosition, "unsure");
  assert.deepEqual(parsed.tags, []);
  assert.deepEqual(parsed.linkedCharacterIds, []);
});

test("VaultSceneInput rejects invalid kind/status/position", () => {
  const base = { projectId: "11111111-1111-1111-1111-111111111111" };
  assert.throws(() => VaultSceneInput.parse({ ...base, kind: "bogus" }));
  assert.throws(() => VaultSceneInput.parse({ ...base, status: "bogus" }));
  assert.throws(() => VaultSceneInput.parse({ ...base, estimatedPosition: "act_iv" }));
});

test("VaultSceneUpdate requires id and allows partial patches", () => {
  const parsed = VaultSceneUpdate.parse({
    id: "22222222-2222-2222-2222-222222222222",
    title: "New Title",
  });
  assert.equal(parsed.title, "New Title");
});

test("All catalogs are non-empty and unique", () => {
  for (const arr of [VAULT_KINDS, VAULT_STATUSES, VAULT_POSITIONS] as const) {
    assert.ok(arr.length > 0);
    assert.equal(new Set(arr).size, arr.length);
  }
});
