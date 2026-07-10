/**
 * Arena Mode v1 — timed creative writing games.
 *
 * Data access + client fetchers. Lifecycle transitions (start/end/finalize)
 * go through SECURITY DEFINER RPCs on the database so a round can never be
 * left in a partial state.
 *
 * Arena data lives in its own tables. Nothing here mutates canonical
 * screenplay content — promotion into a script always flows through
 * `createSuggestion` in `@/lib/suggestions`.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  createSuggestion,
  type SuggestionType,
} from "@/lib/suggestions";

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
  judging_mode: "peer" | "host" | "panel" | "hybrid";
  entry_reveal: "named" | "blind_until_results";
  stakes: "practice" | "ranked" | "showcase";
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
  votes: (sessionId: string) => ["arena", "votes", sessionId] as const,
  awards: (projectId: string) => ["arena", "awards", projectId] as const,
  sessionAwards: (sessionId: string) =>
    ["arena", "awards", "session", sessionId] as const,
};

// Loose row shape returned by generic supabase reads on these new tables.
// The generated types file will pick these up on the next regeneration; we
// cast here so we compile cleanly today.
type Row = Record<string, unknown>;
type SB = typeof supabase;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as unknown as any).from(name) as any;

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
  rules?: Record<string, unknown>;
}

export async function createArenaSession(
  input: CreateArenaSessionInput,
): Promise<ArenaSessionRow> {
  const { data: userResp, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userResp?.user) throw userErr ?? new Error("Not signed in");
  const title = input.title.trim();
  const prompt = input.prompt.trim();
  if (!title) throw new Error("Give the round a title.");
  if (title.length > ARENA_LIMITS.title)
    throw new Error(`Title too long (max ${ARENA_LIMITS.title}).`);
  if (!prompt) throw new Error("Add a prompt for the round.");
  if (prompt.length > ARENA_LIMITS.prompt)
    throw new Error(`Prompt too long (max ${ARENA_LIMITS.prompt}).`);
  if (input.durationSeconds < 60 || input.durationSeconds > 3600)
    throw new Error("Duration must be between 1 and 60 minutes.");

  const { data, error } = await tbl("arena_sessions")
    .insert({
      project_id: input.projectId,
      created_by: userResp.user.id,
      title,
      mode: input.mode,
      prompt,
      duration_seconds: input.durationSeconds,
      rules: input.rules ?? {},
      status: "open",
    })
    .select("*")
    .single();
  if (error) throw error;

  // Auto-enroll the host as a writer so they can also compete.
  await tbl("arena_participants")
    .insert({
      session_id: (data as ArenaSessionRow).id,
      project_id: input.projectId,
      user_id: userResp.user.id,
      role: "writer",
    })
    .then((r: { error: unknown }) => {
      // ignore unique conflict if re-called
      if (
        r.error &&
        (r.error as { code?: string }).code &&
        (r.error as { code?: string }).code !== "23505"
      ) {
        // eslint-disable-next-line no-console
        console.warn("host auto-join failed", r.error);
      }
    });

  return data as ArenaSessionRow;
}

export async function archiveArenaSession(sessionId: string) {
  const { error } = await tbl("arena_sessions")
    .update({ status: "archived" })
    .eq("id", sessionId);
  if (error) throw error;
}

// ----- Lifecycle RPCs -----------------------------------------------------

export async function startArenaRound(
  sessionId: string,
): Promise<ArenaSessionRow> {
  const { data, error } = await (supabase as unknown as {
    rpc: (name: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  }).rpc("start_arena_round", { _session_id: sessionId });
  if (error) throw error as Error;
  return data as ArenaSessionRow;
}

export async function advanceArenaRoundIfDue(
  sessionId: string,
): Promise<ArenaSessionRow> {
  const { data, error } = await (supabase as unknown as {
    rpc: (name: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  }).rpc("advance_arena_round_if_due", { _session_id: sessionId });
  if (error) throw error as Error;
  return data as ArenaSessionRow;
}

export async function endArenaRound(
  sessionId: string,
): Promise<ArenaSessionRow> {
  const { data, error } = await (supabase as unknown as {
    rpc: (name: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  }).rpc("end_arena_round", { _session_id: sessionId });
  if (error) throw error as Error;
  return data as ArenaSessionRow;
}

export async function finalizeArenaRound(
  sessionId: string,
): Promise<ArenaSessionRow> {
  const { data, error } = await (supabase as unknown as {
    rpc: (name: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  }).rpc("finalize_arena_round", { _session_id: sessionId });
  if (error) throw error as Error;
  return data as ArenaSessionRow;
}

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
): Promise<void> {
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp?.user) throw new Error("Not signed in");
  const { error } = await tbl("arena_participants")
    .upsert(
      {
        session_id: session.id,
        project_id: session.project_id,
        user_id: userResp.user.id,
        role,
      },
      { onConflict: "session_id,user_id" },
    );
  if (error) throw error;
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
    if (error) throw error;
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
  if (error) throw error;
  return data as ArenaEntryRow;
}

export async function submitEntry(entryId: string): Promise<void> {
  const { error } = await tbl("arena_entries")
    .update({ status: "submitted", submitted_at: new Date().toISOString() })
    .eq("id", entryId)
    .eq("status", "draft");
  if (error) throw error;
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

export async function listVotes(sessionId: string): Promise<ArenaVoteRow[]> {
  const { data, error } = await tbl("arena_votes")
    .select("*")
    .eq("session_id", sessionId);
  if (error) throw error;
  return (data ?? []) as ArenaVoteRow[];
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
  session: Pick<ArenaSessionRow, "id" | "project_id">;
  entry: Pick<ArenaEntryRow, "id" | "author_id">;
  awardType: ArenaAwardType;
  title?: string | null;
}): Promise<ArenaAwardRow> {
  const { data, error } = await tbl("arena_awards")
    .insert({
      session_id: input.session.id,
      project_id: input.session.project_id,
      entry_id: input.entry.id,
      awarded_to: input.entry.author_id,
      award_type: input.awardType,
      title: input.title ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ArenaAwardRow;
}

// ----- Promote to Suggestions --------------------------------------------

/**
 * Promotes an Arena entry into the project's Suggestions queue. Never
 * writes to canonical script — the Suggestions flow owns any later
 * script mutation.
 *
 * Idempotency: guarded by checking existing suggestions with the same
 * arena metadata.
 */
