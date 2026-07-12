// Pure promotion planner extracted from `promoteApprovedCharactersForDocument`.
//
// Given a list of approved character candidates and a way to look up existing
// characters by name, returns the resolution decisions the server function
// applies. Kept side-effect-free so idempotency and lineage guarantees can be
// verified without a live database.
//
// Doctrine: docs/ITS_PfHU_Importation.md §4.4 (non-destructive identity),
// §5.4 (resolved entity map).

export type CandidateInput = {
  id: string;
  normalized_key: string;
  proposed_payload: { name?: string; importance?: string } | null;
  promoted_ref: { table?: string; id?: string } | null;
};

export type ExistingCharacter = { id: string; name: string };

export type PromotionAction =
  | {
      kind: "reuse_ref";
      candidate_id: string;
      character_id: string;
      name: string;
      created: false;
    }
  | {
      kind: "reuse_existing";
      candidate_id: string;
      character_id: string;
      name: string;
      created: false;
    }
  | {
      kind: "reuse_in_batch";
      candidate_id: string;
      character_id: string;
      name: string;
      created: false;
    }
  | {
      kind: "create";
      candidate_id: string;
      character_id: string;
      name: string;
      importance: string;
      created: true;
    };

export type PromotionPlan = {
  actions: PromotionAction[];
  candidateToCharacter: Map<string, string>;
  nameKeyToCharacter: Map<string, { id: string; name: string }>;
};

const finalNameFor = (c: CandidateInput): string =>
  (c.proposed_payload?.name?.trim() || c.normalized_key || "").trim();

const keyFor = (name: string): string => name.trim().toUpperCase();

export function planPromotions(
  candidates: CandidateInput[],
  findExistingByName: (name: string) => ExistingCharacter | null,
  newCharacterId: () => string,
): PromotionPlan {
  const actions: PromotionAction[] = [];
  const candidateToCharacter = new Map<string, string>();
  const nameKeyToCharacter = new Map<string, { id: string; name: string }>();

  for (const cand of candidates) {
    const name = finalNameFor(cand);
    const key = keyFor(name);

    // 1. Existing promoted_ref wins — never re-mint an id for a promoted candidate.
    if (
      cand.promoted_ref?.table === "characters" &&
      cand.promoted_ref.id
    ) {
      const id = cand.promoted_ref.id;
      candidateToCharacter.set(cand.id, id);
      nameKeyToCharacter.set(key, { id, name });
      actions.push({
        kind: "reuse_ref",
        candidate_id: cand.id,
        character_id: id,
        name,
        created: false,
      });
      continue;
    }

    // 2. Two candidates in the same batch that resolve to the same name share
    //    the character we just created / looked up.
    const inBatch = nameKeyToCharacter.get(key);
    if (inBatch) {
      candidateToCharacter.set(cand.id, inBatch.id);
      actions.push({
        kind: "reuse_in_batch",
        candidate_id: cand.id,
        character_id: inBatch.id,
        name: inBatch.name,
        created: false,
      });
      continue;
    }

    // 3. An active character with the same normalized name already exists.
    const existing = findExistingByName(name);
    if (existing) {
      candidateToCharacter.set(cand.id, existing.id);
      nameKeyToCharacter.set(key, { id: existing.id, name: existing.name });
      actions.push({
        kind: "reuse_existing",
        candidate_id: cand.id,
        character_id: existing.id,
        name: existing.name,
        created: false,
      });
      continue;
    }

    // 4. Fresh character.
    const id = newCharacterId();
    candidateToCharacter.set(cand.id, id);
    nameKeyToCharacter.set(key, { id, name });
    actions.push({
      kind: "create",
      candidate_id: cand.id,
      character_id: id,
      name,
      importance: cand.proposed_payload?.importance ?? "unassigned",
      created: true,
    });
  }

  return { actions, candidateToCharacter, nameKeyToCharacter };
}
