/**
 * Phase 1 unified project story read model.
 *
 * Pure, additive read function that joins the previously disconnected
 * story islands (characters, candidates, evidence, bibles, scenes,
 * script blocks, world entities) into ONE typed contract. It never
 * writes and never mutates canon.
 *
 * Design notes (from the approved audit):
 * - `projects.user_id` is the real owner column (not `owner_id`).
 * - `story_universes` owns `owner_id`; projects link out via
 *   `projects.default_universe_id`.
 * - World entities are UNIVERSE-scoped, so multiple projects can share
 *   the same world. We surface universe-wide counts here and mark
 *   project-specific usage separately where applicable.
 * - Duplicate diagnostics are review-only proposals with confidence +
 *   reasonCode + evidence. Nothing auto-merges.
 * - The Bible membership for a character is expressed with an explicit
 *   `{ version, included }` shape so callers do not confuse
 *   project-wide version numbers with character-specific membership.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- pure helpers (exported for test) ----------

export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse a screenplay-style scene heading into a normalized location
 * label. Handles INT./EXT./I/E variations and " - " time-of-day
 * separators. Returns `null` when there is no discernible location.
 */
export function parseLocationFromHeading(
  heading: string | null | undefined,
): { rawText: string; normalizedKey: string } | null {
  if (!heading) return null;
  const raw = heading.trim();
  if (!raw) return null;
  // Strip INT/EXT prefix.
  const stripped = raw
    .replace(/^\s*(int\.?\/ext\.?|ext\.?\/int\.?|int\.?|ext\.?|i\.?\/e\.?)\s*[.\-:]?\s*/i, "")
    .trim();
  // Cut off first time-of-day/emotion suffix.
  const cut = stripped.split(/\s+[-–—]\s+/)[0]?.trim() ?? "";
  const rawText = cut || stripped || raw;
  const normalizedKey = normalizeName(rawText);
  if (!normalizedKey) return null;
  return { rawText, normalizedKey };
}

/**
 * Damerau-lite similarity for short names (0..1). Cheap and good enough
 * for candidate-duplicate diagnostics; NEVER used for automatic merges.
 */
export function nameSimilarity(a: string, b: string): number {
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.startsWith(y) || y.startsWith(x)) return 0.9;
  // Levenshtein
  const m = x.length;
  const n = y.length;
  const dp: number[] = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] =
        x[i - 1] === y[j - 1]
          ? prev
          : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  const dist = dp[n];
  const maxLen = Math.max(m, n);
  return 1 - dist / maxLen;
}

// ---------- contract ----------

export type CharacterSummary = {
  id: string;
  name: string;
  importance: string | null;
  quarantined: boolean;
  /**
   * `manual` = no promoted import candidate points at this character.
   * `imported` = at least one promoted candidate points at this character.
   * We cannot currently distinguish an imported-then-hand-edited from a
   * pure import without a `characters.origin` column, so we deliberately
   * omit `both` until that migration lands (Phase 3+).
   */
  source: "manual" | "imported";
  evidenceCount: number;
  aliasCount: number;
  relationshipCount: number;
  sceneStateCount: number;
  latestBible: { version: number; included: boolean } | null;
};

export type SceneSummary = {
  id: string;
  heading: string | null;
  orderIndex: number;
  /**
   * v1 usually produces zero or one entry, but the contract is an array
   * so future montage / dual-location parsers do not require a schema
   * change. Each entry is derived (not stored) and carries no truth.
   */
  detectedLocations: {
    rawText: string;
    normalizedKey: string;
    sourceBlockId: string | null;
    confidence: number;
  }[];
  linkedWorldLocationIds: string[];
  characters: {
    characterId: string;
    basis: "scene_state" | "dialogue" | "mention" | "manual";
  }[];
};

export type DuplicateProposal = {
  aId: string;
  bId: string;
  confidence: number;
  reasonCode: string;
  evidence: string[];
};

