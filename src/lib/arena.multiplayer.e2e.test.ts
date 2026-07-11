/**
 * Arena Mode — controlled multiplayer scenarios.
 *
 * Covers requirements the base lifecycle test does not stress:
 *  - Four distinct actors: owner/host, writer (member), judge (member),
 *    and a non-member outsider whose RPCs and direct reads must be denied.
 *  - Two full rounds: a named "practice" round and a blind-until-results
 *    round, exercising the identity-redaction contract in both.
 *  - Grace-window edits: draft body edits accepted inside the grace, then
 *    rejected once now > ends_at + submission_grace_seconds.
 *  - Direct `.from('arena_entries')` and `.from('arena_votes')` reads
 *    modeled after the SECURITY DEFINER access predicate
 *    (`has_arena_entry_read_access`) and the votes policy: authors always
 *    see their own row, others only see submitted entries in voting/
 *    complete/archived rounds (never during blind voting); only own votes
 *    are visible pre-finalize.
 *  - Tied final scores produce multiple `studio_winner` awards
 *    (`resolveArenaWinners` returns co-winners).
 *  - Duplicate promotion clicks: two back-to-back `promoteEntryToSuggestion`
 *    calls from separate actors resolve to the same suggestion row,
 *    proving the metadata uniqueness key is honored end-to-end.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const HOST_ID = "user-host"; // project owner + round host
const WRITER_ID = "user-writer"; // project member, writer role
const JUDGE_ID = "user-judge"; // project member, judge role
const OUTSIDER_ID = "user-outsider"; // NOT a project member
const PROJECT_ID = "project-mp";

const fake = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  type Filter =
    | { kind: "eq"; col: string; val: unknown }
    | { kind: "neq"; col: string; val: unknown };

  const state = {
    currentUserId: "user-host",
    idSeq: 0,
    // Project membership. RPCs and direct .from reads treat non-members
    // the way RLS + is_project_member() do in production.
    members: new Set<string>(["user-host", "user-writer", "user-judge"]),
    ownerId: "user-host",
  };
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
  const now = () => new Date().toISOString();
  const matches = (row: Row, filters: Filter[]) =>
    filters.every((f) =>
      f.kind === "eq" ? row[f.col] === f.val : row[f.col] !== f.val,
    );
  const isMember = (uid: string) => state.members.has(uid);

  // Model the SECURITY DEFINER predicate has_arena_entry_read_access.
  const canReadEntry = (viewer: string, entry: Row): boolean => {
    if (!isMember(viewer)) return false;
    if (entry.author_id === viewer) return true;
    if (entry.status !== "submitted") return false;
    const session = store.arena_sessions.find((s) => s.id === entry.session_id);
    if (!session) return false;
    const st = session.status as string;
    if (!["voting", "complete", "archived"].includes(st)) return false;
    if (st === "voting" && session.entry_reveal === "blind_until_results")
      return false;
    return true;
  };
  const canReadVote = (viewer: string, vote: Row): boolean => {
    if (!isMember(viewer)) return false;
    if (vote.voter_id === viewer) return true;
    const session = store.arena_sessions.find((s) => s.id === vote.session_id);
    return session?.status === "complete" || session?.status === "archived";
  };

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
    select(_c?: string) {
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
    eq(c: string, v: unknown) {
      this.filters.push({ kind: "eq", col: c, val: v });
      return this;
    }
    neq(c: string, v: unknown) {
      this.filters.push({ kind: "neq", col: c, val: v });
      return this;
    }
    order() {
      return this;
    }
    limit() {
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
      return { id: nextId(this.table), created_at: now(), updated_at: now(), ...row };
    }
    // Enforce grace edits + submitted immutability on arena_entries updates.
    private guardEntryUpdate(hit: Row, patch: Row): string | null {
      if (hit.status !== "draft") return "ARENA: submitted entries cannot be modified";
      const session = store.arena_sessions.find((s) => s.id === hit.session_id);
      if (!session) return "ARENA: session missing";
      if (session.status !== "running")
        return "ARENA: cannot edit draft outside running round";
      const graceMs = ((session.submission_grace_seconds as number) ?? 0) * 1000;
      if (
        typeof session.ends_at === "string" &&
        Date.now() > new Date(session.ends_at as string).getTime() + graceMs
      )
        return "ARENA: submission window has closed";
      // status transitions must go through submit_arena_entry
      if ("status" in patch && patch.status !== hit.status)
        return "ARENA: status transitions must use submit_arena_entry";
      return null;
    }
    private async exec(): Promise<{ data: unknown; error: unknown }> {
      const rows = store[this.table];

      // Non-members cannot read arena_* rows at all (mirrors RLS).
      const viewer = state.currentUserId;
      if (this.mode === "select" && !isMember(viewer)) {
        return this.shape([]);
      }

      if (this.mode === "insert") {
        const list = Array.isArray(this.payload) ? this.payload : [this.payload!];
        // Direct arena_entries insert is used by saveEntryDraft; must be a
        // member and session must be running within grace.
        if (this.table === "arena_entries") {
          if (!isMember(viewer))
            return { data: null, error: new Error("ARENA: not a project member") };
          for (const r of list) {
            const session = store.arena_sessions.find(
              (s) => s.id === r.session_id,
            );
            if (!session)
              return { data: null, error: new Error("ARENA: session missing") };
            if (session.status !== "running")
              return {
                data: null,
                error: new Error("ARENA: cannot edit draft outside running round"),
              };
            const graceMs =
              ((session.submission_grace_seconds as number) ?? 0) * 1000;
            if (
              typeof session.ends_at === "string" &&
              Date.now() > new Date(session.ends_at as string).getTime() + graceMs
            )
              return {
                data: null,
                error: new Error("ARENA: submission window has closed"),
              };
          }
        }
        if (this.table === "arena_votes" && !isMember(viewer))
          return { data: null, error: new Error("ARENA: not a project member") };
        const inserted = list.map((r) => this.stamp(r));
        rows.push(...inserted);
        return this.shape(inserted);
      }
      if (this.mode === "upsert") {
        const list = Array.isArray(this.payload) ? this.payload : [this.payload!];
        if (this.table === "arena_votes" && !isMember(viewer))
          return { data: null, error: new Error("ARENA: not a project member") };
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
            rows[idx] = { ...rows[idx], ...r, updated_at: now() };
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
        if (this.table === "arena_entries") {
          for (const h of hits) {
            if (h.author_id !== viewer)
              return { data: null, error: new Error("ARENA: not your entry") };
            const err = this.guardEntryUpdate(h, patch);
            if (err) return { data: null, error: new Error(err) };
          }
        }
        for (const h of hits) Object.assign(h, patch, { updated_at: now() });
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
      let hits = rows.filter((r) => matches(r, this.filters));
      if (this.table === "arena_entries")
        hits = hits.filter((r) => canReadEntry(viewer, r));
      if (this.table === "arena_votes")
        hits = hits.filter((r) => canReadVote(viewer, r));
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

    // Every RPC in production goes through is_project_member() or a stricter
    // gate; the browser never bypasses. Reject outsiders uniformly.
    const memberGated = new Set([
      "create_arena_session",
      "join_arena_session",
      "submit_arena_entry",
      "award_arena_entry",
      "promote_arena_entry",
      "archive_arena_session",
      "get_arena_voting_entries",
      "start_arena_round",
      "end_arena_round",
      "finalize_arena_round",
      "advance_arena_round_if_due",
    ]);
    if (memberGated.has(name) && !isMember(uid))
      return { data: null, error: new Error("ARENA: not a project member") };

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
      if (!session) return { data: null, error: new Error("ARENA: session not found") };
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
      const entry = store.arena_entries.find((e) => e.id === params._entry_id);
      if (!entry) return { data: null, error: new Error("ARENA: entry not found") };
      if (entry.author_id !== uid)
        return { data: null, error: new Error("ARENA: not your entry") };
      if (entry.status !== "draft")
        return {
          data: null,
          error: new Error(`ARENA: entry already ${entry.status}`),
        };
      const s = store.arena_sessions.find((x) => x.id === entry.session_id)!;
      if (s.status !== "running")
        return { data: null, error: new Error("ARENA: round is not running") };
      const graceMs = ((s.submission_grace_seconds as number) ?? 0) * 1000;
      if (
        typeof s.ends_at === "string" &&
        Date.now() > new Date(s.ends_at as string).getTime() + graceMs
      )
        return {
          data: null,
          error: new Error("ARENA: submission window has closed"),
        };
      entry.status = "submitted";
      entry.submitted_at = now();
      entry.updated_at = now();
      return { data: entry, error: null };
    }
    if (name === "award_arena_entry") {
      if (!session) return { data: null, error: new Error("ARENA: session not found") };
      if (session.created_by !== uid && uid !== state.ownerId)
        return { data: null, error: new Error("ARENA: only host or owner") };
      const entry = store.arena_entries.find((e) => e.id === params._entry_id);
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
      if (!session) return { data: null, error: new Error("ARENA: session not found") };
      if (session.status !== "complete")
        return {
          data: null,
          error: new Error("ARENA: only complete rounds may be promoted"),
        };
      const entry = store.arena_entries.find((e) => e.id === params._entry_id);
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
      if (existing)
        return { data: [{ id: existing.id, already_existed: true }], error: null };
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
        after: { text: entry.body },
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
      return { data: [{ id: row.id, already_existed: false }], error: null };
    }
    if (name === "archive_arena_session") {
      if (!session) return { data: null, error: new Error("ARENA: session not found") };
      session.status = "archived";
      session.updated_at = now();
      return { data: session, error: null };
    }
    if (name === "get_arena_voting_entries") {
      if (!session) return { data: null, error: new Error("ARENA: session not found") };
      const entries = store.arena_entries.filter(
        (e) => e.session_id === sessionId && e.status === "submitted",
      );
      const blind =
        session.entry_reveal === "blind_until_results" && session.status !== "complete";
      const rows = entries.map((e, i) => ({
        entry_id: e.id,
        session_id: sessionId,
        anonymous_label: `Writer #${i + 1}`,
        title: blind && e.author_id !== uid ? null : e.title,
        body: e.body,
        status: e.status,
        author_id: blind && e.author_id !== uid ? null : e.author_id,
        submitted_at: e.submitted_at ?? null,
      }));
      return { data: rows, error: null };
    }

    if (!session) return { data: null, error: new Error("ARENA: session not found") };
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
          ((session.submission_grace_seconds as number) ?? 0) * 1000 <=
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
      const top = scored[0];
      if (top && top.avg > 0) {
        // Co-winners on exact ties (mirrors the ranked_scored/winners CTE).
        const winners = scored.filter((s) => s.avg === top.avg).map((s) => s.entry);
        for (const w of winners) {
          const dupe = store.arena_awards.find(
            (a) =>
              a.session_id === sessionId &&
              a.entry_id === w.id &&
              a.award_type === "studio_winner",
          );
          if (!dupe)
            store.arena_awards.push({
              id: nextId("arena_awards"),
              session_id: sessionId,
              project_id: session.project_id,
              entry_id: w.id,
              awarded_to: w.author_id,
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

import {
  advanceArenaRoundIfDue,
  archiveArenaSession,
  castArenaVote,
  createArenaSession,
  finalizeArenaRound,
  joinArenaSession,
  listEntries,
  listMyVotes,
  listVotes,
  listVotingEntries,
  promoteEntryToSuggestion,
  resolveArenaWinners,
  saveEntryDraft,
  startArenaRound,
  submitEntry,
} from "@/lib/arena";

const HIGH = {
  originality: 5,
  characterTruth: 5,
  cinematicValue: 5,
  emotionalImpact: 5,
  craft: 5,
};
const LOW = {
  originality: 2,
  characterTruth: 2,
  cinematicValue: 2,
  emotionalImpact: 2,
  craft: 2,
};

const asUser = (uid: string) => {
  fake.state.currentUserId = uid;
};

describe("Arena Mode — multiplayer scenarios", () => {
  beforeEach(() => {
    fake.state.idSeq = 0;
    fake.state.currentUserId = HOST_ID;
    fake.state.members = new Set([HOST_ID, WRITER_ID, JUDGE_ID]);
    fake.state.ownerId = HOST_ID;
    for (const k of Object.keys(fake.store))
      (fake.store as Record<string, unknown[]>)[k] = [];
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T09:00:00Z"));
  });

  it("named practice: host + writer + judge play through; outsider is denied at every surface", async () => {
    // Host creates a NAMED practice round (identity visible throughout).
    asUser(HOST_ID);
    const session = await createArenaSession({
      projectId: PROJECT_ID,
      title: "Practice: Two Villains",
      mode: "villain_monologue",
      prompt: "Two rivals meet in an elevator.",
      durationSeconds: 60,
      submissionGraceSeconds: 10,
      stakes: "practice",
    });
    expect(session.status).toBe("open");

    // Writer + judge join.
    asUser(WRITER_ID);
    await joinArenaSession(session, "writer");
    asUser(JUDGE_ID);
    await joinArenaSession(session, "judge");

    // Outsider cannot join, cannot read, cannot cast a vote.
    asUser(OUTSIDER_ID);
    await expect(joinArenaSession(session, "writer")).rejects.toThrow(
      /not a project member/i,
    );
    await expect(listVotingEntries(session.id)).rejects.toThrow(
      /not a project member/i,
    );
    // Direct .from arena_entries reads are RLS-empty for non-members.
    expect(await listEntries(session.id)).toEqual([]);
    expect(await listMyVotes(session.id)).toEqual([]);

    // Host starts the round.
    asUser(HOST_ID);
    await startArenaRound(session.id);

    // Host + writer both draft + submit.
    const hostDraft = await saveEntryDraft(session, {
      title: "Elevator Pitch",
      body: "VILLAIN A steps in. Doors close on their smirk.",
    });
    asUser(WRITER_ID);
    const writerDraft = await saveEntryDraft(session, {
      title: "Rival's Reply",
      body: "VILLAIN B doesn't look up. 'You're late.'",
    });
    await submitEntry(writerDraft.id);
    asUser(HOST_ID);
    await submitEntry(hostDraft.id);

    // Outsider cannot submit / vote / read even mid-round.
    asUser(OUTSIDER_ID);
    await expect(submitEntry(hostDraft.id)).rejects.toThrow(
      /not a project member/i,
    );
    await expect(
      castArenaVote({ session, entryId: writerDraft.id, scores: HIGH }),
    ).rejects.toThrow(/not a project member/i);

    // Timer expires past the grace → voting.
    vi.setSystemTime(new Date(Date.now() + 75_000));
    asUser(HOST_ID);
    const voting = await advanceArenaRoundIfDue(session.id);
    expect(voting.status).toBe("voting");

    // Three members cast votes (host + writer + judge). Writer wins clearly.
    for (const voter of [HOST_ID, WRITER_ID, JUDGE_ID]) {
      asUser(voter);
      await castArenaVote({ session, entryId: writerDraft.id, scores: HIGH });
      await castArenaVote({ session, entryId: hostDraft.id, scores: LOW });
    }

    // Direct votes read: each member sees only their own row pre-finalize.
    asUser(JUDGE_ID);
    const judgeOwnVotes = await listMyVotes(session.id);
    expect(judgeOwnVotes).toHaveLength(2);
    expect(judgeOwnVotes.every((v) => v.voter_id === JUDGE_ID)).toBe(true);
    const allVotesPre = await listVotes(session.id);
    expect(allVotesPre.every((v) => v.voter_id === JUDGE_ID)).toBe(true);

    // Finalize → exactly one studio_winner (writer), and full votes unlock.
    asUser(HOST_ID);
    await finalizeArenaRound(session.id);
    const winners = await resolveArenaWinners(session.id);
    expect(winners).toHaveLength(1);
    expect(winners[0].awarded_to).toBe(WRITER_ID);

    asUser(JUDGE_ID);
    const allVotesPost = await listVotes(session.id);
    expect(allVotesPost).toHaveLength(6);
    expect(new Set(allVotesPost.map((v) => v.voter_id))).toEqual(
      new Set([HOST_ID, WRITER_ID, JUDGE_ID]),
    );

    // Outsider still locked out post-finalize.
    asUser(OUTSIDER_ID);
    expect(await listVotes(session.id)).toEqual([]);
    expect(await listEntries(session.id)).toEqual([]);

    // Duplicate promotion clicks from two different eligible actors resolve
    // to the same suggestion row (metadata unique key + idempotent RPC).
    asUser(HOST_ID);
    const first = await promoteEntryToSuggestion({
      session,
      entry: { id: writerDraft.id },
    });
    expect(first.alreadyExisted).toBe(false);
    asUser(WRITER_ID);
    const secondSameActor = await promoteEntryToSuggestion({
      session,
      entry: { id: writerDraft.id },
    });
    expect(secondSameActor.alreadyExisted).toBe(true);
    expect(secondSameActor.id).toBe(first.id);
    asUser(HOST_ID);
    const thirdRapid = await promoteEntryToSuggestion({
      session,
      entry: { id: writerDraft.id },
    });
    expect(thirdRapid.alreadyExisted).toBe(true);
    expect(thirdRapid.id).toBe(first.id);
    expect(fake.store.suggestions).toHaveLength(1);
  });

  it("blind practice + grace edits: identity redacted for non-authors, then submissions close after grace", async () => {
    asUser(HOST_ID);
    const session = await createArenaSession({
      projectId: PROJECT_ID,
      title: "Blind Practice",
      mode: "villain_monologue",
      prompt: "Speak without a face.",
      durationSeconds: 60,
      submissionGraceSeconds: 10,
      entryReveal: "blind_until_results",
    });
    asUser(WRITER_ID);
    await joinArenaSession(session, "writer");
    asUser(JUDGE_ID);
    await joinArenaSession(session, "judge");

    asUser(HOST_ID);
    await startArenaRound(session.id);

    const hostDraft = await saveEntryDraft(session, {
      title: "Host Piece",
      body: "A whisper in the dark.",
    });
    asUser(WRITER_ID);
    const writerDraft = await saveEntryDraft(session, {
      title: "Writer Piece",
      body: "A shout in the light.",
    });

    // Grace edit BEFORE ends_at + grace: writer refines their draft, allowed.
    vi.setSystemTime(new Date(Date.now() + 55_000)); // inside 60s + 10s grace
    const refined = await saveEntryDraft(session, {
      title: "Writer Piece",
      body: "A shout in the light — refined.",
    });
    expect(refined.body).toMatch(/refined/);
    await submitEntry(writerDraft.id);

    // Host submits also within grace.
    asUser(HOST_ID);
    await submitEntry(hostDraft.id);

    // Push past ends_at + grace: further draft edits and late submits reject.
    vi.setSystemTime(new Date(Date.now() + 30_000)); // now 85s in
    asUser(WRITER_ID);
    await expect(
      saveEntryDraft(session, {
        title: "Writer Piece",
        body: "Too late edit.",
      }),
    ).rejects.toThrow(/already submitted|window has closed/i);
    // A late unsubmitted user cannot create a fresh draft either — session
    // still `running` but past grace triggers the closed window guard.
    // (Model this with a fresh outsider-of-entry scenario: judge as writer.)
    asUser(JUDGE_ID);
    await expect(
      saveEntryDraft(session, { title: "Late Judge", body: "Sneaking in" }),
    ).rejects.toThrow(/window has closed/i);

    // Advance and read the redacted feed as the judge: authors must be null,
    // titles for other people's entries hidden.
    asUser(HOST_ID);
    const voting = await advanceArenaRoundIfDue(session.id);
    expect(voting.status).toBe("voting");

    asUser(JUDGE_ID);
    const blindFeed = await listVotingEntries(session.id);
    expect(blindFeed).toHaveLength(2);
    for (const r of blindFeed) {
      expect(r.author_id).toBeNull();
      expect(r.title).toBeNull();
      expect(r.anonymous_label).toMatch(/^Writer #\d+$/);
    }
    // Direct arena_entries reads during blind voting return zero non-own rows
    // (RLS + has_arena_entry_read_access). Judge is not an author here.
    expect(await listEntries(session.id)).toEqual([]);

    // Author still sees their own entry through the redacted feed.
    asUser(WRITER_ID);
    const writerView = await listVotingEntries(session.id);
    const ownRow = writerView.find((r) => r.author_id === WRITER_ID);
    expect(ownRow).toBeTruthy();
    expect(ownRow!.title).toBe("Writer Piece");
  });

  it("tied voting produces co-winners and both survive resolveArenaWinners", async () => {
    asUser(HOST_ID);
    const session = await createArenaSession({
      projectId: PROJECT_ID,
      title: "Tied Duel",
      mode: "villain_monologue",
      prompt: "Deadlock the panel.",
      durationSeconds: 60,
      submissionGraceSeconds: 10,
    });
    asUser(WRITER_ID);
    await joinArenaSession(session, "writer");
    asUser(JUDGE_ID);
    await joinArenaSession(session, "judge");

    asUser(HOST_ID);
    await startArenaRound(session.id);
    const hostDraft = await saveEntryDraft(session, {
      title: "Host",
      body: "Alpha.",
    });
    await submitEntry(hostDraft.id);
    asUser(WRITER_ID);
    const writerDraft = await saveEntryDraft(session, {
      title: "Writer",
      body: "Beta.",
    });
    await submitEntry(writerDraft.id);

    vi.setSystemTime(new Date(Date.now() + 75_000));
    asUser(HOST_ID);
    await advanceArenaRoundIfDue(session.id);

    // Every voter gives BOTH entries identical HIGH scores → dead tie.
    for (const voter of [HOST_ID, WRITER_ID, JUDGE_ID]) {
      asUser(voter);
      await castArenaVote({ session, entryId: hostDraft.id, scores: HIGH });
      await castArenaVote({ session, entryId: writerDraft.id, scores: HIGH });
    }

    asUser(HOST_ID);
    await finalizeArenaRound(session.id);
    const winners = await resolveArenaWinners(session.id);
    expect(winners).toHaveLength(2);
    const awardedTo = winners.map((w) => w.awarded_to).sort();
    expect(awardedTo).toEqual([HOST_ID, WRITER_ID].sort());
    expect(winners.every((w) => w.award_type === "studio_winner")).toBe(true);

    // Duplicate promotion clicks on BOTH co-winners each idempotent.
    const firstA = await promoteEntryToSuggestion({
      session,
      entry: { id: hostDraft.id },
    });
    const firstB = await promoteEntryToSuggestion({
      session,
      entry: { id: writerDraft.id },
    });
    const rapidA = await promoteEntryToSuggestion({
      session,
      entry: { id: hostDraft.id },
    });
    const rapidB = await promoteEntryToSuggestion({
      session,
      entry: { id: writerDraft.id },
    });
    expect(firstA.alreadyExisted).toBe(false);
    expect(firstB.alreadyExisted).toBe(false);
    expect(rapidA.alreadyExisted).toBe(true);
    expect(rapidB.alreadyExisted).toBe(true);
    expect(rapidA.id).toBe(firstA.id);
    expect(rapidB.id).toBe(firstB.id);
    expect(fake.store.suggestions).toHaveLength(2);

    // Archiving still restricted to host/owner; outsider blocked.
    asUser(OUTSIDER_ID);
    await expect(archiveArenaSession(session.id)).rejects.toThrow(
      /not a project member/i,
    );
    asUser(HOST_ID);
    const archived = await archiveArenaSession(session.id);
    expect(archived.status).toBe("archived");
  });
});
