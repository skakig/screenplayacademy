
-- Pass 1: Identity resolution & merge engine — schema

-- 1) Additive columns on characters
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS canonical_name text,
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS rank text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS speaker_labels text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS merged_into uuid REFERENCES public.characters(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_characters_merged_into ON public.characters(merged_into) WHERE merged_into IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_characters_archived_at ON public.characters(archived_at) WHERE archived_at IS NOT NULL;

-- 2) character_aliases
CREATE TABLE IF NOT EXISTS public.character_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  alias_text text NOT NULL,
  normalized text NOT NULL,
  alias_kind text NOT NULL DEFAULT 'manual',
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.character_aliases TO authenticated;
GRANT ALL ON public.character_aliases TO service_role;
ALTER TABLE public.character_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aliases_member_all" ON public.character_aliases
  FOR ALL TO authenticated
  USING (public.is_project_member(project_id))
  WITH CHECK (public.is_project_member(project_id));
CREATE INDEX IF NOT EXISTS idx_char_aliases_project_norm ON public.character_aliases(project_id, normalized);
CREATE INDEX IF NOT EXISTS idx_char_aliases_character ON public.character_aliases(character_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_char_aliases_project_char_norm ON public.character_aliases(project_id, character_id, normalized);

-- 3) character_merges (audit + undo snapshot log)
CREATE TABLE IF NOT EXISTS public.character_merges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  primary_character_id uuid NOT NULL,
  merged_character_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'merge' CHECK (kind IN ('merge','undo')),
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  chosen_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  merged_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  undone_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.character_merges TO authenticated;
GRANT ALL ON public.character_merges TO service_role;
ALTER TABLE public.character_merges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "merges_member_select" ON public.character_merges
  FOR SELECT TO authenticated
  USING (public.is_project_member(project_id));
-- inserts/updates/deletes are performed via service_role in server functions only.
CREATE INDEX IF NOT EXISTS idx_char_merges_project ON public.character_merges(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_char_merges_primary ON public.character_merges(primary_character_id);

-- 4) project_alias_memory — learned name→character mappings and "keep separate" decisions
CREATE TABLE IF NOT EXISTS public.project_alias_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  normalized text NOT NULL,
  resolves_to_character_id uuid REFERENCES public.characters(id) ON DELETE CASCADE,
  decision text NOT NULL CHECK (decision IN ('alias','keep_separate')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, DELETE ON public.project_alias_memory TO authenticated;
GRANT ALL ON public.project_alias_memory TO service_role;
ALTER TABLE public.project_alias_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alias_memory_member_select" ON public.project_alias_memory
  FOR SELECT TO authenticated
  USING (public.is_project_member(project_id));
CREATE POLICY "alias_memory_member_delete" ON public.project_alias_memory
  FOR DELETE TO authenticated
  USING (public.is_project_member(project_id));
-- inserts happen via server functions using service_role after auth checks.
CREATE INDEX IF NOT EXISTS idx_alias_memory_project_norm ON public.project_alias_memory(project_id, normalized);
CREATE UNIQUE INDEX IF NOT EXISTS ux_alias_memory_unique ON public.project_alias_memory(project_id, normalized, COALESCE(resolves_to_character_id, '00000000-0000-0000-0000-000000000000'::uuid));