export type ProjectStoryIntelligence = {
  project: { id: string; title: string; userId: string };
  universe: { id: string | null; name: string | null; isDefault: boolean };

  characters: CharacterSummary[];
  relationships: {
    id: string;
    aId: string;
    bId: string;
    type: string | null;
  }[];

  scenes: SceneSummary[];

  sources: {
    id: string;
    title: string;
    status: string;
    candidateTotals: {
      pending: number;
      accepted: number;
      rejected: number;
      merged: number;
    };
  }[];

  candidates: {
    unresolved: number;
    byKind: Record<string, number>;
    duplicatesSuspected: number;
  };

  world: {
    locations: {
      count: number;
      withoutEvidence: number;
      withoutSceneLink: number;
    };
    factions: { count: number; withoutEvidence: number };
    events: { count: number; withoutEvidence: number };
    rules: { count: number };
    artifacts: { count: number };
    threads: { count: number };
    timeline: { count: number; linkedToEvent: number };
  };

  bibles: {
    latestVersion: number | null;
    versions: { version: number; createdAt: string }[];
  };

  diagnostics: {
    manualCharactersMissingFromBible: string[];
    importedCandidatesUnresolved: string[];
    sceneLocationsWithoutWorldLink: string[];
    worldEntitiesWithoutEvidence: { table: string; id: string }[];
    possibleCharacterDuplicates: DuplicateProposal[];
    possibleLocationDuplicates: DuplicateProposal[];
  };
};

// ---------- pure assembler (exported for test) ----------

export type AssemblerInput = {
  project: { id: string; title: string; user_id: string };
  universe: { id: string; name: string } | null;
  characters: {
    id: string;
    name: string;
    importance: string | null;
    quarantined_at: string | null;
  }[];
  aliases: { character_id: string }[];
  relationships: {
    id: string;
    character_id: string;
    related_character_id: string;
    relationship_type: string | null;
  }[];
  sceneStates: { character_id: string; scene_id: string }[];
  scenes: {
    id: string;
    scene_heading: string | null;
    order_index: number;
  }[];
  scriptBlocks: {
    scene_id: string;
    block_type: string;
    character_id: string | null;
    id: string;
    content: string | null;
  }[];
  sources: { id: string; title: string; status: string }[];
  candidates: {
    id: string;
    candidate_type: string;
    normalized_key: string;
    status: string;
    document_id: string | null;
    promoted_ref: { table?: string; id?: string } | null;
    proposed_payload: Record<string, unknown> | null;
  }[];
  evidence: { candidate_id: string }[];
  worldLocations: { id: string; name: string; normalized_key: string; candidate_id: string | null }[];
  worldFactions: { id: string; candidate_id: string | null }[];
  worldEvents: { id: string; candidate_id: string | null }[];
  worldRules: { id: string }[];
  worldArtifacts: { id: string }[];
  worldThreads: { id: string }[];
  worldTimeline: { id: string; event_id: string | null }[];
  bibles: { version: number; created_at: string; entries: unknown }[];
};

