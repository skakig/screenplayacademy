# ITS/PfHU Importation — Phase 0 Audit

Status: Phase 0 deliverable. Baseline for the phased implementation in
`docs/ITS_PfHU_Importation.md` §18.

## 1. Current capabilities

- **Formats supported:** screenplay text only (`.txt`, pasted screenplay text,
  parsed by heuristics in `src/lib/import/parser.ts`).
- **Storage:** none — uploaded text is passed straight to the parser; the
  original file is not retained.
- **Segmentation:** ordered candidate blocks (`scene_heading | action |
  character | dialogue | parenthetical | transition | shot | note | unknown`)
  written to `import_block_candidates`.
- **Session model:** `import_sessions` (one per upload) →
  `import_block_candidates` → optional commit into `script_blocks`
  (canonical project data) via `src/lib/import/commit.functions.ts`.
- **Diagnostics:** `src/lib/import/diagnose.functions.ts` reports
  block-level warnings, no cross-source contradictions.
- **Character candidates:** speaker-label heuristic populates
  `character_candidates`; `accept_character_candidate()` promotes into
  `characters`.
- **World / relationship / thread candidates:** not implemented.
- **Evidence:** none. `import_block_candidates` link to the session but not
  to a durable source segment; `character_candidates` link to detected
  scenes only.
- **Identity resolution:** name-normalized upsert on accept; no Keep Separate
  memory, no alias grouping UI, no confidence.
- **Source authority / contradictions / retcons:** not modeled.
- **Knowledge map (ITS):** not modeled. `src/lib/its/` covers writer events
  and coach recommendations only.
- **Writer knowledge state (PfHU):** not modeled.
- **Editorial Review against imported canon:** not implemented.
- **Providers:** heuristic parser only. No OCR, no transcription, no
  LLM-based extractor, no embedding index.
- **UX:** one-shot `ImportWizard.tsx` at `/import/$projectId` — upload →
  parse → review → commit.

## 2. Gap map vs. doctrine

| Doctrine section | Present? | Notes |
|---|---|---|
| §4.2 Source preservation | No | Original file discarded after parse. |
| §4.3 Source authority | No | No authority table. |
| §4.4 Identity resolution proposals | Partial | Auto-merge on accept; no Keep Separate memory. |
| §4.5 Canon / belief / inference distinction | No | Blocks have no evidence type. |
| §4.6 Local-first Writer's Desk | Yes | Import runs off the typing path. |
| §4.7 Provider neutrality | No | Parser is the only extractor and is called directly. |
| §4.8 Rights and authorization | No | No rights metadata captured. |
| §5.1 Character candidates | Partial | Names + scenes only; no arc, wound, or knowledge state. |
| §5.2 Relationship candidates | No | — |
| §5.3 World candidates | No | — |
| §5.4 Story / continuity candidates | No | — |
| §6.1 Universe / corpus | No | Import is per-project, one-file. |
| §6.2 `source_documents` | No | — |
| §6.3 `source_segments` | No | Candidates are block-only. |
| §6.4 `import_extraction_runs` | No | — |
| §6.6 `import_evidence` | No | — |
| §6.7 `import_identity_decisions` | No | — |
| §6.9 `series_knowledge_nodes` | No | — |
| §6.10 `writer_knowledge_state` | No | — |
| §7.3 Multi-document corpus, pause/resume | No | — |
| §7.4 Contradiction handling | No | — |
| §8 Import Center UX (setup / dashboard / Review Inbox / Continuation) | Partial | Wizard-only, no dashboard, no continuation package. |
| §9 Adaptive role-aware onboarding | No | — |
| §12 Editorial review vs. corpus | No | — |
| §14 Multilingual / cross-media | No | — |
| §16 Rights, retention, RLS at corpus scale | Partial | RLS on `import_sessions` and `character_candidates`; no corpus RLS yet. |

## 3. Migration map (legacy → corpus spine)

| Legacy table | Successor (Phase) | Migration |
|---|---|---|
| `import_sessions` | `import_extraction_runs` (Phase 1) | Sessions kept read-only; new imports write extraction runs keyed by document checksum. |
| `import_block_candidates` | `source_segments` (Phase 1) + `import_candidates{type=block}` (Phase 2, optional) | Backfill not required; legacy sessions remain viewable. |
| `character_candidates` | `import_candidates{type=character}` + `import_evidence` (Phase 2) | New character extractions write through the new spine; `accept_character_candidate` stays as the promotion RPC and gains an `evidence_ids` parameter. |
| `import_recommendations` / `import_warnings` / `import_reports` | Fold into `editorial_findings` (Phase 7) | Keep tables until Phase 7 lands. |

## 4. Provider-neutral contracts (Phase 0 deliverable)

Location: `src/lib/importation/contracts/`.

- `DocumentParser` — bytes → normalized text + structural hints.
- `Transcriber` — audio bytes → timestamped text spans (Phase 8 use).
- `Segmenter` — normalized text → typed `SourceSegment[]`.
- `EntityExtractor` — `SourceSegment[]` → typed `Candidate[]` + evidence
  refs.
- `IdentityResolver` — `Candidate[]` → identity proposals (never destructive).
- `EmbeddingProvider` — `SourceSegment[]` → vector rows keyed by
  `(segment_id, model_version)`.
- `ContinuityAnalyzer` — draft + knowledge map → findings.

Every contract:

- returns typed output; no provider-branded fields leak.
- takes an explicit `extractor_version` / `model_version` so
  `import_extraction_runs` can cache by `(checksum, version)`.
- is instantiated inside a `createServerFn` handler; no admin client or
  process env read at module scope.

The existing screenplay heuristic (`src/lib/import/parser.ts`) is wrapped as
the first `DocumentParser` + `Segmenter` adapter in
`src/lib/importation/adapters/screenplay-heuristic.ts` with no behavior
change.

## 5. Non-goals for Phase 0

- No new tables.
- No UI changes.
- No LLM calls.
- No changes to how `ImportWizard.tsx` behaves today. Phase 1 rewires it.

## 6. Subscription gates (agreed with product)

- Free — 50% of importation features (single one-shot screenplay import; no
  Continuation Package, no Editorial Review).
- Creator — 1 universe.
- Pro — 1 universe with paid extraction unlocked (LLM extractor, OCR,
  transcription).
- Studio — up to 5 universes with team review, source authority, and
  Editorial Review; multi-universe beyond 5 is unlimited within Studio.

These gates are wired at Phase 1 (universe creation) and Phase 2 (paid
extractor invocation) — Phase 0 records them here only.
