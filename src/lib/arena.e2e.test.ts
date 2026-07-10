/**
 * Arena Mode — end-to-end lifecycle test.
 *
 * Drives the full flow through the same public functions the UI uses:
 *   create session → host + writer join → start round → save + submit
 *   entries → timer expires → advance to voting → cast votes → award →
 *   finalize → promote winner into Suggestions.
 *
 * The Supabase client is replaced by an in-memory fake that models the
 * bits of behavior arena.ts + suggestions.ts actually invoke (filters,
 * insert/update/upsert/select, and the four arena RPCs). Canonical script
 * tables (`scenes`, `script_blocks`) are intentionally NOT part of the
 * fake — if the code under test ever tried to touch them the test would
 * fail with "unknown table", which is the guarantee we want.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------- In-memory Supabase fake --------------------------------------

type Row = Record<string, unknown>;
type Filter =
  | { kind: "eq"; col: string; val: unknown }
  | { kind: "neq"; col: string; val: unknown }
  | { kind: "contains"; col: string; val: Record<string, unknown> };

const HOST_ID = "user-host";
const WRITER_ID = "user-writer";
const VOTER_ID = "user-voter";
const PROJECT_ID = "project-1";

const state = vi.hoisted(() => ({
  currentUserId: "user-host",
  idSeq: 0,
}));

let currentUserId = HOST_ID;
let idSeq = 0;
const nextId = (prefix: string) => `${prefix}-${++idSeq}`;

const store: Record<string, Row[]> = {
  arena_sessions: [],
  arena_participants: [],
  arena_entries: [],
  arena_votes: [],
  arena_awards: [],
  suggestions: [],
};

const ALLOWED_TABLES = new Set(Object.keys(store));

function matches(row: Row, filters: Filter[]): boolean {
  return filters.every((f) => {
    if (f.kind === "eq") return row[f.col] === f.val;
    if (f.kind === "neq") return row[f.col] !== f.val;
    if (f.kind === "contains") {
      const target = row[f.col] as Record<string, unknown> | null | undefined;
      if (!target) return false;
      for (const [k, v] of Object.entries(f.val)) {
        if ((target as Record<string, unknown>)[k] !== v) return false;
      }
      return true;
    }
    return false;
  });
}

class QB {
  private table: string;
  private filters: Filter[] = [];
  private mode: "select" | "insert" | "update" | "upsert" | "delete" | null =
    null;
  private payload: Row | Row[] | null = null;
  private conflict: string | null = null;
  private singleMode: "one" | "maybe" | null = null;

  constructor(table: string) {
    if (!ALLOWED_TABLES.has(table)) {
      throw new Error(`Fake supabase: unknown table "${table}"`);
    }
    this.table = table;
  }

  select(_cols?: string) {
    if (this.mode === null) this.mode = "select";
    return this;
  }
  insert(v: Row | Row[]) {
    this.mode = "insert";
    this.payload = v;
    return this;
  }
  update(v: Row) {
    this.mode = "update";
    this.payload = v;
    return this;
  }
  upsert(v: Row | Row[], opts?: { onConflict?: string }) {
    this.mode = "upsert";
    this.payload = v;
    this.conflict = opts?.onConflict ?? null;
    return this;
  }
  delete() {
    this.mode = "delete";
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push({ kind: "eq", col, val });
    return this;
  }
  neq(col: string, val: unknown) {
    this.filters.push({ kind: "neq", col, val });
    return this;
  }
  contains(col: string, val: Record<string, unknown>) {
    this.filters.push({ kind: "contains", col, val });
    return this;
  }
  order(_col: string, _opts?: unknown) {
    return this;
  }
  limit(_n: number) {
    return this;
  }
  single() {
    this.singleMode = "one";
    return this.exec();
  }
  maybeSingle() {
    this.singleMode = "maybe";
    return this.exec();
  }
  then<T1, T2>(
    onFulfilled?: (v: { data: unknown; error: unknown }) => T1 | Promise<T1>,
    onRejected?: (r: unknown) => T2 | Promise<T2>,
  ) {
    return this.exec().then(onFulfilled, onRejected);
  }

  private stamp(row: Row): Row {
    const now = new Date().toISOString();
    return {
      id: nextId(this.table),
      created_at: now,
      updated_at: now,
      ...row,
    };
  }

  private async exec(): Promise<{ data: unknown; error: unknown }> {
    const rows = store[this.table];
    if (this.mode === "insert") {
      const list = Array.isArray(this.payload) ? this.payload : [this.payload!];
      const inserted = list.map((r) => this.stamp(r));
      rows.push(...inserted);
      return this.shape(inserted);
    }
    if (this.mode === "upsert") {
      const list = Array.isArray(this.payload) ? this.payload : [this.payload!];
      const keys = (this.conflict ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      const upserted: Row[] = [];
      for (const r of list) {
        const idx = keys.length
          ? rows.findIndex((existing) => keys.every((k) => existing[k] === r[k]))
          : -1;
        if (idx >= 0) {
          rows[idx] = { ...rows[idx], ...r, updated_at: new Date().toISOString() };
          upserted.push(rows[idx]);
        } else {
          const stamped = this.stamp(r);
          rows.push(stamped);
          upserted.push(stamped);
        }
      }
      return this.shape(upserted);
    }
    if (this.mode === "update") {
      const patch = this.payload as Row;
      const hits = rows.filter((r) => matches(r, this.filters));
      for (const h of hits) Object.assign(h, patch, { updated_at: new Date().toISOString() });
      return this.shape(hits);
    }
    if (this.mode === "delete") {
      const kept: Row[] = [];
      const removed: Row[] = [];
      for (const r of rows) (matches(r, this.filters) ? removed : kept).push(r);
      store[this.table] = kept;
      return this.shape(removed);
    }
    // select
    const hits = rows.filter((r) => matches(r, this.filters));
    return this.shape(hits);
  }

  private shape(hits: Row[]): { data: unknown; error: unknown } {
    if (this.singleMode === "one") {
      if (hits.length !== 1) return { data: null, error: new Error("expected single row") };
      return { data: hits[0], error: null };
    }
    if (this.singleMode === "maybe") {
      return { data: hits[0] ?? null, error: null };
    }
    return { data: hits, error: null };
  }
}

async function rpc(name: string, params: Record<string, unknown>) {
  const sessionId = params._session_id as string;
  const session = store.arena_sessions.find((s) => s.id === sessionId);
  if (!session) return { data: null, error: new Error("ARENA: session not found") };

  if (name === "start_arena_round") {
    Object.assign(session, {
      status: "running",
      starts_at: new Date().toISOString(),
      ends_at: new Date(Date.now() + (session.duration_seconds as number) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    });
    return { data: session, error: null };
  }
  if (name === "advance_arena_round_if_due") {
    if (
      session.status === "running" &&
      typeof session.ends_at === "string" &&
      new Date(session.ends_at).getTime() +
        ((session.submission_grace_seconds as number) ?? 0) * 1000 <=
        Date.now()
    ) {
      session.status = "voting";
      session.updated_at = new Date().toISOString();
    }
    return { data: session, error: null };
  }
  if (name === "end_arena_round") {
    session.status = "voting";
    session.updated_at = new Date().toISOString();
    return { data: session, error: null };
  }
  if (name === "finalize_arena_round") {
    session.status = "complete";
    session.updated_at = new Date().toISOString();
    // Compute winner (highest average sum-of-scores).
    const entries = store.arena_entries.filter(
      (e) => e.session_id === sessionId && e.status === "submitted",
    );
    const scored = entries.map((e) => {
      const votes = store.arena_votes.filter((v) => v.entry_id === e.id);
      if (!votes.length) return { entry: e, avg: 0 };
      const total = votes.reduce(
        (acc, v) =>
          acc +
          (v.score_originality as number) +
          (v.score_character_truth as number) +
          (v.score_cinematic_value as number) +
          (v.score_emotional_impact as number) +
          (v.score_craft as number),
        0,
      );
      return { entry: e, avg: total / votes.length };
    });
    scored.sort((a, b) => b.avg - a.avg);
    const winner = scored[0]?.entry;
    if (winner) {
      store.arena_awards.push({
        id: nextId("arena_awards"),
        session_id: sessionId,
        project_id: session.project_id,
        entry_id: winner.id,
        awarded_to: winner.author_id,
        award_type: "studio_winner",
        title: "Studio Winner",
        created_at: new Date().toISOString(),
      });
    }
    return { data: session, error: null };
  }
  return { data: null, error: new Error(`unknown rpc: ${name}`) };
}

const supabaseFake = {
  from: (table: string) => new QB(table),
  rpc,
  auth: {
    getUser: async () => ({ data: { user: { id: currentUserId } }, error: null }),
  },
};

vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseFake }));

// ---------- The test ----------------------------------------------------

import {
  awardArenaEntry,
  advanceArenaRoundIfDue,
  castArenaVote,
  createArenaSession,
  endArenaRound,
  finalizeArenaRound,
  joinArenaSession,
  listEntries,
  listSessionAwards,
  promoteEntryToSuggestion,
  saveEntryDraft,
  startArenaRound,
  submitEntry,
} from "@/lib/arena";

describe("Arena Mode — full lifecycle", () => {
  beforeEach(() => {
    idSeq = 0;
    for (const k of Object.keys(store)) store[k] = [];
    currentUserId = HOST_ID;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T12:00:00Z"));
  });

  it("creates, times out, votes, awards, and promotes the winner without touching script tables", async () => {
    // 1. Host creates a 60-second round and is auto-enrolled as a writer.
    const session = await createArenaSession({
      projectId: PROJECT_ID,
      title: "Dueling Villains",
      mode: "villain_monologue",
      prompt: "Two rivals meet in an elevator.",
      durationSeconds: 60,
    });
    expect(session.status).toBe("open");
    expect(store.arena_participants).toHaveLength(1);
    expect(store.arena_participants[0].user_id).toBe(HOST_ID);

    // 2. A second writer joins.
    currentUserId = WRITER_ID;
    await joinArenaSession(session, "writer");
    // 3. A judge joins.
    currentUserId = VOTER_ID;
    await joinArenaSession(session, "judge");
    expect(store.arena_participants).toHaveLength(3);

    // 4. Host starts the round.
    currentUserId = HOST_ID;
    const running = await startArenaRound(session.id);
    expect(running.status).toBe("running");
    expect(running.ends_at).toBeTruthy();

    // 5. Both writers save drafts and submit.
    const hostDraft = await saveEntryDraft(session, {
      title: "Elevator Pitch",
      body: "VILLAIN A steps in. The doors close on their smirk.",
    });
    currentUserId = WRITER_ID;
    const writerDraft = await saveEntryDraft(session, {
      title: "Rival's Reply",
      body: "VILLAIN B doesn't look up. 'You're late.'",
    });
    await submitEntry(writerDraft.id);
    currentUserId = HOST_ID;
    await submitEntry(hostDraft.id);

    // 6. The clock runs out — advance transitions to voting.
    vi.setSystemTime(new Date(Date.now() + 61_000));
    const advanced = await advanceArenaRoundIfDue(session.id);
    expect(advanced.status).toBe("voting");

    // 7. Host can also force end (idempotent from voting → voting).
    const ended = await endArenaRound(session.id);
    // end_arena_round in the fake sets voting regardless; still 'voting'.
    expect(ended.status).toBe("voting");

    // 8. All three participants read the entries and vote.
    const entries = await listEntries(session.id);
    expect(entries).toHaveLength(2);
    const [entryA, entryB] = entries;

    const scoresLow = {
      originality: 2,
      characterTruth: 2,
      cinematicValue: 2,
      emotionalImpact: 2,
      craft: 2,
    };
    const scoresHigh = {
      originality: 5,
      characterTruth: 5,
      cinematicValue: 5,
      emotionalImpact: 5,
      craft: 5,
    };

    for (const voter of [HOST_ID, WRITER_ID, VOTER_ID]) {
      currentUserId = voter;
      // Give writerDraft (entryB) the higher score consistently.
      const bIsWriter = entryB.author_id === WRITER_ID;
      await castArenaVote({
        session,
        entryId: entryA.id,
        scores: bIsWriter ? scoresLow : scoresHigh,
      });
      await castArenaVote({
        session,
        entryId: entryB.id,
        scores: bIsWriter ? scoresHigh : scoresLow,
      });
    }
    expect(store.arena_votes).toHaveLength(6);

    // 9. Host awards a peer prize, then finalizes the round.
    currentUserId = HOST_ID;
    const winnerEntry = entryB.author_id === WRITER_ID ? entryB : entryA;
    await awardArenaEntry({
      session,
      entry: winnerEntry as { id: string; author_id: string },
      awardType: "best_dialogue",
      title: "Best Dialogue",
    });
    const finalized = await finalizeArenaRound(session.id);
    expect(finalized.status).toBe("complete");

    // 10. Two awards exist: our peer award + the auto studio_winner.
    const awards = await listSessionAwards(session.id);
    expect(awards).toHaveLength(2);
    const types = awards.map((a) => a.award_type).sort();
    expect(types).toEqual(["best_dialogue", "studio_winner"]);
    const studio = awards.find((a) => a.award_type === "studio_winner")!;
    expect(studio.awarded_to).toBe(WRITER_ID);

    // 11. Promote the winning entry into Suggestions — never mutates script.
    const promoted = await promoteEntryToSuggestion({
      session: {
        id: session.id,
        project_id: session.project_id,
        title: session.title,
        mode: session.mode,
      },
      entry: {
        id: winnerEntry.id as string,
        author_id: winnerEntry.author_id as string,
        title: winnerEntry.title as string | null,
        body: winnerEntry.body as string,
      },
    });
    expect(promoted.alreadyExisted).toBe(false);
    expect(store.suggestions).toHaveLength(1);
    const suggestion = store.suggestions[0];
    expect(suggestion.project_id).toBe(PROJECT_ID);
    expect(suggestion.suggestion_type).toBe("structure_note");
    expect(suggestion.status).toBe("open");
    expect((suggestion.metadata as Record<string, unknown>).source).toBe("arena");
    expect((suggestion.metadata as Record<string, unknown>).arena_session_id).toBe(
      session.id,
    );
    expect((suggestion.metadata as Record<string, unknown>).arena_entry_id).toBe(
      winnerEntry.id,
    );

    // 12. Idempotency — promoting again returns the same suggestion.
    const again = await promoteEntryToSuggestion({
      session: {
        id: session.id,
        project_id: session.project_id,
        title: session.title,
        mode: session.mode,
      },
      entry: {
        id: winnerEntry.id as string,
        author_id: winnerEntry.author_id as string,
        title: winnerEntry.title as string | null,
        body: winnerEntry.body as string,
      },
    });
    expect(again.alreadyExisted).toBe(true);
    expect(again.id).toBe(suggestion.id as string);
    expect(store.suggestions).toHaveLength(1);
  });
});