export function assembleStoryIntelligence(
  input: AssemblerInput,
): ProjectStoryIntelligence {
  const {
    project,
    universe,
    characters,
    aliases,
    relationships,
    sceneStates,
    scenes,
    scriptBlocks,
    sources,
    candidates,
    evidence,
    worldLocations,
    worldFactions,
    worldEvents,
    worldRules,
    worldArtifacts,
    worldThreads,
    worldTimeline,
    bibles,
  } = input;

  // Evidence per candidate, so we can attribute counts to characters.
  const evidenceByCandidate = new Map<string, number>();
  for (const e of evidence) {
    evidenceByCandidate.set(
      e.candidate_id,
      (evidenceByCandidate.get(e.candidate_id) ?? 0) + 1,
    );
  }

  // Candidates that promote to a character id.
  const candidatesByCharacterId = new Map<string, typeof candidates>();
  for (const c of candidates) {
    if (c.promoted_ref?.table === "characters" && c.promoted_ref.id) {
      const list = candidatesByCharacterId.get(c.promoted_ref.id) ?? [];
      list.push(c);
      candidatesByCharacterId.set(c.promoted_ref.id, list);
    }
  }

  const aliasCounts = new Map<string, number>();
  for (const a of aliases) {
    aliasCounts.set(a.character_id, (aliasCounts.get(a.character_id) ?? 0) + 1);
  }
  const relCounts = new Map<string, number>();
  for (const r of relationships) {
    relCounts.set(r.character_id, (relCounts.get(r.character_id) ?? 0) + 1);
    relCounts.set(
      r.related_character_id,
      (relCounts.get(r.related_character_id) ?? 0) + 1,
    );
  }
  const sceneStateCounts = new Map<string, number>();
  for (const s of sceneStates) {
    sceneStateCounts.set(
      s.character_id,
      (sceneStateCounts.get(s.character_id) ?? 0) + 1,
    );
  }

  // Latest bible = highest version.
  const sortedBibles = [...bibles].sort((a, b) => b.version - a.version);
  const latestBible = sortedBibles[0] ?? null;
  const latestBibleCharIds = new Set<string>();
  if (latestBible && Array.isArray(latestBible.entries)) {
    for (const entry of latestBible.entries as { character_id?: string }[]) {
      if (entry?.character_id) latestBibleCharIds.add(entry.character_id);
    }
  }

  const characterSummaries: CharacterSummary[] = characters.map((c) => {
    const cands = candidatesByCharacterId.get(c.id) ?? [];
    const evidenceCount = cands.reduce(
      (sum, cand) => sum + (evidenceByCandidate.get(cand.id) ?? 0),
      0,
    );
    return {
      id: c.id,
      name: c.name,
      importance: c.importance,
      quarantined: c.quarantined_at !== null,
      source: cands.length > 0 ? "imported" : "manual",
      evidenceCount,
      aliasCount: aliasCounts.get(c.id) ?? 0,
      relationshipCount: relCounts.get(c.id) ?? 0,
      sceneStateCount: sceneStateCounts.get(c.id) ?? 0,
      latestBible: latestBible
        ? {
            version: latestBible.version,
            included: latestBibleCharIds.has(c.id),
          }
        : null,
    };
  });

  // Scene-character basis. `scene_state` and `dialogue` are trustworthy;
  // `mention` requires future name resolution and is left off in v1.
  const sceneCharBasis = new Map<
    string,
    Map<string, "scene_state" | "dialogue" | "mention" | "manual">
  >();
  for (const s of sceneStates) {
    const m = sceneCharBasis.get(s.scene_id) ?? new Map();
    if (!m.has(s.character_id)) m.set(s.character_id, "scene_state");
    sceneCharBasis.set(s.scene_id, m);
  }
  for (const b of scriptBlocks) {
    if (!b.character_id) continue;
    if (b.block_type !== "character" && b.block_type !== "dialogue") continue;
    const m = sceneCharBasis.get(b.scene_id) ?? new Map();
    // Never downgrade a scene_state to dialogue.
    if (!m.has(b.character_id)) m.set(b.character_id, "dialogue");
    sceneCharBasis.set(b.scene_id, m);
  }

  // Scene → detected location(s), linked via normalized_key.
  const worldLocByKey = new Map<string, string[]>();
  for (const l of worldLocations) {
    const list = worldLocByKey.get(l.normalized_key) ?? [];
    list.push(l.id);
    worldLocByKey.set(l.normalized_key, list);
  }

  // Heading block per scene, so we can attribute detection to a block.
  const headingBlockByScene = new Map<string, string>();
  for (const b of scriptBlocks) {
    if (b.block_type === "scene_heading" && !headingBlockByScene.has(b.scene_id)) {
      headingBlockByScene.set(b.scene_id, b.id);
    }
  }

  const sceneSummaries: SceneSummary[] = scenes.map((s) => {
    const parsed = parseLocationFromHeading(s.scene_heading);
    const detectedLocations = parsed
      ? [
          {
            rawText: parsed.rawText,
            normalizedKey: parsed.normalizedKey,
            sourceBlockId: headingBlockByScene.get(s.id) ?? null,
            confidence: 0.9,
          },
        ]
      : [];
    const linkedWorldLocationIds: string[] = [];
    for (const dl of detectedLocations) {
      const matches = worldLocByKey.get(dl.normalizedKey);
      if (matches) linkedWorldLocationIds.push(...matches);
    }
    const charMap = sceneCharBasis.get(s.id) ?? new Map();
    return {
      id: s.id,
      heading: s.scene_heading,
      orderIndex: s.order_index,
      detectedLocations,
      linkedWorldLocationIds,
      characters: Array.from(charMap.entries()).map(
        ([characterId, basis]) => ({ characterId, basis }),
      ),
    };
  });

  // Source candidate totals.
  const candByDoc = new Map<
    string,
    { pending: number; accepted: number; rejected: number; merged: number }
  >();
  for (const c of candidates) {
    if (!c.document_id) continue;
    const t =
      candByDoc.get(c.document_id) ??
      { pending: 0, accepted: 0, rejected: 0, merged: 0 };
    if (c.status === "pending") t.pending++;
    else if (c.status === "accepted" || c.status === "approved") t.accepted++;
    else if (c.status === "rejected") t.rejected++;
    else if (c.status === "merged") t.merged++;
    candByDoc.set(c.document_id, t);
  }

  const sourceSummaries = sources.map((s) => ({
    id: s.id,
    title: s.title,
    status: s.status,
    candidateTotals:
      candByDoc.get(s.id) ??
      { pending: 0, accepted: 0, rejected: 0, merged: 0 },
  }));

  // Candidate breakdown.
  const unresolvedCandidates = candidates.filter((c) => c.status === "pending");
  const byKind: Record<string, number> = {};
  for (const c of unresolvedCandidates) {
    byKind[c.candidate_type] = (byKind[c.candidate_type] ?? 0) + 1;
  }

  // World counts.
  const worldLocationsWithoutEvidence = worldLocations.filter(
    (l) => !l.candidate_id,
  ).length;
  const worldLocationsWithoutSceneLink = worldLocations.filter((l) => {
    return !sceneSummaries.some((s) => s.linkedWorldLocationIds.includes(l.id));
  }).length;

  // Duplicate diagnostics (proposals only — REVIEW, never auto-merge).
  const possibleCharacterDuplicates: DuplicateProposal[] = [];
  for (let i = 0; i < characterSummaries.length; i++) {
    for (let j = i + 1; j < characterSummaries.length; j++) {
      const a = characterSummaries[i];
      const b = characterSummaries[j];
      const sim = nameSimilarity(a.name, b.name);
      if (sim >= 0.85) {
        possibleCharacterDuplicates.push({
          aId: a.id,
          bId: b.id,
          confidence: Number(sim.toFixed(2)),
          reasonCode: "normalized_name_similarity",
          evidence: [a.name, b.name],
        });
      }
    }
  }

  const possibleLocationDuplicates: DuplicateProposal[] = [];
  for (let i = 0; i < worldLocations.length; i++) {
    for (let j = i + 1; j < worldLocations.length; j++) {
      const a = worldLocations[i];
      const b = worldLocations[j];
      if (a.normalized_key && a.normalized_key === b.normalized_key) {
        possibleLocationDuplicates.push({
          aId: a.id,
          bId: b.id,
          confidence: 0.99,
          reasonCode: "normalized_key_collision",
          evidence: [a.name, b.name],
        });
      }
    }
  }

  const manualCharactersMissingFromBible = latestBible
    ? characterSummaries
        .filter((c) => !c.quarantined && !c.latestBible?.included)
        .map((c) => c.id)
    : characterSummaries.filter((c) => !c.quarantined).map((c) => c.id);

  const importedCandidatesUnresolved = unresolvedCandidates
    .filter((c) => c.candidate_type === "character")
    .map((c) => c.id);

  const sceneLocationsWithoutWorldLink = sceneSummaries
    .filter(
      (s) =>
        s.detectedLocations.length > 0 && s.linkedWorldLocationIds.length === 0,
    )
    .map((s) => s.id);

  const worldEntitiesWithoutEvidence: { table: string; id: string }[] = [];
  for (const l of worldLocations) {
    if (!l.candidate_id)
      worldEntitiesWithoutEvidence.push({ table: "world_locations", id: l.id });
  }
  for (const f of worldFactions) {
    if (!f.candidate_id)
      worldEntitiesWithoutEvidence.push({ table: "world_factions", id: f.id });
  }
  for (const e of worldEvents) {
    if (!e.candidate_id)
      worldEntitiesWithoutEvidence.push({ table: "world_events", id: e.id });
  }

  return {
    project: {
      id: project.id,
      title: project.title,
      userId: project.user_id,
    },
    universe: {
      id: universe?.id ?? null,
      name: universe?.name ?? null,
      isDefault: universe !== null,
    },
    characters: characterSummaries,
    relationships: relationships.map((r) => ({
      id: r.id,
      aId: r.character_id,
      bId: r.related_character_id,
      type: r.relationship_type,
    })),
    scenes: sceneSummaries,
    sources: sourceSummaries,
    candidates: {
      unresolved: unresolvedCandidates.length,
      byKind,
      duplicatesSuspected:
        possibleCharacterDuplicates.length + possibleLocationDuplicates.length,
    },
    world: {
      locations: {
        count: worldLocations.length,
        withoutEvidence: worldLocationsWithoutEvidence,
        withoutSceneLink: worldLocationsWithoutSceneLink,
      },
      factions: {
        count: worldFactions.length,
        withoutEvidence: worldFactions.filter((f) => !f.candidate_id).length,
      },
      events: {
        count: worldEvents.length,
        withoutEvidence: worldEvents.filter((e) => !e.candidate_id).length,
      },
      rules: { count: worldRules.length },
      artifacts: { count: worldArtifacts.length },
      threads: { count: worldThreads.length },
      timeline: {
        count: worldTimeline.length,
        linkedToEvent: worldTimeline.filter((t) => t.event_id !== null).length,
      },
    },
    bibles: {
      latestVersion: latestBible?.version ?? null,
      versions: sortedBibles.map((b) => ({
        version: b.version,
        createdAt: b.created_at,
      })),
    },
    diagnostics: {
      manualCharactersMissingFromBible,
      importedCandidatesUnresolved,
      sceneLocationsWithoutWorldLink,
      worldEntitiesWithoutEvidence,
      possibleCharacterDuplicates,
      possibleLocationDuplicates,
    },
  };
}

