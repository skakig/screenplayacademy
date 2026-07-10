/**
 * Arena Mode v1 — timed creative writing games.
 *
 * All lifecycle-critical calls (create, join, submit, award, promote,
 * archive, start/end/finalize) go through SECURITY DEFINER RPCs so the
 * browser cannot forge project_id / awarded_to / winner values or race
 * duplicate promotions. Ordinary reads still use RLS-scoped Data API.
 *
 * Nothing in this file mutates canonical screenplay content — promotion
 * only writes to `public.suggestions`.
 */
import { supabase } from "@/integrations/supabase/client";

export type ArenaMode =
  | "dialogue_duel"
  | "rewrite_relay"
  | "scene_rescue"
  | "adlib_character"
  | "comedy_punchup"
  | "villain_monologue"
  | "pitch_blitz"
  | "freewrite";

export type ArenaStatus =
  | "draft"
  | "open"
  | "running"
  | "voting"
  | "complete"
  | "archived";

export type ArenaParticipantRole = "writer" | "judge" | "viewer";
export type ArenaEntryStatus = "draft" | "submitted" | "withdrawn";
export type ArenaAwardType =
  | "best_line"
  | "best_dialogue"
  | "best_twist"
  | "best_character_truth"
  | "funniest"
  | "most_cinematic"
  | "audience_choice"
  | "studio_winner";
export type ArenaJudgingMode = "peer" | "host" | "panel" | "hybrid";
export type ArenaEntryReveal = "named" | "blind_until_results";
export type ArenaStakes = "practice" | "ranked" | "showcase";

export const ARENA_MODES: ArenaMode[] = [
  "dialogue_duel",
  "rewrite_relay",
  "scene_rescue",
  "adlib_character",
  "comedy_punchup",
  "villain_monologue",
  "pitch_blitz",
  "freewrite",
];
export const ARENA_DURATION_PRESETS = [180, 300, 420, 600, 900] as const;
export const ARENA_AWARD_TYPES: ArenaAwardType[] = [
  "best_line",
  "best_dialogue",
  "best_twist",
  "best_character_truth",
  "funniest",
  "most_cinematic",
  "audience_choice",
  "studio_winner",
];

export interface ArenaSessionRow {
  id: string;
  project_id: string;
  created_by: string;
  title: string;
  mode: ArenaMode;
  prompt: string;
  status: ArenaStatus;
  duration_seconds: number;
  starts_at: string | null;
  ends_at: string | null;
  rules: Record<string, unknown>;
  judging_mode: ArenaJudgingMode;
  entry_reveal: ArenaEntryReveal;
  stakes: ArenaStakes;
  submission_grace_seconds: number;
  created_at: string;
  updated_at: string;
}

export interface ArenaParticipantRow {
  id: string;
  session_id: string;
  project_id: string;
  user_id: string;
  role: ArenaParticipantRole;
  joined_at: string;
}

