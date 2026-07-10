/**
 * Arena Mode — end-to-end lifecycle test.
 *
 * Drives the full flow through the same public functions the UI uses.
 * Uses an in-memory Supabase fake that models `.from()` reads plus the
 * hardened Arena RPCs (create/submit/award/promote/join/archive + the
 * original start/end/finalize/advance).
 *
 * Canonical script tables (`scenes`, `script_blocks`) are NOT in the
 * fake — if the code under test ever touched them the test would fail
 * with "unknown table", which is the guarantee we want.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const HOST_ID = "user-host";
const WRITER_ID = "user-writer";
const VOTER_ID = "user-voter";
const PROJECT_ID = "project-1";

const fake = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  type Filter =
    | { kind: "eq"; col: string; val: unknown }
    | { kind: "neq"; col: string; val: unknown }
    | { kind: "contains"; col: string; val: Record<string, unknown> };

  const state = { currentUserId: "user-host", idSeq: 0 };
  const store: Record<string, Row[]> = {
    arena_sessions: [],
    arena_participants: [],
    arena_entries: [],
    arena_votes: [],
    arena_awards: [],
    suggestions: [],
  };
  const ALLOWED = new Set(Object.keys(store));
  const nextId = (p: string) => `${p}-${++state.idSeq}`;
  const matches = (row: Row, filters: Filter[]) =>
    filters.every((f) => {
      if (f.kind === "eq") return row[f.col] === f.val;
      if (f.kind === "neq") return row[f.col] !== f.val;
      const t = row[f.col] as Record<string, unknown> | null | undefined;
      if (!t) return false;
      for (const [k, v] of Object.entries(f.val))
        if ((t as Record<string, unknown>)[k] !== v) return false;
      return true;
    });

  class QB {
    private table: string;
    private filters: Filter[] = [];
    private mode: "select" | "insert" | "update" | "upsert" | "delete" | null =
      null;
    private payload: Row | Row[] | null = null;
    private conflict: string | null = null;
    private singleMode: "one" | "maybe" | null = null;
    constructor(table: string) {
      if (!ALLOWED.has(table))
        throw new Error(`Fake supabase: unknown table "${table}"`);
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
    order(_c: string, _o?: unknown) {
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
      onF?: (v: { data: unknown; error: unknown }) => T1 | Promise<T1>,
      onR?: (r: unknown) => T2 | Promise<T2>,
    ) {
      return this.exec().then(onF, onR);
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
        const keys = (this.conflict ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        const out: Row[] = [];
        for (const r of list) {
          const idx = keys.length
            ? rows.findIndex((e) => keys.every((k) => e[k] === r[k]))
            : -1;
          if (idx >= 0) {
            rows[idx] = { ...rows[idx], ...r, updated_at: new Date().toISOString() };
            out.push(rows[idx]);
          } else {
            const stamped = this.stamp(r);
            rows.push(stamped);
            out.push(stamped);
          }
        }
        return this.shape(out);
      }
      if (this.mode === "update") {
        const patch = this.payload as Row;
        const hits = rows.filter((r) => matches(r, this.filters));
        for (const h of hits)
          Object.assign(h, patch, { updated_at: new Date().toISOString() });
        return this.shape(hits);
      }
      if (this.mode === "delete") {
        const kept: Row[] = [];
        const removed: Row[] = [];
        for (const r of rows) (matches(r, this.filters) ? removed : kept).push(r);
        store[this.table] = kept;
        return this.shape(removed);
      }
      const hits = rows.filter((r) => matches(r, this.filters));
      return this.shape(hits);
    }
    private shape(hits: Row[]): { data: unknown; error: unknown } {
      if (this.singleMode === "one")
        return hits.length === 1
          ? { data: hits[0], error: null }
          : { data: null, error: new Error("expected single row") };
      if (this.singleMode === "maybe") return { data: hits[0] ?? null, error: null };
      return { data: hits, error: null };
    }
  }

  async function rpc(name: string, params: Record<string, unknown>) {
    const uid = state.currentUserId;
    const sessionId = params._session_id as string | undefined;
    const session = sessionId
      ? store.arena_sessions.find((s) => s.id === sessionId)
      : undefined;
    const now = () => new Date().toISOString();

    if (name === "create_arena_session") {
      const active = store.arena_sessions.find(
        (s) =>
          s.project_id === params._project_id &&
          ["open", "running", "voting"].includes(s.status as string),
      );
      if (active)
        return {
          data: null,
          error: new Error(
            "duplicate key value violates unique constraint arena_sessions_one_active_per_project",
          ),
        };
      const row: Row = {
        id: nextId("arena_sessions"),
        project_id: params._project_id,
        created_by: uid,
        title: params._title,
        mode: params._mode,
        prompt: params._prompt,
        status: "open",
        duration_seconds: params._duration_seconds,
        starts_at: null,
        ends_at: null,
        rules: params._rules ?? {},
        judging_mode: params._judging_mode ?? "peer",
        entry_reveal: params._entry_reveal ?? "named",
        stakes: params._stakes ?? "practice",
        submission_grace_seconds: params._submission_grace_seconds ?? 10,
        created_at: now(),
        updated_at: now(),
      };
      store.arena_sessions.push(row);
      store.arena_participants.push({
        id: nextId("arena_participants"),
        session_id: row.id,
        project_id: row.project_id,
        user_id: uid,
        role: "writer",
        joined_at: now(),
      });
      return { data: row, error: null };
    }
    if (name === "join_arena_session") {
      if (!session)
        return { data: null, error: new Error("ARENA: session not found") };
      const existing = store.arena_participants.find(
        (p) => p.session_id === sessionId && p.user_id === uid,
      );
      if (existing) return { data: existing, error: null };
      const row: Row = {
        id: nextId("arena_participants"),
        session_id: sessionId!,
        project_id: session.project_id,
        user_id: uid,
        role: params._role ?? "writer",
        joined_at: now(),
      };
      store.arena_participants.push(row);
      return { data: row, error: null };
    }
    if (name === "submit_arena_entry") {
      const entry = store.arena_entries.find(
        (e) => e.id === params._entry_id,
      );
      if (!entry)
        return { data: null, error: new Error("ARENA: entry not found") };
      if (entry.author_id !== uid)
        return { data: null, error: new Error("ARENA: not your entry") };
      if (entry.status !== "draft")
        return {
          data: null,
          error: new Error(`ARENA: entry already ${entry.status}`),
        };
      entry.status = "submitted";
      entry.submitted_at = now();
      entry.updated_at = now();
      return { data: entry, error: null };
    }
    if (name === "award_arena_entry") {
      if (!session)
        return { data: null, error: new Error("ARENA: session not found") };
      if (session.created_by !== uid)
        return { data: null, error: new Error("ARENA: only host or owner") };
      const entry = store.arena_entries.find(
        (e) => e.id === params._entry_id,
      );
      if (!entry || entry.session_id !== sessionId)
        return {
          data: null,
          error: new Error("ARENA: entry does not belong to session"),
        };
      const existing = store.arena_awards.find(
        (a) =>
          a.session_id === sessionId &&
          a.entry_id === entry.id &&
          a.award_type === params._award_type,
      );
      if (existing) {
        if (params._title) existing.title = params._title;
        return { data: existing, error: null };
      }
      const row: Row = {
        id: nextId("arena_awards"),
        session_id: sessionId!,
        project_id: session.project_id,
        entry_id: entry.id,
        awarded_to: entry.author_id,
        award_type: params._award_type,
        title: params._title ?? null,
        created_at: now(),
      };
      store.arena_awards.push(row);
      return { data: row, error: null };
    }
    if (name === "promote_arena_entry") {
      if (!session)
        return { data: null, error: new Error("ARENA: session not found") };
      if (session.status !== "complete")
        return {
          data: null,
          error: new Error("ARENA: only complete rounds may be promoted"),
        };
      const entry = store.arena_entries.find(
        (e) => e.id === params._entry_id,
      );
      if (!entry || entry.session_id !== sessionId)
        return {
          data: null,
          error: new Error("ARENA: entry does not belong to session"),
        };
      const existing = store.suggestions.find(
        (s) =>
          (s.metadata as Row | null)?.source === "arena" &&
          (s.metadata as Row | null)?.arena_entry_id === entry.id,
      );
      if (existing) {
        return {
          data: [{ id: existing.id, already_existed: true }],
          error: null,
        };
      }
      const award = store.arena_awards.find(
        (a) => a.entry_id === entry.id && a.session_id === sessionId,
      );
      const row: Row = {
        id: nextId("suggestions"),
        project_id: session.project_id,
        author_id: uid,
        source: "human",
        suggestion_type: params._suggestion_type ?? "structure_note",
        status: "open",
        title: entry.title ?? `Arena · ${session.title}`,
        rationale: `Promoted from Arena round "${session.title}".`,
        after: { text: entry.body, arena_entry_title: entry.title },
        metadata: {
          source: "arena",
          arena_session_id: sessionId,
          arena_entry_id: entry.id,
          arena_award_type: award?.award_type ?? null,
          arena_original_author_id: entry.author_id,
        },
        created_at: now(),
        updated_at: now(),
      };
      store.suggestions.push(row);
      return {
        data: [{ id: row.id, already_existed: false }],
        error: null,
      };
    }
    if (name === "archive_arena_session") {
      if (!session)
        return { data: null, error: new Error("ARENA: session not found") };
      session.status = "archived";
      session.updated_at = now();
      return { data: session, error: null };
    }

    if (!session)
      return { data: null, error: new Error("ARENA: session not found") };
    if (name === "start_arena_round") {
      Object.assign(session, {
        status: "running",
        starts_at: now(),
        ends_at: new Date(
          Date.now() + (session.duration_seconds as number) * 1000,
        ).toISOString(),
        updated_at: now(),
      });
      return { data: session, error: null };
    }
    if (name === "advance_arena_round_if_due") {
      if (
        session.status === "running" &&
        typeof session.ends_at === "string" &&
        new Date(session.ends_at as string).getTime() +
          (((session.submission_grace_seconds as number) ?? 0) * 1000) <=
          Date.now()
      ) {
        session.status = "voting";
        session.updated_at = now();
      }
      return { data: session, error: null };
    }
    if (name === "end_arena_round") {
      session.status = "voting";
      session.updated_at = now();
      return { data: session, error: null };
    }
    if (name === "finalize_arena_round") {
      session.status = "complete";
      session.updated_at = now();
      const entries = store.arena_entries.filter(
        (e) => e.session_id === sessionId && e.status === "submitted",
      );
      const scored = entries.map((e) => {
        const votes = store.arena_votes.filter((v) => v.entry_id === e.id);
        if (!votes.length) return { entry: e, avg: 0 };
        const total = votes.reduce(
          (a, v) =>
            a +
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
        const dupe = store.arena_awards.find(
          (a) =>
            a.session_id === sessionId &&
            a.entry_id === winner.id &&
            a.award_type === "studio_winner",
        );
        if (!dupe) {
          store.arena_awards.push({
            id: nextId("arena_awards"),
            session_id: sessionId,
            project_id: session.project_id,
            entry_id: winner.id,
            awarded_to: winner.author_id,
            award_type: "studio_winner",
            title: "Studio Winner",
            created_at: now(),
          });
        }
      }
      return { data: session, error: null };
    }
    return { data: null, error: new Error(`unknown rpc: ${name}`) };
  }

  const supabase = {
    from: (t: string) => new QB(t),
    rpc,
    auth: {
      getUser: async () => ({
        data: { user: { id: state.currentUserId } },
        error: null,
      }),
    },
  };

  return { store, state, supabase };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: fake.supabase }));

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
    fake.state.idSeq = 0;
    fake.state.currentUserId = HOST_ID;
    for (const k of Object.keys(fake.store))
      (fake.store as Record<string, unknown[]>)[k] = [];
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T12:00:00Z"));
  });

  it("runs create → timer → vote → award → promote without touching script tables", async () => {
    // 1. Host creates a 60-second round and is auto-enrolled as a writer.
    const session = await createArenaSession({
      projectId: PROJECT_ID,
      title: "Dueling Villains",
      mode: "villain_monologue",
      prompt: "Two rivals meet in an elevator.",
      durationSeconds: 60,
    });
    expect(session.status).toBe("open");
    expect(fake.store.arena_participants).toHaveLength(1);
    expect(fake.store.arena_participants[0].user_id).toBe(HOST_ID);

    // 2. Second writer + judge join.
    fake.state.currentUserId = WRITER_ID;
    await joinArenaSession(session, "writer");
    fake.state.currentUserId = VOTER_ID;
    await joinArenaSession(session, "judge");
    expect(fake.store.arena_participants).toHaveLength(3);

    // 3. Host starts the round.
    fake.state.currentUserId = HOST_ID;
    const running = await startArenaRound(session.id);
    expect(running.status).toBe("running");
    expect(running.ends_at).toBeTruthy();

    // 4. Both writers save drafts and submit.
    const hostDraft = await saveEntryDraft(session, {
      title: "Elevator Pitch",
      body: "VILLAIN A steps in. The doors close on their smirk.",
    });
    fake.state.currentUserId = WRITER_ID;
    const writerDraft = await saveEntryDraft(session, {
      title: "Rival's Reply",
      body: "VILLAIN B doesn't look up. 'You're late.'",
    });
    await submitEntry(writerDraft.id);
    fake.state.currentUserId = HOST_ID;
    await submitEntry(hostDraft.id);

    // 5. Clock expires → advance transitions to voting.
    vi.setSystemTime(new Date(Date.now() + 75_000));
    const advanced = await advanceArenaRoundIfDue(session.id);
    expect(advanced.status).toBe("voting");

    // 6. Host force-ends (idempotent from voting in fake, matches RPC guard elsewhere).
    const ended = await endArenaRound(session.id);
    expect(ended.status).toBe("voting");

    // 7. All three participants read entries and vote.
    const entries = await listEntries(session.id);
    expect(entries).toHaveLength(2);
    const [entryA, entryB] = entries;
    const low = {
      originality: 2,
      characterTruth: 2,
      cinematicValue: 2,
      emotionalImpact: 2,
      craft: 2,
    };
    const high = {
      originality: 5,
      characterTruth: 5,
      cinematicValue: 5,
      emotionalImpact: 5,
      craft: 5,
    };
    for (const voter of [HOST_ID, WRITER_ID, VOTER_ID]) {
      fake.state.currentUserId = voter;
      const bIsWriter = entryB.author_id === WRITER_ID;
      await castArenaVote({
        session,
        entryId: entryA.id,
        scores: bIsWriter ? low : high,
      });
      await castArenaVote({
        session,
        entryId: entryB.id,
        scores: bIsWriter ? high : low,
      });
    }
    expect(fake.store.arena_votes).toHaveLength(6);

    // 8. Host awards a peer prize, then finalizes.
    fake.state.currentUserId = HOST_ID;
    const winnerEntry = entryB.author_id === WRITER_ID ? entryB : entryA;
    await awardArenaEntry({
      session,
      entry: { id: winnerEntry.id },
      awardType: "best_dialogue",
      title: "Best Dialogue",
    });
    const finalized = await finalizeArenaRound(session.id);
    expect(finalized.status).toBe("complete");

    // 9. Peer award + auto studio_winner both exist and point at the writer.
    const awards = await listSessionAwards(session.id);
    expect(awards).toHaveLength(2);
    const types = awards.map((a) => a.award_type).sort();
    expect(types).toEqual(["best_dialogue", "studio_winner"]);
    const studio = awards.find((a) => a.award_type === "studio_winner")!;
    expect(studio.awarded_to).toBe(WRITER_ID);

    // 10. Promote the winner into Suggestions — never mutates script.
    const promoted = await promoteEntryToSuggestion({
      session: { id: session.id },
      entry: { id: winnerEntry.id },
    });
    expect(promoted.alreadyExisted).toBe(false);
    expect(fake.store.suggestions).toHaveLength(1);
    const sug = fake.store.suggestions[0] as Record<string, unknown>;
    expect(sug.project_id).toBe(PROJECT_ID);
    expect(sug.suggestion_type).toBe("structure_note");
    expect(sug.status).toBe("open");
    const meta = sug.metadata as Record<string, unknown>;
    expect(meta.source).toBe("arena");
    expect(meta.arena_session_id).toBe(session.id);
    expect(meta.arena_entry_id).toBe(winnerEntry.id);

    // 11. Idempotency — promoting again returns the same suggestion.
    const again = await promoteEntryToSuggestion({
      session: { id: session.id },
      entry: { id: winnerEntry.id },
    });
    expect(again.alreadyExisted).toBe(true);
    expect(again.id).toBe(sug.id as string);
    expect(fake.store.suggestions).toHaveLength(1);
  });

  it("blocks a second active session per project (unique index)", async () => {
    await createArenaSession({
      projectId: PROJECT_ID,
      title: "Round 1",
      mode: "freewrite",
      prompt: "warmup",
      durationSeconds: 60,
    });
    await expect(
      createArenaSession({
        projectId: PROJECT_ID,
        title: "Round 2",
        mode: "freewrite",
        prompt: "second",
        durationSeconds: 60,
      }),
    ).rejects.toThrow(/already has an active Arena round/i);
  });
});
