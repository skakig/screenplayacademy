# Your Characters — Cinematic Cast Hub

Build a full character system at `/characters/$projectId` with a 3‑pane cinematic layout, rich profile tabs, relationships, scene usage, and AI generators (with graceful demo fallbacks). ElevenLabs voice IDs are persisted per character and reused by the Table Read.

## 1. Database (one migration)

Extend `characters` and add two new tables.

`**characters**` — add columns (keep existing):

- `alias`, `character_type`, `occupation`, `status`, `summary`
- `core_lie`, `core_secret` (already partly there), `group_name` (text, default `'Main Cast'`)
- Backstory: `childhood`, `defining_wound`, `formative_relationship`, `biggest_loss`, `biggest_shame`, `life_before_story`, `lies_about`, `never_says_aloud`
- Personality: `temperament`, `strengths`, `flaws`, `habits`, `conflict_style`, `fear_response`, `trust_triggers`, `betrayal_triggers`, `humor_style`
- TMH: `tmh_baseline` int, `tmh_stress` int, `tmh_aspirational` int, `tmh_shadow` int, `moral_wound`, `moral_blind_spot`, `core_temptation`, `core_virtue`, `core_vice`, `moral_test`, `what_they_justify`, `would_never_do`, `might_do_under_pressure`, `redemption_path`, `corruption_path`
- Voice: `voice_summary`, `vocabulary_level`, `sentence_rhythm`, `directness_level`, `emotional_openness`, `favorite_phrases`, `forbidden_phrases`, `how_they_lie`, `how_they_apologize`, `how_they_threaten`, `subtext_pattern`, `silence_pattern`, `voice_archetype` (keep `elevenlabs_voice_id`, `voice_style`, `speech_patterns`)
- Visual: `color_palette`, `signature_props`, `visual_symbol`, `movement_style`, `portrait_url` (keep `visual_description`, `costume_notes`, `image_prompt`)
- Arc: `starting_belief`, `ending_belief`, `starting_behavior`, `ending_behavior`, `act1_state`, `act2_pressure`, `midpoint_shift`, `dark_night_state`, `climax_choice`, `final_image`

`**character_relationships**` (new)

- `id`, `project_id`, `character_id`, `related_character_id`, `relationship_type`, `public_dynamic`, `private_truth`, `power_dynamic`, `wants_from_other`, `other_wants`, `secret_between`, `trust_level` int, `conflict_level` int, `relationship_arc`, timestamps
- RLS via `owns_project(project_id)`; GRANTs for `authenticated` + `service_role`

`**character_scene_states**` (new)

- `id`, `project_id`, `character_id`, `scene_id`, `emotional_state`, `goal_in_scene`, `fear_in_scene`, `tactic`, `tmh_level` int, `moral_pressure`, `relationship_shift`, `secret_status`, `continuity_notes`, timestamps
- RLS via `owns_project(project_id)`; unique `(character_id, scene_id)`

## 2. Route & Layout

`src/routes/_authenticated/characters.$projectId.tsx` — three‑pane cinematic shell:

```text
┌──────────┬─────────────────────────┬──────────────┐
│ Groups   │ Character Card Grid     │ Inspector    │
│ sidebar  │ (cinematic dark cards)  │ (selected)   │
└──────────┴─────────────────────────┴──────────────┘
```

- **Left sidebar**: 9 fixed groups + counts + "New Character" button. Filters grid.
- **Center grid**: cinematic cards (dark bg, soft border, hover glow, TMH color badge, stress badge, arc arrow, voice/portrait/secret/warning icons, completeness %, Open Profile / Use in Scene).
- **Right inspector**: condensed summary of selected character + quick AI action buttons; "Open full profile" opens the tab modal.

Also add nav entry from project hub to this page.

## 3. Character Profile (modal with 9 tabs)

`src/components/characters/CharacterProfileDialog.tsx` — shadcn `Dialog` + `Tabs`:
Overview · Backstory · Personality · TMH Moral Profile · Voice & Dialogue · Visual Identity · Relationships · Arc · Scene Usage.