export interface ArenaEntryRow {
  id: string;
  session_id: string;
  project_id: string;
  author_id: string;
  title: string | null;
  body: string;
  status: ArenaEntryStatus;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Blind-safe entry row returned by get_arena_voting_entries. */
export interface ArenaVotingEntry {
  entry_id: string;
  session_id: string;
  anonymous_label: string;
  title: string | null;
  body: string;
  status: ArenaEntryStatus;
  /** null when blind mode redacts identity */
  author_id: string | null;
  submitted_at: string | null;
}

export interface ArenaVoteRow {
  id: string;
  session_id: string;
  entry_id: string;
  voter_id: string;
  score_originality: number;
  score_character_truth: number;
  score_cinematic_value: number;
  score_emotional_impact: number;
  score_craft: number;
  comment: string | null;
  created_at: string;
}

export interface ArenaAwardRow {
  id: string;
  session_id: string;
  project_id: string;
  entry_id: string;
  awarded_to: string;
  award_type: ArenaAwardType;
  title: string | null;
  created_at: string;
}

export interface ArenaVotingProgress {
  eligible_voters: number;
  completed_voters: number;
  entries_with_votes: number;
  current_user_has_voted: boolean;
}

export interface ProjectMemberIdentity {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
}

export const ARENA_LIMITS = {
  title: 120,
  prompt: 2000,
  entryTitle: 160,
  entryBody: 8000,
  comment: 1000,
} as const;

export const arenaKeys = {
  list: (projectId: string) => ["arena", "list", projectId] as const,
  session: (sessionId: string) => ["arena", "session", sessionId] as const,
  participants: (sessionId: string) =>
    ["arena", "participants", sessionId] as const,
  entries: (sessionId: string) => ["arena", "entries", sessionId] as const,
  votingEntries: (sessionId: string) =>
    ["arena", "voting-entries", sessionId] as const,
  votes: (sessionId: string) => ["arena", "votes", sessionId] as const,
  myVotes: (sessionId: string) => ["arena", "votes", "mine", sessionId] as const,
  progress: (sessionId: string) => ["arena", "progress", sessionId] as const,
  awards: (projectId: string) => ["arena", "awards", projectId] as const,
  sessionAwards: (sessionId: string) =>
    ["arena", "awards", "session", sessionId] as const,
  identities: (projectId: string) =>
    ["arena", "identities", projectId] as const,
};

// Loose generic client alias so we compile against generated types that
// don't yet include the new RPCs / return shapes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as unknown as any).from(name) as any;
type RpcClient = {
  rpc: (
    name: string,
    params?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message?: string } | null }>;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (): RpcClient => supabase as unknown as any;

// ----- Sessions -----------------------------------------------------------

export async function listArenaSessions(
  projectId: string,
): Promise<ArenaSessionRow[]> {
  const { data, error } = await tbl("arena_sessions")
    .select("*")
    .eq("project_id", projectId)
    .neq("status", "archived")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ArenaSessionRow[];
}

export async function getArenaSession(
  sessionId: string,
): Promise<ArenaSessionRow | null> {
  const { data, error } = await tbl("arena_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as ArenaSessionRow | null;
}

export interface CreateArenaSessionInput {
  projectId: string;
  title: string;
  mode: ArenaMode;
  prompt: string;
  durationSeconds: number;
  submissionGraceSeconds?: number;
  judgingMode?: ArenaJudgingMode;
  entryReveal?: ArenaEntryReveal;
  stakes?: ArenaStakes;
  rules?: Record<string, unknown>;
}

export async function createArenaSession(
  input: CreateArenaSessionInput,
): Promise<ArenaSessionRow> {
  const { data, error } = await rpc().rpc("create_arena_session", {
    _project_id: input.projectId,
    _title: input.title.trim(),
    _mode: input.mode,
    _prompt: input.prompt.trim(),
    _duration_seconds: input.durationSeconds,
    _submission_grace_seconds: input.submissionGraceSeconds ?? 10,
    _judging_mode: input.judgingMode ?? "peer",
    _entry_reveal: input.entryReveal ?? "named",
    _stakes: input.stakes ?? "practice",
    _rules: input.rules ?? {},
  });
  if (error) {
    const msg = error.message ?? "";
    if (/one_active_per_project|duplicate key/i.test(msg)) {
      throw new Error(
        "This project already has an active Arena round. Finish or archive it first.",
      );
    }
    throw new Error(msg || "Could not create round");
  }
  return data as ArenaSessionRow;
}

export async function archiveArenaSession(
  sessionId: string,
): Promise<ArenaSessionRow> {
  const { data, error } = await rpc().rpc("archive_arena_session", {
    _session_id: sessionId,
  });
  if (error) throw new Error(error.message ?? "Could not archive round");
  return data as ArenaSessionRow;
}

// ----- Lifecycle RPCs -----------------------------------------------------

async function callLifecycle(name: string, sessionId: string) {
  const { data, error } = await rpc().rpc(name, { _session_id: sessionId });
  if (error) throw new Error(error.message ?? `Could not ${name}`);
  return data as ArenaSessionRow;
}
export const startArenaRound = (id: string) =>
  callLifecycle("start_arena_round", id);
export const advanceArenaRoundIfDue = (id: string) =>
  callLifecycle("advance_arena_round_if_due", id);
export const endArenaRound = (id: string) =>
  callLifecycle("end_arena_round", id);
export const finalizeArenaRound = (id: string) =>
  callLifecycle("finalize_arena_round", id);

// ----- Participants -------------------------------------------------------

export async function listParticipants(
  sessionId: string,
): Promise<ArenaParticipantRow[]> {
  const { data, error } = await tbl("arena_participants")
    .select("*")
    .eq("session_id", sessionId)
    .order("joined_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ArenaParticipantRow[];
}

export async function joinArenaSession(
  session: Pick<ArenaSessionRow, "id" | "project_id">,
  role: ArenaParticipantRole = "writer",
): Promise<ArenaParticipantRow> {
  const { data, error } = await rpc().rpc("join_arena_session", {
    _session_id: session.id,
    _role: role,
  });
  if (error) throw new Error(error.message ?? "Could not join round");
  return data as ArenaParticipantRow;
}

export async function leaveArenaSession(sessionId: string): Promise<void> {
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp?.user) return;
  const { error } = await tbl("arena_participants")
    .delete()
    .eq("session_id", sessionId)
    .eq("user_id", userResp.user.id);
  if (error) throw error;
}

// ----- Entries ------------------------------------------------------------

export async function listEntries(
  sessionId: string,
): Promise<ArenaEntryRow[]> {
  const { data, error } = await tbl("arena_entries")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ArenaEntryRow[];
}

export async function getMyEntry(
  session: Pick<ArenaSessionRow, "id">,
): Promise<ArenaEntryRow | null> {
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp?.user) return null;
  const { data, error } = await tbl("arena_entries")
    .select("*")
    .eq("session_id", session.id)
    .eq("author_id", userResp.user.id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as ArenaEntryRow | null;
}

export async function saveEntryDraft(
  session: Pick<ArenaSessionRow, "id" | "project_id">,
  patch: { title?: string | null; body: string },
): Promise<ArenaEntryRow> {
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp?.user) throw new Error("Not signed in");
  const body = patch.body.slice(0, ARENA_LIMITS.entryBody);
  const title =
    (patch.title ?? "").trim().slice(0, ARENA_LIMITS.entryTitle) || null;

  const existing = await getMyEntry(session);
  if (existing) {
    const { data, error } = await tbl("arena_entries")
      .update({ title, body })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw new Error(mapEntryError(error));
    return data as ArenaEntryRow;
  }

  const { data, error } = await tbl("arena_entries")
    .insert({
      session_id: session.id,
      project_id: session.project_id,
      author_id: userResp.user.id,
      title,
      body,
      status: "draft",
    })
    .select("*")
    .single();
  if (error) throw new Error(mapEntryError(error));
  return data as ArenaEntryRow;
}

function mapEntryError(err: unknown): string {
  const msg = (err as { message?: string })?.message ?? "";
  if (/submission window has closed/i.test(msg))
    return "Submission window has closed.";
  if (/submitted entries cannot be modified/i.test(msg))
    return "Your entry is already submitted.";
  if (/cannot edit draft outside running round/i.test(msg))
    return "This round is not currently running.";
  return msg || "Could not save entry";
}

export async function submitEntry(entryId: string): Promise<ArenaEntryRow> {
  const { data, error } = await rpc().rpc("submit_arena_entry", {
    _entry_id: entryId,
  });
  if (error) throw new Error(mapEntryError(error));
  return data as ArenaEntryRow;
}

// ----- Votes --------------------------------------------------------------

export interface VoteScores {
  originality: number;
  characterTruth: number;
  cinematicValue: number;
  emotionalImpact: number;
  craft: number;
}

export async function castArenaVote(input: {
  session: Pick<ArenaSessionRow, "id">;
  entryId: string;
  scores: VoteScores;
  comment?: string;
}): Promise<void> {
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp?.user) throw new Error("Not signed in");
  const payload = {
    session_id: input.session.id,
    entry_id: input.entryId,
    voter_id: userResp.user.id,
    score_originality: clamp1to5(input.scores.originality),
    score_character_truth: clamp1to5(input.scores.characterTruth),
    score_cinematic_value: clamp1to5(input.scores.cinematicValue),
    score_emotional_impact: clamp1to5(input.scores.emotionalImpact),
    score_craft: clamp1to5(input.scores.craft),
    comment:
      (input.comment ?? "").trim().slice(0, ARENA_LIMITS.comment) || null,
  };
  const { error } = await tbl("arena_votes").upsert(payload, {
    onConflict: "session_id,entry_id,voter_id",
  });
  if (error) throw error;
}

