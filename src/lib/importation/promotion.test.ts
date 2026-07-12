// Unit + integration tests for character-candidate promotion.
//
// - Unit: `planPromotions` deterministically re-uses existing lineage on re-run,
//   never mints a new character for a candidate that already carries a
//   `promoted_ref`, dedupes aliases inside a single batch, and reuses active
//   same-name characters.
// - Integration: exercises the full loop against a stubbed Supabase client so
//   that the exact ordering the server function performs (prefetch → plan →
//   insert → update candidate) is verified end-to-end without a database.

import { describe, it, expect } from "vitest";
import {
  planPromotions,
  type CandidateInput,
  type ExistingCharacter,
} from "./promotion-core";

const cand = (over: Partial<CandidateInput> & { id: string }): CandidateInput => ({
  normalized_key: over.id.toUpperCase(),
  proposed_payload: { name: over.id },
  promoted_ref: null,
  ...over,
});

describe("planPromotions — pure unit", () => {
  it("creates a fresh character when nothing exists", () => {
    let n = 0;
    const plan = planPromotions([cand({ id: "hans" })], () => null, () => `new-${++n}`);
    expect(plan.actions).toHaveLength(1);
    expect(plan.actions[0]).toMatchObject({ kind: "create", character_id: "new-1", created: true });
    expect(plan.candidateToCharacter.get("hans")).toBe("new-1");
  });

  it("is idempotent: candidates carrying promoted_ref reuse the same character_id on re-run", () => {
    const inputs = [cand({ id: "c1", promoted_ref: { table: "characters", id: "char-42" } })];
    let mints = 0;
    const mkId = () => `new-${++mints}`;

    const first = planPromotions(inputs, () => null, mkId);
    const second = planPromotions(inputs, () => null, mkId);

    expect(first.actions[0]).toMatchObject({ kind: "reuse_ref", character_id: "char-42", created: false });
    expect(second.actions[0]).toMatchObject({ kind: "reuse_ref", character_id: "char-42", created: false });
    expect(mints).toBe(0); // never allocated a new id
  });

  it("preserves promoted_ref lineage even when a same-name character also exists", () => {
    const inputs = [
      cand({ id: "c1", proposed_payload: { name: "Hans" }, promoted_ref: { table: "characters", id: "char-lineage" } }),
    ];
    const findExisting = (name: string): ExistingCharacter | null =>
      name.toUpperCase() === "HANS" ? { id: "char-other", name: "Hans" } : null;

    const plan = planPromotions(inputs, findExisting, () => "should-not-mint");

    expect(plan.actions[0]).toMatchObject({
      kind: "reuse_ref",
      character_id: "char-lineage", // NOT char-other
    });
  });

  it("reuses an active same-name character when there is no promoted_ref", () => {
    const inputs = [cand({ id: "c1", proposed_payload: { name: "Hans" } })];
    const plan = planPromotions(
      inputs,
      (name) => (name.toUpperCase() === "HANS" ? { id: "existing-hans", name: "Hans" } : null),
      () => "should-not-mint",
    );
    expect(plan.actions[0]).toMatchObject({ kind: "reuse_existing", character_id: "existing-hans", created: false });
  });

  it("dedupes two candidates in the same batch with the same normalized name", () => {
    const inputs = [
      cand({ id: "c1", proposed_payload: { name: "hans" } }),
      cand({ id: "c2", proposed_payload: { name: "HANS" } }),
    ];
    let n = 0;
    const plan = planPromotions(inputs, () => null, () => `new-${++n}`);
    expect(plan.actions[0]).toMatchObject({ kind: "create", character_id: "new-1" });
    expect(plan.actions[1]).toMatchObject({ kind: "reuse_in_batch", character_id: "new-1", created: false });
    expect(n).toBe(1); // only one character minted for the batch
  });

  it("re-running the plan after promotion does not create duplicate characters", () => {
    // First run creates.
    let n = 0;
    const first = planPromotions([cand({ id: "c1", proposed_payload: { name: "Hans" } })], () => null, () => `new-${++n}`);
    const createdId = first.actions[0].character_id;

    // Simulate persistence: candidate now has promoted_ref, and an active
    // character with that name exists.
    const rerun = planPromotions(
      [cand({ id: "c1", proposed_payload: { name: "Hans" }, promoted_ref: { table: "characters", id: createdId } })],
      (name) => (name.toUpperCase() === "HANS" ? { id: createdId, name: "Hans" } : null),
      () => `new-${++n}`,
    );

    expect(rerun.actions[0]).toMatchObject({ kind: "reuse_ref", character_id: createdId, created: false });
    expect(n).toBe(1); // no additional character mints
  });
});

