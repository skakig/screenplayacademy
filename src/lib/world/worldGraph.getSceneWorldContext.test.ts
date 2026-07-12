/**
 * Server-side test for `getSceneWorldContext`.
 *
 * Verifies the handler's data-shaping contract under a fake Supabase client
 * that emulates RLS: rows the current user is not allowed to see are dropped
 * from `.from(...).select(...)` reads, matching the behavior of the real
 * Postgres policies on `project_world_usage`, `world_entities`,
 * `world_entity_links`, and `world_entity_relationships`.
 *
 * The handler must:
 *   1. Only return usage rows tied to the requested (projectId, sceneId).
 *   2. Only build entity contexts from entities visible under RLS.
 *   3. Only surface relationship edges whose endpoint is a linked entity
 *      for the scene, dropping arbitrary cross-project edges.
 *   4. Return an empty result when no usage rows are visible.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// -------- Fake Supabase with RLS-style visibility filter -----------------

type Row = Record<string, any>;

const store = {
  project_world_usage: [] as Row[],
  world_entities: [] as Row[],
  world_entity_links: [] as Row[],
  world_entity_relationships: [] as Row[],
};

/**
 * Rows carry `_visible: false` when RLS would hide them from the current
 * user. The fake query builder respects that flag on every SELECT, so any
 * accidental leak in the handler surfaces as a test failure.
 */
class QB {
  private rows: Row[];
  private filters: Array<(r: Row) => boolean> = [];
  private orderCol: string | null = null;
  private orderAsc = true;
  constructor(table: keyof typeof store) {
    this.rows = store[table];
  }
  select(_cols?: string) {
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push((r) => r[col] === val);
    return this;
  }
  in(col: string, vals: unknown[]) {
    const set = new Set(vals);
    this.filters.push((r) => set.has(r[col]));
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderCol = col;
    this.orderAsc = opts?.ascending !== false;
    return this;
  }
  private run() {
    let out = this.rows.filter((r) => r._visible !== false);
    for (const f of this.filters) out = out.filter(f);
    if (this.orderCol) {
      const c = this.orderCol;
      const dir = this.orderAsc ? 1 : -1;
      out = [...out].sort((a, b) => (a[c] < b[c] ? -1 : a[c] > b[c] ? 1 : 0) * dir);
    }
    return { data: out, error: null as any };
  }
  then(resolve: (v: any) => void) {
    resolve(this.run());
  }
}

const fakeSupabase = {
  from: (t: keyof typeof store) => new QB(t),
};

// -------- Stub `createServerFn` + auth middleware -------------------------
// The real transform ships the handler over RPC; in a Node test we invoke
// it directly with `{ data, context }` and let the input validator run.

vi.mock("@tanstack/react-start", () => {
  const createServerFn = () => {
    const b: any = {
      _v: (x: any) => x,
      middleware: () => b,
      inputValidator: (v: any) => {
        b._v = v;
        return b;
      },
      handler: (h: any) => (args: any) =>
        h({ data: b._v(args?.data), context: { supabase: fakeSupabase } }),
    };
    return b;
  };
  return { createServerFn };
});

vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: {},
}));

// -------- Import under test (after mocks) ---------------------------------

import { getSceneWorldContext } from "@/lib/world/worldGraph.functions";

// -------- Fixtures --------------------------------------------------------

const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const PROJECT_B = "22222222-2222-4222-8222-222222222222";
const SCENE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SCENE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const E1 = "e1111111-1111-4111-8111-111111111111"; // linked to SCENE_A
const E2 = "e2222222-2222-4222-8222-222222222222"; // linked to SCENE_A
const E_OTHER = "e0000000-0000-4000-8000-000000000000"; // in same universe, edge target
const E_FOREIGN = "effffff0-ffff-4fff-8fff-ffffffffffff"; // hidden by RLS