/** Blind-safe entries feed used during voting. */
export async function listVotingEntries(
  sessionId: string,
): Promise<ArenaVotingEntry[]> {
  const { data, error } = await rpc().rpc("get_arena_voting_entries", {
    _session_id: sessionId,
  });
  if (error) throw new Error(error.message ?? "Could not load entries");
  return (data ?? []) as ArenaVotingEntry[];
}

/** Own votes only — safe to read during voting. */
export async function listMyVotes(
  sessionId: string,
): Promise<ArenaVoteRow[]> {
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp?.user) return [];
  const { data, error } = await tbl("arena_votes")
    .select("*")
    .eq("session_id", sessionId)
    .eq("voter_id", userResp.user.id);
  if (error) throw error;
  return (data ?? []) as ArenaVoteRow[];
}

/** Full votes — only readable after status = 'complete' (enforced by RLS). */
export async function listVotes(sessionId: string): Promise<ArenaVoteRow[]> {
  const { data, error } = await tbl("arena_votes")
    .select("*")
    .eq("session_id", sessionId);
  if (error) throw error;
  return (data ?? []) as ArenaVoteRow[];
}

export async function getVotingProgress(
  sessionId: string,
): Promise<ArenaVotingProgress> {
  const { data, error } = await rpc().rpc("get_arena_voting_progress", {
    _session_id: sessionId,
  });
  if (error) throw new Error(error.message ?? "Could not load progress");
  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? {
    eligible_voters: 0,
    completed_voters: 0,
    entries_with_votes: 0,
    current_user_has_voted: false,
  }) as ArenaVotingProgress;
}

