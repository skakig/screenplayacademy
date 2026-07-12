# ITS/PfHU Importation — Systematic Implementation Plan

## Where we stand today (audit)

What exists:

- `import_sessions` + `import_block_candidates` (screenplay-only, single-file, one-session-per-upload).
- `src/lib/import/*` — parser, extractors, diagnose, commit into project blocks.
- `src/components/import/ImportWizard.tsx` (966 lines) — one-shot screenplay wizard.
- `src/lib/its/*` — `writerEvents`, `writerProfile`, `coachRecommendations` (event-driven learner profile only).

What does NOT exist yet (measured against the doc):

- Universe / corpus / multi-document model.
- Durable source preservation (`source_documents`, `source_segments`, checksums, rights metadata, storage buckets).
- Typed `import_candidates` beyond screenplay blocks (characters, aliases, world, relationships, threads).
- `import_evidence` with segment citations.
- `import_identity_decisions` (Keep Separate memory).
- `source_authority_rules` and contradiction/retcon classification.
- `series_knowledge_nodes` + `writer_knowledge_state` (ITS map).
- PfHU continuation package and role-aware onboarding.
- Editorial Review (evidence-backed draft comparison).
- Provider-neutral adapter contracts (parse / OCR / transcription / extract / embed).
- Import Center UX (setup → dashboard → Review Inbox → Continuation Dashboard).

The existing screenplay import is exactly the "screenplay-only import schema" the doctrine warns against. It stays as a fast path but must be re-wired to write through the new corpus + candidate + evidence spine — never directly into canon tables.

## Guiding contracts (apply to every phase)

- Preserve source before interpreting. Every derived claim links to a `source_segment_id`.
- Candidates, never automatic canon. All Character Bible / World Graph writes go through a review + promotion step.
- Provider-neutral adapters. No provider name in a canonical column; adapters are swappable.
- Local-first Writer's Desk. All import work runs in `createServerFn` handlers or background jobs, never in the typing path.
- Cost idempotency. Every stage keyed by `checksum + extractor_version + policy_version`; retry re-uses cached stages.
- Rights + RLS. `source_documents.rights_status` required at upload; RLS on every new table; `service_role` only inside handlers.
- i18n keys, not literal strings, for every Import Center surface.

## Phase 0 — Foundations (repo audit + provider-neutral contracts)

Deliverables:

- `docs/lovable/ITS_IMPORTATION_AUDIT.md` — current capabilities, gaps, migration map from `import_sessions` → new corpus spine.
- `src/lib/importation/contracts/` — TypeScript interfaces for `DocumentParser`, `Transcriber`, `Segmenter`, `EntityExtractor`, `IdentityResolver`, `EmbeddingProvider`, `ContinuityAnalyzer`. Each returns typed output; no provider leaks into callers.
- Wire the existing screenplay parser as the first `DocumentParser` adapter behind the new contract, unchanged behavior.

Acceptance: audit doc merged; unit tests instantiate two mock adapters against the same contract.

## Phase 1 — Source preservation + segmentation spine

New tables (all `public`, all with GRANT + RLS + policies scoped by `project_id`/`universe_id` membership):

- `story_universes` (project may belong to a universe; default one-per-project).
- `source_corpora`, `source_documents`, `source_segments`, `source_versions`.
- `import_extraction_runs` (checksum-keyed, cost + provider + policy_version metadata).

Storage:

- Private bucket `source-documents`; durable path `universe/{id}/document/{sha256}`; short-lived signed URLs only.

Server functions (`src/lib/importation/*.functions.ts`):

- `createSourceDocument` (rights attestation required), `listSources`, `getSourceSegments`, `retryStage`.
- Segmenter runs after parse; produces typed `source_segments` (scene / block / chapter / paragraph / timestamp).

UI: `/import/$projectId` Import Center shell with Upload → Rights → Parsed → Segmented status per document. **No** candidate creation yet.

Acceptance test 19.1 passes: original file retained, checksum recorded, scenes+blocks segmented, no canonical character/world row created.

## Phase 2 — Character candidates + identity resolution

Tables: `import_candidates` (typed: `character | alias | relationship | ...`), `import_evidence`, `import_identity_decisions`.

Adapters: `EntityExtractor` (LLM via Lovable AI Gateway) + deterministic speaker-label extractor for screenplays. Cached by `(document_checksum, extractor_version)`.

Server functions: `runCharacterExtraction`, `listCandidates`, `groupIdentity`, `keepSeparate`, `promoteCharacterCandidate` (writes into existing Character candidate lifecycle, not canonical fields).

UI: Review Inbox tab — Character candidates with evidence excerpts, alias groups, Keep Separate memory.