function seed() {
  Object.keys(store).forEach((k) => ((store as any)[k].length = 0));

  // Usage rows: two for the requested scene, plus one for a different scene
  // in the same project and one from a foreign project (RLS-hidden).
  store.project_world_usage.push(
    { id: "u1", project_id: PROJECT_A, scene_id: SCENE_A, entity_id: E1, usage_kind: "setting", created_at: "2026-01-01" },
    { id: "u2", project_id: PROJECT_A, scene_id: SCENE_A, entity_id: E2, usage_kind: "reference", created_at: "2026-01-02" },
    { id: "u3", project_id: PROJECT_A, scene_id: SCENE_B, entity_id: E_OTHER, usage_kind: "setting", created_at: "2026-01-03" },
    { id: "u4", project_id: PROJECT_B, scene_id: SCENE_A, entity_id: E_FOREIGN, usage_kind: "setting", created_at: "2026-01-04", _visible: false },
  );

  store.world_entities.push(
    { id: E1, name: "Fort Aegis", entity_kind: "location" },
    { id: E2, name: "Marshal Rhen", entity_kind: "character" },
    { id: E_OTHER, name: "The Iron Pact", entity_kind: "faction" },
    { id: E_FOREIGN, name: "Hidden Bastion", entity_kind: "location", _visible: false },
  );

  store.world_entity_links.push({
    id: "l1",
    entity_id: E1,
    target_table: "world_locations",
    target_id: "loc-1",
  });

  store.world_entity_relationships.push(
    // Outgoing from a linked entity to another linked entity — should surface.
    { id: "r1", from_entity_id: E1, to_entity_id: E2, relationship_type: "allied_with" },
    // Outgoing from a linked entity to a visible non-linked entity — should
    // surface with `other` populated from the extra fetch.
    { id: "r2", from_entity_id: E2, to_entity_id: E_OTHER, relationship_type: "member_of" },
    // Incoming to a linked entity from a visible non-linked entity.
    { id: "r3", from_entity_id: E_OTHER, to_entity_id: E1, relationship_type: "controls" },
    // Edge with a foreign endpoint that RLS hides — the row itself is hidden.
    { id: "r4", from_entity_id: E1, to_entity_id: E_FOREIGN, relationship_type: "rivals", _visible: false },
    // Edge between two foreign entities — must never appear.
    { id: "r5", from_entity_id: E_FOREIGN, to_entity_id: E_FOREIGN, relationship_type: "same", _visible: false },
  );
}

describe("getSceneWorldContext (RLS contract)", () => {
  beforeEach(() => seed());

  it("returns only entities tied to the requested project + scene", async () => {
    const res = await getSceneWorldContext({
      data: { projectId: PROJECT_A, sceneId: SCENE_A },
    });

    expect(res.projectId).toBe(PROJECT_A);
    expect(res.sceneId).toBe(SCENE_A);
    const ids = res.entities.map((e) => e.entity.id).sort();
    expect(ids).toEqual([E1, E2].sort());
    // No leak from SCENE_B (same project, different scene).
    expect(ids).not.toContain(E_OTHER);
    // No leak from PROJECT_B (RLS-hidden).
    expect(ids).not.toContain(E_FOREIGN);
  });

  it("only surfaces relationship edges tied to the scene's linked entities", async () => {
    const res = await getSceneWorldContext({
      data: { projectId: PROJECT_A, sceneId: SCENE_A },
    });
    const byId = new Map(res.entities.map((e) => [e.entity.id, e]));

    const e1 = byId.get(E1)!;
    const e2 = byId.get(E2)!;

    // E1 outgoing: only r1 → E2. Foreign r4 is RLS-hidden.
    expect(e1.outgoing.map((r) => r.id)).toEqual(["r1"]);
    expect(e1.outgoing[0].other?.id).toBe(E2);

    // E1 incoming: r3 from E_OTHER; `other` populated from extra fetch.
    expect(e1.incoming.map((r) => r.id)).toEqual(["r3"]);
    expect(e1.incoming[0].other).toMatchObject({ id: E_OTHER, name: "The Iron Pact" });

    // E2 outgoing: r2 → E_OTHER.
    expect(e2.outgoing.map((r) => r.id)).toEqual(["r2"]);
    expect(e2.outgoing[0].other?.id).toBe(E_OTHER);

    // No hidden foreign IDs anywhere in the surfaced edges.
    const allOtherIds = res.entities.flatMap((e) => [
      ...e.outgoing.map((r) => r.other?.id),
      ...e.incoming.map((r) => r.other?.id),
    ]);
    expect(allOtherIds).not.toContain(E_FOREIGN);
  });

  it("attaches specialized-row links only for the linked entity that has one", async () => {
    const res = await getSceneWorldContext({
      data: { projectId: PROJECT_A, sceneId: SCENE_A },
    });
    const byId = new Map(res.entities.map((e) => [e.entity.id, e]));
    expect(byId.get(E1)!.link?.target_id).toBe("loc-1");
    expect(byId.get(E2)!.link).toBeNull();
  });

  it("returns an empty entity list when no usage rows are visible", async () => {
    const res = await getSceneWorldContext({
      data: { projectId: PROJECT_B, sceneId: SCENE_A }, // only RLS-hidden row exists
    });
    expect(res.entities).toEqual([]);
    expect(res.projectId).toBe(PROJECT_B);
    expect(res.sceneId).toBe(SCENE_A);
  });
});