// ----- Awards -------------------------------------------------------------

export async function listSessionAwards(
  sessionId: string,
): Promise<ArenaAwardRow[]> {
  const { data, error } = await tbl("arena_awards")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ArenaAwardRow[];
}

export async function listProjectAwards(
  projectId: string,
): Promise<ArenaAwardRow[]> {
  const { data, error } = await tbl("arena_awards")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as ArenaAwardRow[];
}

export async function awardArenaEntry(input: {
  session: Pick<ArenaSessionRow, "id">;
  entry: Pick<ArenaEntryRow, "id">;
  awardType: ArenaAwardType;
  title?: string | null;
}): Promise<ArenaAwardRow> {
  const { data, error } = await rpc().rpc("award_arena_entry", {
    _session_id: input.session.id,
    _entry_id: input.entry.id,
    _award_type: input.awardType,
    _title: input.title ?? null,
  });
  if (error) throw new Error(error.message ?? "Could not award entry");
  return data as ArenaAwardRow;
}

/**
 * Resolve database-authoritative winners (co-winners supported).
 */
export async function resolveArenaWinners(
  sessionId: string,
): Promise<ArenaAwardRow[]> {
  const { data, error } = await tbl("arena_awards")
    .select("*")
    .eq("session_id", sessionId)
    .eq("award_type", "studio_winner")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ArenaAwardRow[];
}

// ----- Promote to Suggestions --------------------------------------------

export async function promoteEntryToSuggestion(input: {
  session: Pick<ArenaSessionRow, "id">;
  entry: Pick<ArenaEntryRow, "id">;
  suggestionType?: "structure_note" | "rewrite_scene";
}): Promise<{ id: string; alreadyExisted: boolean }> {
  const { data, error } = await rpc().rpc("promote_arena_entry", {
    _session_id: input.session.id,
    _entry_id: input.entry.id,
    _suggestion_type: input.suggestionType ?? "structure_note",
  });
  if (error) throw new Error(error.message ?? "Could not promote entry");
  const row = Array.isArray(data) ? data[0] : data;
  const r = row as { id: string; already_existed: boolean } | null;
  if (!r) throw new Error("Promotion returned no row");
  return { id: r.id, alreadyExisted: !!r.already_existed };
}

// ----- Identity resolution -----------------------------------------------

export async function getProjectMemberIdentities(
  projectId: string,
  userIds: string[],
): Promise<Map<string, ProjectMemberIdentity>> {
  const out = new Map<string, ProjectMemberIdentity>();
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (unique.length === 0) return out;
  const { data, error } = await rpc().rpc("get_project_member_identities", {
    _project_id: projectId,
    _user_ids: unique,
  });
  if (error) return out; // graceful — UI falls back to "Unknown writer"
  for (const row of (data ?? []) as ProjectMemberIdentity[]) {
    out.set(row.user_id, row);
  }
  return out;
}

// ----- Utils --------------------------------------------------------------

function clamp1to5(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(5, Math.round(n)));
}

export function computeEntryScores(
  votes: ArenaVoteRow[],
): Map<string, { count: number; total: number; average: number }> {
  const out = new Map<
    string,
    { count: number; total: number; average: number }
  >();
  for (const v of votes) {
    const total =
      v.score_originality +
      v.score_character_truth +
      v.score_cinematic_value +
      v.score_emotional_impact +
      v.score_craft;
    const prev = out.get(v.entry_id) ?? { count: 0, total: 0, average: 0 };
    prev.count += 1;
    prev.total += total;
    prev.average = prev.total / prev.count;
    out.set(v.entry_id, prev);
  }
  return out;
}