// ---------- server function ----------

const Input = z.object({ projectId: z.string().uuid() });

export const getProjectStoryIntelligence = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const projectId = data.projectId;

    const { data: project, error: pErr } = await supabase
      .from("projects")
      .select("id, title, user_id, default_universe_id")
      .eq("id", projectId)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!project) throw new Error("Project not found");

    let universe: { id: string; name: string } | null = null;
    if (project.default_universe_id) {
      const { data: u } = await supabase
        .from("story_universes")
        .select("id, name")
        .eq("id", project.default_universe_id)
        .maybeSingle();
      if (u) universe = { id: u.id as string, name: u.name as string };
    }

    // Project-scoped reads.
    const [
      chars,
      scenes,
      sources,
      bibles,
    ] = await Promise.all([
      supabase
        .from("characters")
        .select("id, name, importance, quarantined_at")
        .eq("project_id", projectId),
      supabase
        .from("scenes")
        .select("id, scene_heading, order_index")
        .eq("project_id", projectId)
        .order("order_index", { ascending: true }),
      supabase
        .from("source_documents")
        .select("id, title, status")
        .eq("project_id", projectId),
      supabase
        .from("character_bibles")
        .select("version, created_at, entries")
        .eq("project_id", projectId)
        .order("version", { ascending: false }),
    ]);
    for (const q of [chars, scenes, sources, bibles]) {
      if (q.error) throw q.error;
    }

    const characterIds = (chars.data ?? []).map((c) => c.id as string);
    const sceneIds = (scenes.data ?? []).map((s) => s.id as string);

    const [aliases, relationships, sceneStates, scriptBlocks] =
      await Promise.all([
        characterIds.length
          ? supabase
              .from("character_aliases")
              .select("character_id")
              .in("character_id", characterIds)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from("character_relationships")
          .select("id, character_id, related_character_id, relationship_type")
          .eq("project_id", projectId),
        characterIds.length
          ? supabase
              .from("character_scene_states")
              .select("character_id, scene_id")
              .in("character_id", characterIds)
          : Promise.resolve({ data: [], error: null }),
        sceneIds.length
          ? supabase
              .from("script_blocks")
              .select("id, scene_id, block_type, character_id, content")
              .in("scene_id", sceneIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
    for (const q of [aliases, relationships, sceneStates, scriptBlocks]) {
      if ((q as any).error) throw (q as any).error;
    }

    // Universe-scoped reads.
    let candidates: any[] = [];
    let evidence: any[] = [];
    let worldLocations: any[] = [];
    let worldFactions: any[] = [];
    let worldEvents: any[] = [];
    let worldRules: any[] = [];
    let worldArtifacts: any[] = [];
    let worldThreads: any[] = [];
    let worldTimeline: any[] = [];
    if (universe) {
      const uid = universe.id;
      const [c, wl, wf, we, wr, wa, wt, wtl] = await Promise.all([
        supabase
          .from("import_candidates")
          .select(
            "id, candidate_type, normalized_key, status, document_id, promoted_ref, proposed_payload",
          )
          .eq("universe_id", uid),
        supabase
          .from("world_locations")
          .select("id, name, normalized_key, candidate_id")
          .eq("universe_id", uid),
        supabase
          .from("world_factions")
          .select("id, candidate_id")
          .eq("universe_id", uid),
        supabase
          .from("world_events")
          .select("id, candidate_id")
          .eq("universe_id", uid),
        supabase.from("world_rules").select("id").eq("universe_id", uid),
        supabase.from("world_artifacts").select("id").eq("universe_id", uid),
        supabase.from("world_threads").select("id").eq("universe_id", uid),
        supabase
          .from("world_timeline_entries")
          .select("id, event_id")
          .eq("universe_id", uid),
      ]);
      for (const q of [c, wl, wf, we, wr, wa, wt, wtl]) {
        if (q.error) throw q.error;
      }
      candidates = c.data ?? [];
      worldLocations = wl.data ?? [];
      worldFactions = wf.data ?? [];
      worldEvents = we.data ?? [];
      worldRules = wr.data ?? [];
      worldArtifacts = wa.data ?? [];
      worldThreads = wt.data ?? [];
      worldTimeline = wtl.data ?? [];
      if (candidates.length) {
        const { data: ev, error: eErr } = await supabase
          .from("import_evidence")
          .select("candidate_id")
          .in(
            "candidate_id",
            candidates.map((c) => c.id),
          );
        if (eErr) throw eErr;
        evidence = ev ?? [];
      }
    }

    return assembleStoryIntelligence({
      project: project as any,
      universe,
      characters: (chars.data ?? []) as any,
      aliases: (aliases as any).data ?? [],
      relationships: (relationships as any).data ?? [],
      sceneStates: (sceneStates as any).data ?? [],
      scenes: (scenes.data ?? []) as any,
      scriptBlocks: (scriptBlocks as any).data ?? [],
      sources: (sources.data ?? []) as any,
      candidates,
      evidence,
      worldLocations,
      worldFactions,
      worldEvents,
      worldRules,
      worldArtifacts,
      worldThreads,
      worldTimeline,
      bibles: (bibles.data ?? []) as any,
    });
  });