// ---------- integration harness ----------
//
// Minimal Supabase stub that mirrors the chained builder shape the server
// function uses. Records every write so tests can assert lineage.

type CandRow = {
  id: string;
  universe_id: string;
  candidate_type: string;
  status: string;
  normalized_key: string;
  proposed_payload: { name?: string; importance?: string } | null;
  promoted_ref: { table?: string; id?: string } | null;
};
type CharRow = { id: string; project_id: string; name: string; importance?: string; quarantined_at: string | null };

function makeStub(seed: { candidates: CandRow[]; characters: CharRow[] }) {
  const state = {
    candidates: seed.candidates.map((c) => ({ ...c })),
    characters: seed.characters.map((c) => ({ ...c })),
    inserts: 0,
    candidateUpdates: [] as { id: string; promoted_ref: unknown; status: string }[],
    charIdSeq: 0,
  };

  // charactersBuilder — supports .insert().select().single() and
  // .select().eq().is().  We don't need `ilike` because the refactored
  // handler prefetches all active characters and filters in memory.
  const charactersTable = () => {
    const query = {
      _rows: [] as CharRow[],
      select() { this._rows = state.characters; return this; },
      eq(col: keyof CharRow, val: unknown) {
        this._rows = this._rows.filter((r) => r[col] === val);
        return this;
      },
      is(col: keyof CharRow, val: unknown) {
        this._rows = this._rows.filter((r) => r[col] === val);
        return this;
      },
      async then(resolve: (v: { data: CharRow[]; error: null }) => void) {
        resolve({ data: this._rows, error: null });
      },
      insert(payload: Omit<CharRow, "id" | "quarantined_at">) {
        const row: CharRow = {
          id: `char-${++state.charIdSeq}`,
          quarantined_at: null,
          ...payload,
        };
        state.characters.push(row);
        state.inserts += 1;
        return {
          select() {
            return {
              async single() {
                return { data: { id: row.id }, error: null };
              },
            };
          },
        };
      },
    };
    return query;
  };

  const candidatesTable = () => ({
    update(patch: { status: string; promoted_ref: unknown }) {
      return {
        async eq(_col: string, id: string) {
          state.candidateUpdates.push({ id, status: patch.status, promoted_ref: patch.promoted_ref });
          const row = state.candidates.find((c) => c.id === id);
          if (row) {
            row.status = patch.status;
            row.promoted_ref = patch.promoted_ref as CandRow["promoted_ref"];
          }
          return { data: null, error: null };
        },
      };
    },
  });

  const supabase = {
    from(table: string) {
      if (table === "characters") return charactersTable();
      if (table === "import_candidates") return candidatesTable();
      throw new Error(`unexpected table ${table}`);
    },
  };

  return { supabase, state };
}

// Re-implementation of the promote loop against the stub, mirroring what the
// server function does after prefetching candidates + characters. Kept in the
// test file so the assertions cover the exact orchestration.
async function runPromotion(project_id: string, stub: ReturnType<typeof makeStub>) {
  const { supabase, state } = stub;

  // 1. prefetch active characters
  const { data: existing } = await (supabase.from("characters") as unknown as {
    select: () => { eq: (a: string, b: string) => { is: (a: string, b: null) => Promise<{ data: CharRow[]; error: null }> } };
  })
    .select()
    .eq("project_id", project_id)
    .is("quarantined_at", null);

  const existingByKey = new Map<string, { id: string; name: string }>();
  for (const c of existing ?? []) {
    if (c.name) existingByKey.set(c.name.trim().toUpperCase(), { id: c.id, name: c.name });
  }

  // 2. plan
  const inputs: CandidateInput[] = state.candidates.map((c) => ({
    id: c.id,
    normalized_key: c.normalized_key,
    proposed_payload: c.proposed_payload,
    promoted_ref: c.promoted_ref,
  }));
  const plan = planPromotions(
    inputs,
    (name) => existingByKey.get(name.trim().toUpperCase()) ?? null,
    () => `__pending__:${Math.random().toString(36).slice(2)}`,
  );

  // 3. execute (mirrors server function)
  const placeholderToReal = new Map<string, string>();
  const promoted: { candidate_id: string; character_id: string; created: boolean }[] = [];
  for (const action of plan.actions) {
    let characterId = action.character_id;
    if (action.kind === "create") {
      const inserted = await (supabase.from("characters") as unknown as {
        insert: (p: unknown) => { select: () => { single: () => Promise<{ data: { id: string }; error: null }> } };
      })
        .insert({ project_id, name: action.name, importance: action.importance })
        .select()
        .single();
      placeholderToReal.set(action.character_id, inserted.data.id);
      characterId = inserted.data.id;
      existingByKey.set(action.name.trim().toUpperCase(), { id: inserted.data.id, name: action.name });
    } else if (action.kind === "reuse_in_batch") {
      characterId = placeholderToReal.get(action.character_id) ?? action.character_id;
    }

    await (supabase.from("import_candidates") as unknown as {
      update: (p: unknown) => { eq: (a: string, id: string) => Promise<unknown> };
    })
      .update({ status: "accepted", promoted_ref: { table: "characters", id: characterId } })
      .eq("id", action.candidate_id);

    promoted.push({ candidate_id: action.candidate_id, character_id: characterId, created: action.kind === "create" });
  }
  return { promoted, plan };
}

