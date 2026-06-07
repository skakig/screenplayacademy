## 1. Fix the Editor crash ("This page didn't load")

The route `/editor/$projectId` is throwing into the root error boundary. Likely culprits in `src/routes/_authenticated/editor.$projectId.tsx`:

- `block.block_type[0].toUpperCase()` on a row whose `block_type` is empty/null.
- `c.toUpperCase()` / `c.replace(...)` in `formatExport` when `content` is `null`.
- `useState(block.content)` + `val.slice(...)` when `content` is `null` (slash-command handler runs on null).
- Stale row from a previously failed `insertBlockAfter` (fractional `order_index` + re-normalize loop is not atomic).

Plan:
- Open the editor in the browser, capture the real stack from console/runtime errors, and fix the exact throw.
- Defensively coerce `content ?? ""` everywhere (`val`, `formatExport`, slash logic) and guard `block.block_type` in the per-block select trigger.
- Wrap the editor's `<section>` body in a local React error boundary (so a single bad block can't blank the whole route) with a "Reset block" action.
- Replace the fractional-index + N-update normalization in `insertBlockAfter` with a single atomic re-order: fetch current orders, shift `>= afterOrder+1` by +1, then insert at `afterOrder+1`. Less round-trips, no transient duplicate indices.

## 2. Real ElevenLabs table read ("Listen to your story")

Currently `src/lib/tableread.functions.ts` only inserts a `queued`/`coming_soon` row — no audio is produced. Wire it end-to-end.

Connector:
- Link the existing ElevenLabs workspace connection to this project via `standard_connectors--connect` (`connector_id: "elevenlabs"`). This injects `ELEVENLABS_API_KEY` server-side — no key in client code, no manual secret.

Server function (`generateTableRead`):
- Load the selected scene's `script_blocks` (or all blocks if no scene picked) in order.
- Convert blocks into spoken lines using the export rules:
  - `scene_heading` → narrator (only if `narrator` toggle on)
  - `action` → narrator (if on)
  - `character` → sets the speaker for the following `dialogue` / `parenthetical`
  - `dialogue` → that character's assigned voice
  - `parenthetical` → spoken softly by same character (or skipped, configurable; default: skip)
  - `transition` / `shot` → narrator (if on)
  - `note` → always excluded (matches editor export rule)
- Pick voices: per-character `voiceMap[characterId]` from the UI, falling back to `characters.elevenlabs_voice_id`, then to a default narrator voice (`JBFqnCBsd6RMkjVDRZzb` / George) for unmapped lines.
- For each line call `POST https://api.elevenlabs.io/v1/text-to-speech/{voiceId}?output_format=mp3_44100_128` with `eleven_multilingual_v2`. Use request-stitching (`previous_text` / `next_text`) for prosody continuity. Limit concurrency to ~3.
- Concatenate the resulting MP3 buffers in order (simple binary concat of MP3 frames is acceptable for playback; document the trade-off).
- Upload the final MP3 to the existing private `table-reads` storage bucket at `{userId}/{projectId}/{audioAssetId}.mp3`.
- Insert/update the `audio_assets` row with `status: 'ready'`, `audio_url` set to a long-lived signed URL (e.g. 7 days), `duration_seconds` estimated from line count, and `voice_map` of resolved voice IDs.
- On any failure: mark the row `status: 'failed'`, return a structured error to the client; UI shows a retry.
- Keep the `sfx` toggle behind a "Pro — coming soon" badge for now (no SFX in this pass).

Client (`tableread.$projectId.tsx`):
- Resolve signed URLs for existing `ready` rows when listing (server function `signTableReadUrl({ audioAssetId })` that re-signs from the stored object path so links don't expire in the UI).
- While generating, show progress state; on success, refresh the list and auto-play the newest read.
- Persist voice assignments back onto `characters.elevenlabs_voice_id` when the user types one in (so it sticks across reads).
- Add a small ElevenLabs Voice ID helper text + link to the ElevenLabs voice library.

## 3. Save / persistence sanity pass

- Confirm `audio_assets` RLS allows `SELECT`/`INSERT`/`UPDATE` only via `owns_project(project_id)`; add policies if missing.
- Confirm `table-reads` bucket has storage policies that allow the project owner to read their own audio (path prefix = `auth.uid()`). Add policies if missing.
- Persist character voice updates via `supabase.from('characters').update({ elevenlabs_voice_id }).eq('id', ...)`.

## Acceptance

- Navigating from Dashboard → "The Road to El Alamein" → Editor renders the empty/blank-page state without throwing.
- Slash commands, Tab, and Enter all work on blocks with empty or null content.
- On the Table Read page, clicking **Generate Table Read** produces an MP3 audible in the in-page `<audio>` player within ~30s for a short scene, with each character spoken in their assigned voice.
- The generated read survives a page reload (signed URL re-issued server-side).
- `ELEVENLABS_API_KEY` is never referenced in client code.

## Technical notes

- Stack: TanStack Start server functions (`createServerFn` + `requireSupabaseAuth`), Supabase Storage, ElevenLabs REST (`xi-api-key`, no SDK).
- No edge functions added — all server logic stays in `src/lib/tableread.functions.ts` and a small `src/lib/tableread-sign.functions.ts`.
- Files touched:
  - `src/routes/_authenticated/editor.$projectId.tsx` (crash fix + null guards + local error boundary)
  - `src/lib/tableread.functions.ts` (real TTS pipeline)
  - `src/lib/tableread-sign.functions.ts` (new, signed-URL helper)
  - `src/routes/_authenticated/tableread.$projectId.tsx` (signed-URL fetch, persist voice IDs, polish)
  - Optional migration if `audio_assets` / `table-reads` policies are missing.