Each tab = a small form section, auto‑saves on blur via a `saveCharacter` server fn (debounced). Completeness % computed from filled fields.

- TMH tab: 4 sliders (1–9) with color‑coded labels (L1 Survival → L9 Transcendence) and an expandable info panel explaining TMH as "moral behavior under pressure."
- Voice tab: ElevenLabs voice picker (reuses `listVoices` from table read) → writes `elevenlabs_voice_id`. Note: "voice reused by Table Read."
- Visual tab: "Generate Portrait" → image-gen (Lovable AI image) → uploads to `storyboards` bucket → sets `portrait_url`.
- Relationships tab: list + add/edit dialog of `character_relationships` rows with trust/conflict sliders.
- Scene Usage tab: lists scenes (join `scenes`), inline `character_scene_states` editor per scene.

## 4. AI Server Functions

`src/lib/characters.functions.ts` (all `requireSupabaseAuth`, all owner‑checked):

- `listCharacters({ projectId })`, `getCharacter({ id })`, `upsertCharacter`, `deleteCharacter`
- `listRelationships`, `upsertRelationship`, `deleteRelationship`
- `listSceneStates`, `upsertSceneState`
- AI: `generateFullCharacter`, `generateBackstory`, `generateTMHProfile`, `generateDialogueVoice`, `generateVisualPrompt`, `runMoralPressureTest`, `analyzeCharacterArc`, `testDialogue`, `findContradictions`, `suggestSceneUse`, `generatePortrait`

AI calls go through Lovable AI Gateway (`google/gemini-3-flash-preview`) with structured output. If `LOVABLE_API_KEY` is missing or call fails, return a **polished deterministic demo** synthesized from existing fields — no dead buttons.

## 5. ElevenLabs Voice Cache

- Add `src/lib/elevenlabs-voices.functions.ts` `listElevenLabsVoices()` server fn.
- Cache strategy: in‑memory `Map<string,{at:number,data:Voice[]}>` keyed by `'all'`, 10‑minute TTL inside the server fn module; plus client‑side TanStack Query (`staleTime: 10*60_000`, `gcTime: 30*60_000`) so the voice list is fetched at most once per session and shared between Voice tab + Table Read.
- Table Read page (`tableread.$projectId.tsx`) updated to consume the same query key.

## 6. UI/Design tokens

Add tokens to `src/styles.css`:

- TMH level colors L1–L9 (semantic `--tmh-l1`…`--tmh-l9`)
- `--card-cinematic`, `--glow-primary` (subtle shadow)
- Card variant in shadcn `card.tsx` extension or local CVA.

No raw hex in components — all via tokens.

## 7. Security

- RLS on all 3 tables uses `owns_project(project_id)`.
- GRANT SELECT/INSERT/UPDATE/DELETE to `authenticated`; ALL to `service_role`. No `anon`.
- Portraits uploaded under `storyboards/<project_id>/characters/<char_id>.png`; signed URLs via existing pattern.

## 8. Files to create / edit

Create:

- migration (1 file)
- `src/routes/_authenticated/characters.$projectId.tsx`
- `src/components/characters/CharacterGrid.tsx`
- `src/components/characters/CharacterCard.tsx`
- `src/components/characters/CharacterGroupsSidebar.tsx`
- `src/components/characters/CharacterInspector.tsx`
- `src/components/characters/CharacterProfileDialog.tsx` (+ one file per tab section under `./tabs/`)
- `src/components/characters/RelationshipEditor.tsx`
- `src/components/characters/TMHInfoPanel.tsx`
- `src/lib/characters.functions.ts`
- `src/lib/elevenlabs-voices.functions.ts`

Edit:

- `src/styles.css` (TMH + cinematic tokens)
- `src/lib/tableread.functions.ts` / page — switch to shared voice query
- project hub: add "Your Characters" link

## Out of scope (this round)

- Realtime collab on character edits
- Importing characters across projects
- Auto-linking scenes via NLP (manual scene‑state entries only)
- Character image generation so we have a visual representation of our characters while working.