export async function promoteEntryToSuggestion(input: {
  session: Pick<ArenaSessionRow, "id" | "project_id" | "title" | "mode">;
  entry: Pick<ArenaEntryRow, "id" | "author_id" | "title" | "body">;
  suggestionType?: Extract<SuggestionType, "structure_note" | "rewrite_scene">;
}) {
  const suggestionType = input.suggestionType ?? "structure_note";

  const { data: existing } = await tbl("suggestions")
    .select("id")
    .eq("project_id", input.session.project_id)
    .contains("metadata", {
      source: "arena",
      arena_session_id: input.session.id,
      arena_entry_id: input.entry.id,
    })
    .maybeSingle();

  if (existing) {
    return { id: (existing as { id: string }).id, alreadyExisted: true };
  }

  const created = await createSuggestion({
    projectId: input.session.project_id,
    suggestionType,
    source: "human",
    title:
      input.entry.title ??
      `Arena · ${input.session.title}`,
    rationale: `Promoted from Arena round "${input.session.title}" (${input.session.mode.replace("_", " ")}).`,
    after: {
      text: input.entry.body,
      arena_entry_title: input.entry.title,
    },
    metadata: {
      source: "arena",
      arena_session_id: input.session.id,
      arena_entry_id: input.entry.id,
      arena_original_author_id: input.entry.author_id,
    },
  });
  return { id: created.id, alreadyExisted: false };
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

// Suppress unused-linter friction on the generic helper alias
export type __SB = SB;
export type __Row = Row;
