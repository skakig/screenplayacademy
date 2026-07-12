
CREATE TABLE public.scene_autolink_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  universe_id UUID,
  user_id UUID,
  actor_label TEXT,
  trigger TEXT NOT NULL DEFAULT 'manual',
  locations_ensured INTEGER NOT NULL DEFAULT 0,
  usage_linked INTEGER NOT NULL DEFAULT 0,
  usage_unlinked INTEGER NOT NULL DEFAULT 0,
  scenes_considered INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX scene_autolink_runs_project_created_idx
  ON public.scene_autolink_runs (project_id, created_at DESC);

GRANT SELECT, INSERT ON public.scene_autolink_runs TO authenticated;
GRANT ALL ON public.scene_autolink_runs TO service_role;

ALTER TABLE public.scene_autolink_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scene_autolink_runs_member_select"
  ON public.scene_autolink_runs FOR SELECT
  TO authenticated
  USING (public.is_project_member(project_id));

CREATE POLICY "scene_autolink_runs_member_insert"
  ON public.scene_autolink_runs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_project_member(project_id));
