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
    if (name === "get_arena_voting_entries") {
      if (!session)
        return { data: null, error: new Error("ARENA: session not found") };
      const entries = store.arena_entries.filter(
        (e) => e.session_id === sessionId && e.status === "submitted",
      );
      const blind =
        session.entry_reveal === "blind_until_results" && session.status !== "complete";
      const rows = entries.map((e, i) => ({
        entry_id: e.id,
        session_id: sessionId,
        anonymous_label: `Writer #${i + 1}`,
        title: e.title,
        body: e.body,
        status: e.status,
        author_id: blind ? null : e.author_id,
        submitted_at: e.submitted_at ?? null,
      }));
      return { data: rows, error: null };
    }
    if (name === "get_project_member_identities") {
      const ids = (params._user_ids as string[]) ?? [];
      const directory: Record<string, { name: string; avatar: string | null }> =
        {
          [HOST_ID]: { name: "Ava Host", avatar: "https://x/ava.png" },
          [WRITER_ID]: { name: "Bram Writer", avatar: null },
          [VOTER_ID]: { name: "Cid Voter", avatar: null },
        };
      const rows = ids
        .filter((id) => directory[id])
        .map((id) => ({
          user_id: id,
          display_name: directory[id].name,
          avatar_url: directory[id].avatar,
        }));
      return { data: rows, error: null };
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
  getProjectMemberIdentities,
  joinArenaSession,
  listArenaSessions,
  listEntries,
  listMyVotes,
  listParticipants,
  listVotes,
  getMyEntry,

  listSessionAwards,
  listVotingEntries,
  promoteEntryToSuggestion,
  saveEntryDraft,
  startArenaRound,
  submitEntry,
} from "@/lib/arena";
import {
  NEUTRAL_AUTHORSHIP_COLOR,
  buildAuthorshipPalette,
  initialsFor,
} from "@/components/writers-room/arena/authorshipPalette";


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

  it("keeps the authorship rail muted while blind, then reveals correct initials and identity at results time", async () => {
    // Host creates a BLIND round so voting must redact identity.
    const session = await createArenaSession({
      projectId: PROJECT_ID,
      title: "Masked Monologues",
      mode: "villain_monologue",
      prompt: "Speak without a face.",
      durationSeconds: 60,
      entryReveal: "blind_until_results",
    });
    fake.state.currentUserId = WRITER_ID;
    await joinArenaSession(session, "writer");
    fake.state.currentUserId = VOTER_ID;
    await joinArenaSession(session, "judge");

    fake.state.currentUserId = HOST_ID;
    await startArenaRound(session.id);

    const hostDraft = await saveEntryDraft(session, {
      title: "Host Piece",
      body: "A whisper in the dark.",
    });
    await submitEntry(hostDraft.id);
    fake.state.currentUserId = WRITER_ID;
    const writerDraft = await saveEntryDraft(session, {
      title: "Writer Piece",
      body: "A shout in the light.",
    });
    await submitEntry(writerDraft.id);

    // --- Voting phase: rail must be neutral / identity hidden ---
    vi.setSystemTime(new Date(Date.now() + 75_000));
    await advanceArenaRoundIfDue(session.id);

    fake.state.currentUserId = VOTER_ID;
    const blindEntries = await listVotingEntries(session.id);
    expect(blindEntries).toHaveLength(2);
    for (const row of blindEntries) {
      // Server-side redaction: no author leaks into the voting feed.
      expect(row.author_id).toBeNull();
      expect(row.anonymous_label).toMatch(/^Writer #\d+$/);
    }

    // Palette built from redacted rows collapses everyone to the neutral slot,
    // so no writer-specific hue can bleed through during voting.
    const blindPalette = buildAuthorshipPalette(
      session.id,
      blindEntries.map((e) => e.author_id ?? ""),
    );
    // Empty ids skipped → no per-writer colors assigned while blind.
    expect(blindPalette.size).toBe(0);

    // Rank + finalize so results unlock.
    const high = {
      originality: 5,
      characterTruth: 5,
      cinematicValue: 5,
      emotionalImpact: 5,
      craft: 5,
    };
    const low = { ...high, originality: 2, characterTruth: 2, cinematicValue: 2, emotionalImpact: 2, craft: 2 };
    // Use the plaintext entries feed to get real ids for voting bookkeeping.
    fake.state.currentUserId = HOST_ID;
    const plain = await listEntries(session.id);
    const writerEntry = plain.find((e) => e.author_id === WRITER_ID)!;
    const hostEntry = plain.find((e) => e.author_id === HOST_ID)!;
    for (const voter of [HOST_ID, WRITER_ID, VOTER_ID]) {
      fake.state.currentUserId = voter;
      await castArenaVote({ session, entryId: writerEntry.id, scores: high });
      await castArenaVote({ session, entryId: hostEntry.id, scores: low });
    }
    fake.state.currentUserId = HOST_ID;
    const finalized = await finalizeArenaRound(session.id);
    expect(finalized.status).toBe("complete");

    // --- Results phase: identities resolve, palette assigns distinct slots ---
    const authorIds = plain.map((e) => e.author_id);
    const identities = await getProjectMemberIdentities(PROJECT_ID, authorIds);
    expect(identities.get(HOST_ID)?.display_name).toBe("Ava Host");
    expect(identities.get(WRITER_ID)?.display_name).toBe("Bram Writer");
    expect(initialsFor(identities.get(HOST_ID)!.display_name)).toBe("AH");
    expect(initialsFor(identities.get(WRITER_ID)!.display_name)).toBe("BW");

    const namedPalette = buildAuthorshipPalette(session.id, authorIds);
    const hostColor = namedPalette.get(HOST_ID)!;
    const writerColor = namedPalette.get(WRITER_ID)!;
    expect(hostColor).toBeTruthy();
    expect(writerColor).toBeTruthy();
    // Distinct writers get distinct rail hues — no color collision.
    expect(hostColor.rail).not.toBe(writerColor.rail);
    // And neither hue is the neutral slot (that's blind-only).
    expect(hostColor.rail).not.toBe(NEUTRAL_AUTHORSHIP_COLOR.rail);
    expect(writerColor.rail).not.toBe(NEUTRAL_AUTHORSHIP_COLOR.rail);

    // Determinism: rebuilding the palette yields the same slots.
    const rebuilt = buildAuthorshipPalette(session.id, authorIds);
    expect(rebuilt.get(HOST_ID)!.rail).toBe(hostColor.rail);
    expect(rebuilt.get(WRITER_ID)!.rail).toBe(writerColor.rail);
  });

  it("redacts author identity across every Arena UI data path until the round is finalized", async () => {
    // Blind round — identity must stay redacted from every read path the UI
    // consumes (voting entries feed, awards feed, palette derivation) until
    // finalize flips the session to 'complete'.
    const session = await createArenaSession({
      projectId: PROJECT_ID,
      title: "Full-path Redaction",
      mode: "villain_monologue",
      prompt: "Stay masked.",
      durationSeconds: 60,
      entryReveal: "blind_until_results",
    });
    fake.state.currentUserId = WRITER_ID;
    await joinArenaSession(session, "writer");
    fake.state.currentUserId = VOTER_ID;
    await joinArenaSession(session, "judge");

    // Helper: assert every UI-facing feed for this session hides identity.
    const assertRedactedFor = async (label: string) => {
      fake.state.currentUserId = VOTER_ID;
      const voting = await listVotingEntries(session.id);
      for (const row of voting) {
        expect(
          row.author_id,
          `${label}: listVotingEntries leaked author_id`,
        ).toBeNull();
        expect(row.anonymous_label).toMatch(/^Writer #\d+$/);
      }
      // Awards feed powers ResultsPanel medals — must not surface an
      // awarded_to before finalization, or the UI could map ids to names.
      const awards = await listSessionAwards(session.id);
      expect(awards, `${label}: awards feed leaked before finalize`).toEqual(
        [],
      );
      // Palette built from whatever author_ids the UI can see collapses to
      // the neutral slot — no writer-specific hue can bleed through.
      const palette = buildAuthorshipPalette(
        session.id,
        voting.map((e) => e.author_id ?? ""),
      );
      expect(palette.size, `${label}: palette leaked distinct hues`).toBe(0);
    };

    // Stage A: OPEN — no submissions yet, feeds must be empty and redacted.
    await assertRedactedFor("open");

    // Stage B: RUNNING — submitted entries visible but authorless.
    fake.state.currentUserId = HOST_ID;
    await startArenaRound(session.id);
    const hostDraft = await saveEntryDraft(session, {
      title: "Host Piece",
      body: "A whisper in the dark.",
    });
    await submitEntry(hostDraft.id);
    fake.state.currentUserId = WRITER_ID;
    const writerDraft = await saveEntryDraft(session, {
      title: "Writer Piece",
      body: "A shout in the light.",
    });
    await submitEntry(writerDraft.id);
    await assertRedactedFor("running");

    // Stage C: VOTING — clock expired, votes cast, peer award granted,
    // identity must still be hidden until finalize.
    vi.setSystemTime(new Date(Date.now() + 75_000));
    await advanceArenaRoundIfDue(session.id);
    const high = {
      originality: 5,
      characterTruth: 5,
      cinematicValue: 5,
      emotionalImpact: 5,
      craft: 5,
    };
    for (const voter of [HOST_ID, WRITER_ID, VOTER_ID]) {
      fake.state.currentUserId = voter;
      await castArenaVote({ session, entryId: writerDraft.id, scores: high });
      await castArenaVote({ session, entryId: hostDraft.id, scores: high });
    }
    fake.state.currentUserId = HOST_ID;
    await awardArenaEntry({
      session,
      entry: { id: writerDraft.id },
      awardType: "best_dialogue",
      title: "Best Dialogue",
    });
    // Peer award now exists — but the voting feed must still redact
    // author_id and the palette must still collapse.
    fake.state.currentUserId = VOTER_ID;
    const votingDuring = await listVotingEntries(session.id);
    expect(votingDuring).toHaveLength(2);
    for (const row of votingDuring) expect(row.author_id).toBeNull();
    const paletteDuring = buildAuthorshipPalette(
      session.id,
      votingDuring.map((e) => e.author_id ?? ""),
    );
    expect(paletteDuring.size).toBe(0);

    // Stage D: FINALIZED — identity is allowed to resolve everywhere.
    fake.state.currentUserId = HOST_ID;
    const finalized = await finalizeArenaRound(session.id);
    expect(finalized.status).toBe("complete");

    fake.state.currentUserId = VOTER_ID;
    const revealed = await listVotingEntries(session.id);
    expect(revealed).toHaveLength(2);
    const revealedAuthors = revealed.map((e) => e.author_id).sort();
    expect(revealedAuthors).toEqual([HOST_ID, WRITER_ID].sort());

    const awardsAfter = await listSessionAwards(session.id);
    expect(awardsAfter.length).toBeGreaterThan(0);
    const awardedTo = new Set(awardsAfter.map((a) => a.awarded_to));
    expect(awardedTo.has(WRITER_ID) || awardedTo.has(HOST_ID)).toBe(true);

    const revealedPalette = buildAuthorshipPalette(
      session.id,
      revealed.map((e) => e.author_id ?? ""),
    );
    expect(revealedPalette.size).toBe(2);
    expect(revealedPalette.get(HOST_ID)!.rail).not.toBe(
      revealedPalette.get(WRITER_ID)!.rail,
    );
  });

  it("keeps each writer's rail color deterministic across votes, entries, and awards regardless of ordering", async () => {
    // Third writer so we get a real ordering permutation.
    const THIRD_ID = "user-third";
    const session = await createArenaSession({
      projectId: PROJECT_ID,
      title: "Deterministic Rails",
      mode: "villain_monologue",
      prompt: "One color per writer.",
      durationSeconds: 60,
      entryReveal: "blind_until_results",
    });
    for (const uid of [WRITER_ID, VOTER_ID, THIRD_ID]) {
      fake.state.currentUserId = uid;
      await joinArenaSession(session, "writer");
    }

    fake.state.currentUserId = HOST_ID;
    await startArenaRound(session.id);

    // Submit in order: HOST → WRITER → THIRD.
    const drafts: Record<string, string> = {};
    for (const uid of [HOST_ID, WRITER_ID, THIRD_ID]) {
      fake.state.currentUserId = uid;
      const d = await saveEntryDraft(session, {
        title: `${uid} piece`,
        body: `Body from ${uid}.`,
      });
      drafts[uid] = d.id;
      await submitEntry(d.id);
    }

    // Voting phase — palette derived from redacted feed collapses (no ids).
    vi.setSystemTime(new Date(Date.now() + 75_000));
    await advanceArenaRoundIfDue(session.id);
    fake.state.currentUserId = VOTER_ID;
    const blind = await listVotingEntries(session.id);
    expect(blind).toHaveLength(3);
    const blindPalette = buildAuthorshipPalette(
      session.id,
      blind.map((e) => e.author_id ?? ""),
    );
    expect(blindPalette.size).toBe(0);

    // Everyone votes so awards can resolve, then host awards + finalizes.
    const scores = {
      originality: 4,
      characterTruth: 4,
      cinematicValue: 4,
      emotionalImpact: 4,
      craft: 4,
    };
    for (const voter of [HOST_ID, WRITER_ID, VOTER_ID, THIRD_ID]) {
      fake.state.currentUserId = voter;
      for (const uid of [HOST_ID, WRITER_ID, THIRD_ID]) {
        await castArenaVote({ session, entryId: drafts[uid], scores });
      }
    }
    fake.state.currentUserId = HOST_ID;
    await awardArenaEntry({
      session,
      entry: { id: drafts[WRITER_ID] },
      awardType: "best_dialogue",
    });
    await finalizeArenaRound(session.id);

    // The canonical per-writer color: build once from the natural submission
    // order the entries feed returns.
    const revealedEntries = await listEntries(session.id);
    const canonical = buildAuthorshipPalette(
      session.id,
      revealedEntries.map((e) => e.author_id),
    );
    expect(canonical.size).toBe(3);
    // Distinct hues per writer — asserts no hidden collision that would
    // make the ordering test vacuously pass.
    const rails = [HOST_ID, WRITER_ID, THIRD_ID].map(
      (u) => canonical.get(u)!.rail,
    );
    expect(new Set(rails).size).toBe(3);
    for (const rail of rails) {
      expect(rail).not.toBe(NEUTRAL_AUTHORSHIP_COLOR.rail);
    }

    const expectMatchesCanonical = (
      label: string,
      palette: ReturnType<typeof buildAuthorshipPalette>,
    ) => {
      for (const uid of [HOST_ID, WRITER_ID, THIRD_ID]) {
        const got = palette.get(uid);
        expect(got, `${label}: missing color for ${uid}`).toBeTruthy();
        expect(got!.rail, `${label}: rail drifted for ${uid}`).toBe(
          canonical.get(uid)!.rail,
        );
      }
    };

    // 1. Reveal palette from the (now un-redacted) voting feed must match.
    const revealedVoting = await listVotingEntries(session.id);
    expectMatchesCanonical(
      "voting-feed",
      buildAuthorshipPalette(
        session.id,
        revealedVoting.map((e) => e.author_id ?? ""),
      ),
    );

    // 2. Awards feed only covers awardees, so verify each awardee still
    //    maps to the canonical color — no drift when the ordering is a
    //    subset of the roster.
    const awards = await listSessionAwards(session.id);
    expect(awards.length).toBeGreaterThan(0);
    const awardsPalette = buildAuthorshipPalette(
      session.id,
      awards.map((a) => a.awarded_to),
    );
    for (const a of awards) {
      expect(awardsPalette.get(a.awarded_to)!.rail).toBe(
        canonical.get(a.awarded_to)!.rail,
      );
    }


    // 3. Every permutation of the writer ids must produce the same
    //    per-writer color — order of submission / display cannot shift hues.
    const perms: string[][] = [
      [HOST_ID, WRITER_ID, THIRD_ID],
      [HOST_ID, THIRD_ID, WRITER_ID],
      [WRITER_ID, HOST_ID, THIRD_ID],
      [WRITER_ID, THIRD_ID, HOST_ID],
      [THIRD_ID, HOST_ID, WRITER_ID],
      [THIRD_ID, WRITER_ID, HOST_ID],
    ];
    for (const p of perms) {
      expectMatchesCanonical(
        `perm ${p.join(">")}`,
        buildAuthorshipPalette(session.id, p),
      );
    }
  });

  it("no Arena UI fetch response leaks author identity before finalizeArenaRound", async () => {

    // Wrap the fake supabase to record EVERY read response from every Arena
    // UI data path (both `.rpc()` calls and `.from(<table>).select(...)` reads
    // — including single()/maybeSingle() terminals). We drive the blind
    // lifecycle through all UI-facing arena fetch functions, then scan the
    // recorded responses for author-identity leaks stage-by-stage.
    type Read = { source: string; data: unknown };
    const reads: Read[] = [];
    const record = (r: Read) => reads.push(r);
    const clientAny = fake.supabase as unknown as {
      rpc: (name: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
      from: (t: string) => unknown;
    };
    const origRpc = clientAny.rpc.bind(fake.supabase);
    const origFrom = clientAny.from.bind(fake.supabase);
    clientAny.rpc = async (name, params) => {
      const res = await origRpc(name, params);
      record({ source: `rpc:${name}`, data: res.data });
      return res;
    };
    clientAny.from = (table: string) => {
      const qb = origFrom(table) as {
        then: (onF: unknown, onR?: unknown) => Promise<unknown>;
        single: () => Promise<{ data: unknown; error: unknown }>;
        maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
      };
      const origThen = qb.then.bind(qb);
      qb.then = (onF: unknown, onR?: unknown) =>
        origThen(
          (v: { data: unknown; error: unknown }) => {
            record({ source: `from:${table}`, data: v.data });
            return typeof onF === "function" ? (onF as (x: unknown) => unknown)(v) : v;
          },
          onR as (r: unknown) => unknown,
        );
      const origSingle = qb.single.bind(qb);
      qb.single = async () => {
        const v = await origSingle();
        record({ source: `from:${table}:single`, data: v.data });
        return v;
      };
      const origMaybe = qb.maybeSingle.bind(qb);
      qb.maybeSingle = async () => {
        const v = await origMaybe();
        record({ source: `from:${table}:maybeSingle`, data: v.data });
        return v;
      };
      return qb;
    };

    try {
      // Setup a blind round with two writers and one judge.
      const session = await createArenaSession({
        projectId: PROJECT_ID,
        title: "Every-Fetch Redaction Audit",
        mode: "villain_monologue",
        prompt: "Reveal nothing about who wrote what.",
        durationSeconds: 60,
        entryReveal: "blind_until_results",
      });
      fake.state.currentUserId = WRITER_ID;
      await joinArenaSession(session, "writer");
      fake.state.currentUserId = VOTER_ID;
      await joinArenaSession(session, "judge");

      // The set of author identity fields that must NOT surface on rows
      // belonging to OTHER writers before finalize. Own rows are allowed to
      // expose the viewer's own id (e.g. getMyEntry / listMyVotes).
      const AUTHOR_ID_FIELDS = ["author_id", "awarded_to"] as const;

      const scanReads = (viewerId: string, stage: string) => {
        for (const entry of reads) {
          const rows = Array.isArray(entry.data)
            ? (entry.data as Record<string, unknown>[])
            : entry.data && typeof entry.data === "object"
              ? [entry.data as Record<string, unknown>]
              : [];
          for (const row of rows) {
            for (const field of AUTHOR_ID_FIELDS) {
              const val = row[field];
              if (val == null) continue;
              // Viewer's own author id/awarded_to is fair game (self-view).
              expect(
                val,
                `${stage} · ${entry.source} leaked ${field}=${String(val)} to viewer ${viewerId}`,
              ).toBe(viewerId);
            }
          }
        }
        // Also confirm the awards feed itself carries zero rows pre-finalize.
        const awardsRows = reads
          .filter((r) => r.source === "from:arena_awards" && Array.isArray(r.data))
          .flatMap((r) => r.data as Record<string, unknown>[]);
        expect(
          awardsRows.length,
          `${stage}: arena_awards feed produced ${awardsRows.length} rows before finalize`,
        ).toBe(0);
      };

      // Force EVERY UI-facing arena fetch to run so it lands in the recorder,
      // then scan. Rotate through each viewer to catch any per-user leaks.
      const exerciseAllFetches = async (viewerId: string) => {
        fake.state.currentUserId = viewerId;
        reads.length = 0;
        await listArenaSessions(PROJECT_ID);
        await listParticipants(session.id);
        await listEntries(session.id);
        await getMyEntry(session);
        await listVotingEntries(session.id);
        await listMyVotes(session.id);
        await listVotes(session.id);
        await listSessionAwards(session.id);
      };

      // Stage A — OPEN: no entries yet, feeds must be empty & authorless.
      for (const viewer of [HOST_ID, WRITER_ID, VOTER_ID]) {
        await exerciseAllFetches(viewer);
        scanReads(viewer, `open/${viewer}`);
      }

      // Stage B — RUNNING: both writers submit; authors must stay masked.
      fake.state.currentUserId = HOST_ID;
      await startArenaRound(session.id);
      const hostDraft = await saveEntryDraft(session, {
        title: "Host Piece",
        body: "A whisper in the dark.",
      });
      await submitEntry(hostDraft.id);
      fake.state.currentUserId = WRITER_ID;
      const writerDraft = await saveEntryDraft(session, {
        title: "Writer Piece",
        body: "A shout in the light.",
      });
      await submitEntry(writerDraft.id);
      for (const viewer of [HOST_ID, WRITER_ID, VOTER_ID]) {
        await exerciseAllFetches(viewer);
        scanReads(viewer, `running/${viewer}`);
      }

      // Stage C — VOTING: votes cast, peer award granted; still masked.
      vi.setSystemTime(new Date(Date.now() + 75_000));
      await advanceArenaRoundIfDue(session.id);
      const high = {
        originality: 5,
        characterTruth: 5,
        cinematicValue: 5,
        emotionalImpact: 5,
        craft: 5,
      };
      for (const voter of [HOST_ID, WRITER_ID, VOTER_ID]) {
        fake.state.currentUserId = voter;
        await castArenaVote({ session, entryId: writerDraft.id, scores: high });
        await castArenaVote({ session, entryId: hostDraft.id, scores: high });
      }
      fake.state.currentUserId = HOST_ID;
      await awardArenaEntry({
        session,
        entry: { id: writerDraft.id },
        awardType: "best_dialogue",
        title: "Best Dialogue",
      });
      for (const viewer of [HOST_ID, WRITER_ID, VOTER_ID]) {
        await exerciseAllFetches(viewer);
        scanReads(viewer, `voting/${viewer}`);
      }

      // Stage D — FINALIZED: identity is allowed to resolve everywhere.
      fake.state.currentUserId = HOST_ID;
      const finalized = await finalizeArenaRound(session.id);
      expect(finalized.status).toBe("complete");

      fake.state.currentUserId = VOTER_ID;
      reads.length = 0;
      const revealedVoting = await listVotingEntries(session.id);
      const revealedAwards = await listSessionAwards(session.id);
      // After finalize the redaction guarantee is intentionally lifted — the
      // same fields that were null before now resolve to real writer ids.
      expect(revealedVoting.every((e) => e.author_id !== null)).toBe(true);
      expect(revealedAwards.length).toBeGreaterThan(0);
      expect(revealedAwards.every((a) => a.awarded_to !== null)).toBe(true);
    } finally {
      clientAny.rpc = origRpc;
      clientAny.from = origFrom;
    }
  });
});




