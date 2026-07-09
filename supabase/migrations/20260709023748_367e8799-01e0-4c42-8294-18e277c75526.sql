
CREATE TABLE public.vault_scenes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'vault_scene' CHECK (kind IN ('vault_scene','dialogue_fragment','set_piece','alternate_take')),
  title text NOT NULL DEFAULT 'Untitled',
  content text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  location text,
  emotional_tone text,
  estimated_position text NOT NULL DEFAULT 'unsure' CHECK (estimated_position IN ('act_1','act_2a','midpoint','act_2b','act_3','unsure')),
  tags text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'vaulted' CHECK (status IN ('vaulted','candidate','integrated','alternate','needs_rewrite','locked','deleted')),
  linked_scene_id uuid REFERENCES public.scenes(id) ON DELETE SET NULL,
  linked_character_ids uuid[] NOT NULL DEFAULT '{}',
  alternate_of uuid REFERENCES public.vault_scenes(id) ON DELETE SET NULL,
  archived_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX vault_scenes_project_idx ON public.vault_scenes(project_id);
CREATE INDEX vault_scenes_status_idx ON public.vault_scenes(project_id, status);
CREATE INDEX vault_scenes_linked_scene_idx ON public.vault_scenes(linked_scene_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vault_scenes TO authenticated;
GRANT ALL ON public.vault_scenes TO service_role;

ALTER TABLE public.vault_scenes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view vault scenes"
  ON public.vault_scenes FOR SELECT TO authenticated
  USING (public.is_project_member(project_id));

CREATE POLICY "Editors can insert vault scenes"
  ON public.vault_scenes FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_project(project_id));

CREATE POLICY "Editors can update vault scenes"
  ON public.vault_scenes FOR UPDATE TO authenticated
  USING (public.can_edit_project(project_id))
  WITH CHECK (public.can_edit_project(project_id));

CREATE POLICY "Editors can delete vault scenes"
  ON public.vault_scenes FOR DELETE TO authenticated
  USING (public.can_edit_project(project_id));

CREATE TRIGGER update_vault_scenes_updated_at
  BEFORE UPDATE ON public.vault_scenes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.scenes
  ADD COLUMN IF NOT EXISTS source_vault_scene_id uuid REFERENCES public.vault_scenes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS scenes_source_vault_idx ON public.scenes(source_vault_scene_id);