Acceptance: 19.2 (Hans variants grouped, not auto-merged), 19.3 (two Johns stay separate).

## Phase 3 — World, relationship, and story candidates

Extend `import_candidates` with `location | faction | rule | event | artifact | thread | relationship | belief`. Feed into World Review Inbox (create `world_candidates` view over `import_candidates`).

Belief vs canon: `evidence_type` includes `character_belief | rumor | objective_narration | production_note`. Location-state changes only promote when `evidence_type = objective_narration`.

Acceptance: 19.4 passes (false claim proposes belief, not location change).

## Phase 4 — Multi-source corpus + source authority + contradictions

Tables: `source_authority_rules` (per corpus, per role), `import_contradictions` (linked candidates + classification: `continuity_error | retcon | alt_continuity | draft_diff | unreliable_narrator`).

Reprocessing: incremental — only rerun stages whose `extractor_version` or `policy_version` changed; billing skipped for cached successes.

Acceptance: 19.5 and 19.10 pass.

## Phase 5 — ITS knowledge map

Tables: `series_knowledge_nodes` (concept, entity refs, evidence refs, prerequisites, role relevance, importance), `writer_knowledge_state` (status enum, last_checked_at, confidence — no personality inference).

Builder: `buildKnowledgeMap(corpusId)` runs after Phase 2–4 promotion; nodes cite evidence.

Acceptance: importing a season yields a queryable knowledge graph whose nodes each cite ≥1 segment.

## Phase 6 — PfHU continuation package + adaptive onboarding

Server function: `getContinuationPackage({ universeId, role, assignmentId? })` returns cast / states / relationships / world state / threads / required knowledge, all with evidence links.

UI: Continuation Dashboard route; role selector (writer / editor / actor / director); PfHU presentation adapts depth + format using existing `writerProfile`. Lightweight understanding checks are optional and never block the editor.

Acceptance: 19.6 and 19.7 pass; two roles get different briefings from the same evidence.

## Phase 7 — Editorial Review integration

New surface in the editor: "Continuity check" (idle / on-demand) compares current draft against knowledge map + Character Bible + World Graph. Findings table `editorial_findings` with evidence, affected block, severity, suggested resolutions. Never mutates the draft.

Acceptance: 19.8 passes (secret given to uninformed character → knowledge-state finding with citations).

## Phase 8 — Cross-media + multilingual

Transcriber adapter (audio → timestamped segments), translation-aware segment linking, adaptation-vs-translation classification.

Acceptance: audiobook import produces timestamped evidence usable in continuity findings.

## Permissions, pricing, safety (runs across every phase)

- Phase 1 adds role gates (owner / editor / commenter / viewer / non-member) enforced by RLS + `has_role`.
- Cost meter surfaces in Import Center before any paid stage (Creator / Pro / Studio tiers per §17).
- No training assumption; provider disclosure shown before first paid run.
- 19.9 permission matrix test added in Phase 1 and extended each phase.

## Technical section (reference)

```text
src/lib/importation/
  contracts/            # provider-neutral interfaces
  adapters/             # screenplay parser, LLM extractor, OCR, transcription
  server/               # createServerFn handlers
  knowledgeMap/         # ITS builder + query
  continuation/         # PfHU package assembler
supabase/migrations/    # one migration per phase, additive only
src/routes/_authenticated/import.$projectId.*   # Import Center + Review Inbox + Continuation Dashboard
```

Cutover: the existing `ImportWizard.tsx` becomes a thin front-end that calls Phase 1 `createSourceDocument` + Phase 2 promotion; no direct writes to project blocks after Phase 2 ships. Legacy `import_sessions` rows remain readable; new imports flow through the corpus spine.

## Sequencing rules

- One migration + one PR per phase; each phase ends with the acceptance test from §19 landed as an automated test where feasible, otherwise as a documented manual script.
- Do not start Phase N+1 until Phase N's acceptance test is green.
- No phase may write directly into `characters`, `world_*`, or `story_*` canon tables — only through review + promotion.

## What I need from you before Phase 0

1. Confirm the universe scope: one-universe-per-project by default, with optional multi-project universes later? (matches doc §6.1) Universes should be applied to our subscription plans. Free - 50% of features. Paid: 1, Pro 5, Studio: Unlimited
2. Which tier gates paid extraction on day one — Pro, or gate everything behind Studio until Phase 4? We're starting out: Let's let the Pro get a universe. More than one: Studio subscription.
3. Should the legacy screenplay `ImportWizard` keep its current one-shot UX during Phase 1, or move behind the new Import Center immediately?It should be moved behind the new Import Center from the get-go. Let's get this right so it works.