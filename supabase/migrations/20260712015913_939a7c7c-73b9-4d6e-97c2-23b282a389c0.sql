CREATE TABLE public.scene_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  scene_id UUID NOT NULL REFERENCES public.scenes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT,
  summary TEXT,
  block_count INTEGER NOT NULL DEFAULT 0,
  word_count INTEGER NOT NULL DEFAULT 0,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scene_snapshots_scene_created ON public.scene_snapshots (scene_id, created_at DESC);
CREATE INDEX idx_scene_snapshots_project_created ON public.scene_snapshots (project_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scene_snapshots TO authenticated;
GRANT ALL ON public.scene_snapshots TO service_role;

ALTER TABLE public.scene_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their scene snapshots"
  ON public.scene_snapshots FOR SELECT
  USING (auth.uid() = user_id AND public.owns_project(project_id));

CREATE POLICY "Owners can insert their scene snapshots"
  ON public.scene_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.owns_project(project_id));

CREATE POLICY "Owners can update their scene snapshots"
  ON public.scene_snapshots FOR UPDATE
  USING (auth.uid() = user_id AND public.owns_project(project_id))
  WITH CHECK (auth.uid() = user_id AND public.owns_project(project_id));

CREATE POLICY "Owners can delete their scene snapshots"
  ON public.scene_snapshots FOR DELETE
  USING (auth.uid() = user_id AND public.owns_project(project_id));

CREATE TRIGGER update_scene_snapshots_updated_at
  BEFORE UPDATE ON public.scene_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();