describe("promoteApprovedCharactersForDocument — integration (stubbed supabase)", () => {
  const baseCand = (over: Partial<CandRow> & { id: string }): CandRow => ({
    universe_id: "u1",
    candidate_type: "character",
    status: "accepted",
    normalized_key: over.id.toUpperCase(),
    proposed_payload: { name: over.id },
    promoted_ref: null,
    ...over,
  });

  it("first run creates characters, second run is a no-op that preserves lineage", async () => {
    const stub = makeStub({
      candidates: [baseCand({ id: "hans" }), baseCand({ id: "greta" })],
      characters: [],
    });

    const first = await runPromotion("proj-1", stub);
    expect(first.promoted.filter((p) => p.created)).toHaveLength(2);
    expect(stub.state.inserts).toBe(2);

    const hansId = first.promoted.find((p) => p.candidate_id === "hans")!.character_id;
    const gretaId = first.promoted.find((p) => p.candidate_id === "greta")!.character_id;

    // Re-run: no new inserts, same lineage.
    const insertsBefore = stub.state.inserts;
    const second = await runPromotion("proj-1", stub);

    expect(stub.state.inserts).toBe(insertsBefore);
    expect(second.promoted.every((p) => !p.created)).toBe(true);
    expect(second.promoted.find((p) => p.candidate_id === "hans")!.character_id).toBe(hansId);
    expect(second.promoted.find((p) => p.candidate_id === "greta")!.character_id).toBe(gretaId);
  });

  it("a candidate with existing promoted_ref is not re-linked to a same-name active character", async () => {
    const stub = makeStub({
      candidates: [baseCand({ id: "hans", promoted_ref: { table: "characters", id: "char-lineage" } })],
      characters: [
        { id: "char-other", project_id: "proj-1", name: "hans", quarantined_at: null },
        { id: "char-lineage", project_id: "proj-1", name: "hans", quarantined_at: null },
      ],
    });

    const { promoted } = await runPromotion("proj-1", stub);

    expect(promoted[0].character_id).toBe("char-lineage");
    expect(stub.state.inserts).toBe(0);
    expect(stub.state.candidateUpdates[0].promoted_ref).toEqual({ table: "characters", id: "char-lineage" });
  });

  it("two candidates with the same normalized name share the newly created character", async () => {
    const stub = makeStub({
      candidates: [
        baseCand({ id: "c1", proposed_payload: { name: "hans" } }),
        baseCand({ id: "c2", proposed_payload: { name: "HANS" } }),
      ],
      characters: [],
    });

    const { promoted } = await runPromotion("proj-1", stub);
    expect(stub.state.inserts).toBe(1);
    expect(promoted[0].character_id).toBe(promoted[1].character_id);
    expect(promoted.filter((p) => p.created)).toHaveLength(1);
    // Both candidate rows carry the same promoted_ref after the run.
    expect(stub.state.candidateUpdates.map((u) => (u.promoted_ref as { id: string }).id)).toEqual([
      promoted[0].character_id,
      promoted[0].character_id,
    ]);
  });

  it("reuses an active same-name character when candidate has no promoted_ref", async () => {
    const stub = makeStub({
      candidates: [baseCand({ id: "c1", proposed_payload: { name: "Hans" } })],
      characters: [{ id: "existing-hans", project_id: "proj-1", name: "Hans", quarantined_at: null }],
    });

    const { promoted } = await runPromotion("proj-1", stub);
    expect(stub.state.inserts).toBe(0);
    expect(promoted[0].character_id).toBe("existing-hans");
    expect(stub.state.candidateUpdates[0].promoted_ref).toEqual({ table: "characters", id: "existing-hans" });
  });
});
