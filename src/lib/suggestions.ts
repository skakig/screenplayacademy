/**
 * Writers' Room — Suggestions data-access (Pass 5).
 *
 * Suggestions are the "propose, review, approve" layer. Canonical script
 * content is never silently overwritten — only safe types are applied when
 * an authorized user accepts. Risky types are reviewable only.
 *
 * RLS is enforced server-side by the `suggestions` table policies and the
 * SECURITY DEFINER helpers `can_view_suggestions`, `can_create_suggestion`,
 * `can_accept_suggestion`, `can_reject_suggestion`, `can_archive_suggestion`.
 *
 * TODO (later pass): when `change_events` exists, log
 *   suggestion.{created,accepted,rejected,archived,applied_to_script,accepted_without_script_change}
 * from the matching call sites below.
 */
import { supabase } from "@/integrations/supabase/client";

export type SuggestionStatus = "open" | "accepted" | "rejected" | "archived";

export type SuggestionSource =
  | "human"
  | "ai"
  | "import_diagnostic"
  | "script_brain"
  | "table_read";

export type SuggestionType =
  | "replace_block_text"
  | "insert_block_after"
  | "delete_block"
  | "change_block_type"
  | "rewrite_scene"
  | "character_note"
  | "structure_note"
  | "continuity_fix"
  | "pitch_deck_note";

/** Types whose acceptance currently mutates the canonical script. */
export const APPLYABLE_TYPES: ReadonlyArray<SuggestionType> = [
  "replace_block_text",
];

/** Note-style types that are marked accepted without script mutation. */
export const NOTE_TYPES: ReadonlyArray<SuggestionType> = [
  "character_note",
  "structure_note",
  "continuity_fix",
  "pitch_deck_note",
];

