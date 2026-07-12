
-- Phase 3.1: Character Bible entries table (per-character, per-version)
CREATE TABLE public.character_bible_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bible_id uuid NOT NULL REFERENCES public.character_bibles(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  universe_id uuid NOT NULL REFERENCES public.story_universes(id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('manual','imported')),
  promoted_candidate_id uuid REFERENCES public.character_candidates(id) ON DELETE SET NULL,
  evidence_count integer NOT NULL DEFAULT 0,
  alias_count integer NOT NULL DEFAULT 0,
  scene_appearance_count integer NOT NULL DEFAULT 0,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bible_id, character_id)
);

CREATE INDEX idx_char_bible_entries_bible ON public.character_bible_entries(bible_id);
CREATE INDEX idx_char_bible_entries_project ON public.character_bible_entries(project_id);
CREATE INDEX idx_char_bible_entries_character ON public.character_bible_entries(character_id);

GRANT SELECT ON public.character_bible_entries TO authenticated;
GRANT ALL ON public.character_bible_entries TO service_role;

ALTER TABLE public.character_bible_entries ENABLE ROW LEVEL SECURITY;

-- SELECT: project members can read
CREATE POLICY "bible_entries_select_members"
  ON public.character_bible_entries
  FOR SELECT
  TO authenticated
  USING (public.is_project_member(project_id));

-- Writes: service_role only (server functions perform inserts via SECURITY DEFINER or admin path)
CREATE POLICY "bible_entries_no_client_insert"
  ON public.character_bible_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "bible_entries_no_client_update"
  ON public.character_bible_entries
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "bible_entries_no_client_delete"
  ON public.character_bible_entries
  FOR DELETE
  TO authenticated
  USING (false);

CREATE TRIGGER trg_char_bible_entries_updated
  BEFORE UPDATE ON public.character_bible_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill: for each existing bible, materialize entries from its jsonb `entries` array.
-- Existing shape: entries is jsonb array of { character_id, ... } objects produced by
-- the importation pipeline. We only backfill rows whose character_id still exists.
INSERT INTO public.character_bible_entries
  (bible_id, project_id, universe_id, character_id, source, promoted_candidate_id,
   evidence_count, alias_count, scene_appearance_count, snapshot)
SELECT
  b.id AS bible_id,
  b.project_id,
  b.universe_id,
  (e->>'character_id')::uuid AS character_id,
  'imported' AS source,
  NULLIF(e->>'candidate_id','')::uuid AS promoted_candidate_id,
  COALESCE((e->>'evidence_count')::int, 0),
  COALESCE((e->>'alias_count')::int, 0),
  COALESCE((e->>'scene_appearance_count')::int, 0),
  e AS snapshot
FROM public.character_bibles b
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(b.entries, '[]'::jsonb)) e
WHERE (e->>'character_id') IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.characters c WHERE c.id = (e->>'character_id')::uuid)
ON CONFLICT (bible_id, character_id) DO NOTHING;
