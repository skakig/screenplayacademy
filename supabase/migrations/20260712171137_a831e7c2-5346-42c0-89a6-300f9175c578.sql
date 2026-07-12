-- Phase 2: projects <-> default story universe
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS default_universe_id uuid REFERENCES public.story_universes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS projects_default_universe_id_idx
  ON public.projects(default_universe_id)
  WHERE default_universe_id IS NOT NULL;

-- Backfill: for any project that has documents/bibles linked to a universe,
-- pick the most recently updated linked universe as the default.
UPDATE public.projects p
SET default_universe_id = sub.universe_id
FROM (
  SELECT DISTINCT ON (project_id) project_id, universe_id
  FROM (
    SELECT project_id, universe_id, updated_at FROM public.source_documents
      WHERE project_id IS NOT NULL AND universe_id IS NOT NULL
    UNION ALL
    SELECT project_id, universe_id, updated_at FROM public.character_bibles
      WHERE project_id IS NOT NULL AND universe_id IS NOT NULL
  ) x
  ORDER BY project_id, updated_at DESC
) sub
WHERE p.id = sub.project_id
  AND p.default_universe_id IS NULL;