export interface SuggestionRow {
  id: string;
  project_id: string;
  scene_id: string | null;
  script_block_id: string | null;
  author_id: string | null;
  source: SuggestionSource;
  suggestion_type: SuggestionType;
  status: SuggestionStatus;
  title: string | null;
  rationale: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
  accepted_by: string | null;
  accepted_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  applied_to_canonical: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export const suggestionKeys = {
  all: (projectId: string) => ["suggestions", "project", projectId] as const,
  status: (projectId: string, status: SuggestionStatus) =>
    ["suggestions", "project", projectId, status] as const,
};

const SUGGESTION_COLUMNS =
  "id, project_id, scene_id, script_block_id, author_id, source, suggestion_type, status, title, rationale, before, after, accepted_by, accepted_at, rejected_by, rejected_at, applied_to_canonical, metadata, created_at, updated_at";

export async function fetchSuggestions(
  projectId: string,
  status: SuggestionStatus,
): Promise<SuggestionRow[]> {
  const ascending = status === "open";
  const { data, error } = await supabase
    .from("suggestions")
    .select(SUGGESTION_COLUMNS)
    .eq("project_id", projectId)
    .eq("status", status)
    .order("created_at", { ascending });
  if (error) throw error;
  return (data ?? []) as SuggestionRow[];
}

// ----- Create -------------------------------------------------------------

export const SUGGESTION_LIMITS = {
  title: 160,
  rationale: 5000,
  text: 10000,
} as const;

export interface CreateSuggestionInput {
  projectId: string;
  sceneId?: string | null;
  scriptBlockId?: string | null;
  suggestionType: SuggestionType;
  source?: SuggestionSource;
  title?: string | null;
  rationale?: string | null;
  before?: Record<string, unknown> | null;
  after: Record<string, unknown>;
  metadata?: Record<string, unknown> | null;
}

function trimOrNull(s: string | null | undefined): string | null {
  if (!s) return null;
  const v = s.trim();
  return v.length ? v : null;
}

export async function createSuggestion(input: CreateSuggestionInput) {
  const { data: userResp, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userResp?.user) throw userErr ?? new Error("Not signed in");

  const title = trimOrNull(input.title ?? null);
  const rationale = trimOrNull(input.rationale ?? null);

  if (title && title.length > SUGGESTION_LIMITS.title) {
    throw new Error(`Title is too long (max ${SUGGESTION_LIMITS.title})`);
  }
  if (rationale && rationale.length > SUGGESTION_LIMITS.rationale) {
    throw new Error(
      `Rationale is too long (max ${SUGGESTION_LIMITS.rationale})`,
    );
  }

  const afterText =
    typeof (input.after as { text?: unknown }).text === "string"
      ? ((input.after as { text: string }).text as string)
      : null;
  if (afterText && afterText.length > SUGGESTION_LIMITS.text) {
    throw new Error(`Suggested text is too long (max ${SUGGESTION_LIMITS.text})`);
  }
  if (!afterText && !title && !rationale) {
    throw new Error("Suggestion cannot be empty");
  }

  const { data, error } = await supabase
    .from("suggestions")
    .insert({
      project_id: input.projectId,
      scene_id: input.sceneId ?? null,
      script_block_id: input.scriptBlockId ?? null,
      author_id: userResp.user.id,
      source: input.source ?? "human",
      suggestion_type: input.suggestionType,
      status: "open",
      title,
      rationale,
      // jsonb columns: cast through unknown to satisfy generated Json type.
      before: (input.before ?? null) as unknown as never,
      after: input.after as unknown as never,
      metadata: (input.metadata ?? null) as unknown as never,
    })
    .select(SUGGESTION_COLUMNS)
    .single();
  if (error) throw error;
  return data as SuggestionRow;
}

// ----- Reject / Archive ---------------------------------------------------

export async function rejectSuggestion(id: string) {
  const { data: userResp } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("suggestions")
    .update({
      status: "rejected",
      rejected_by: userResp?.user?.id ?? null,
      rejected_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "open");
  if (error) throw error;
}

export async function archiveSuggestion(id: string) {
  const { error } = await supabase
    .from("suggestions")
    .update({ status: "archived" })
    .eq("id", id);
  if (error) throw error;
}

// ----- Accept -------------------------------------------------------------

export class SuggestionLockedError extends Error {
  lockedById: string;
  constructor(lockedById: string) {
    super("LOCKED_BY_OTHER");
    this.lockedById = lockedById;
  }
}

export class SuggestionTargetMissingError extends Error {
  constructor() {
    super("TARGET_MISSING");
  }
}

async function activeLockForScene(sceneId: string) {
  const { data, error } = await supabase
    .from("scene_locks")
    .select("id, locked_by, released_at, expires_at")
    .eq("scene_id", sceneId)
    .is("released_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  // Treat expired locks as not active.
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    return null;
  }
  return data;
}

/**
 * Accepts a suggestion. For `replace_block_text` on an unlocked scene
 * (or one locked by the current user), updates `script_blocks.content`.
 * For note-style types, marks accepted without script mutation. Risky
 * types are accepted-for-planning only.
 */
export async function acceptSuggestion(suggestion: SuggestionRow) {
  const { data: userResp, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userResp?.user) throw userErr ?? new Error("Not signed in");
  const userId = userResp.user.id;

  // Re-fetch to confirm still open.
  const { data: fresh, error: freshErr } = await supabase
    .from("suggestions")
    .select(SUGGESTION_COLUMNS)
    .eq("id", suggestion.id)
    .single();
  if (freshErr) throw freshErr;
  const current = fresh as SuggestionRow;
  if (current.status !== "open") {
    throw new Error("This suggestion is no longer open.");
  }

  let appliedToCanonical = false;

  if (current.suggestion_type === "replace_block_text") {
    const after = current.after as { block_id?: string; text?: string };
    const blockId = after?.block_id ?? current.script_block_id ?? null;
    const newText = typeof after?.text === "string" ? after.text : null;

    if (!blockId || newText === null) {
      // Mal-formed payload: accept as planning only.
    } else {
      const { data: block, error: blockErr } = await supabase
        .from("script_blocks")
        .select("id, scene_id, content")
        .eq("id", blockId)
        .maybeSingle();
      if (blockErr) throw blockErr;
      if (!block) throw new SuggestionTargetMissingError();

      const sceneId = block.scene_id ?? current.scene_id ?? null;
      if (sceneId) {
        const lock = await activeLockForScene(sceneId);
        if (lock && lock.locked_by !== userId) {
          throw new SuggestionLockedError(lock.locked_by);
        }
      }

      const { error: updErr } = await supabase
        .from("script_blocks")
        .update({ content: newText })
        .eq("id", blockId);
      if (updErr) throw updErr;
      appliedToCanonical = true;
    }
  }

  // All other types (notes + risky) are accepted as a review decision;
  // they do not auto-mutate the canonical script in this pass.

  const { error: acceptErr } = await supabase
    .from("suggestions")
    .update({
      status: "accepted",
      accepted_by: userId,
      accepted_at: new Date().toISOString(),
      applied_to_canonical: appliedToCanonical,
    })
    .eq("id", current.id)
    .eq("status", "open");
  if (acceptErr) throw acceptErr;

  return { appliedToCanonical };
}

// ----- Helpers ------------------------------------------------------------

export function isApplyableType(type: SuggestionType): boolean {
  return APPLYABLE_TYPES.includes(type);
}

export function isNoteType(type: SuggestionType): boolean {
  return NOTE_TYPES.includes(type);
}
