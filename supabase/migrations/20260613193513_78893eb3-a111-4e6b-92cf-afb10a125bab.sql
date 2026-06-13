-- Pass 7: Live Scene Collaboration foundation

-- 1) Add revision tracking to script_blocks (additive, safe defaults)
ALTER TABLE public.script_blocks
  ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2) Trigger: bump revision when content/type actually changes
CREATE OR REPLACE FUNCTION public.bump_script_block_revision()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.content IS DISTINCT FROM OLD.content
     OR NEW.block_type IS DISTINCT FROM OLD.block_type THEN
    NEW.revision = COALESCE(OLD.revision, 1) + 1;
    NEW.updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_script_block_revision ON public.script_blocks;
CREATE TRIGGER trg_bump_script_block_revision
  BEFORE UPDATE ON public.script_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_script_block_revision();

-- 3) Live scene sessions table
CREATE TABLE IF NOT EXISTS public.live_scene_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  scene_id uuid NOT NULL REFERENCES public.scenes(id) ON DELETE CASCADE,
  started_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT live_scene_sessions_status_chk
    CHECK (status IN ('active','ended','abandoned'))
);

CREATE INDEX IF NOT EXISTS idx_live_scene_sessions_scene_active
  ON public.live_scene_sessions(scene_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_live_scene_sessions_project
  ON public.live_scene_sessions(project_id);

GRANT SELECT, INSERT, UPDATE ON public.live_scene_sessions TO authenticated;
GRANT ALL ON public.live_scene_sessions TO service_role;

ALTER TABLE public.live_scene_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "live_sessions_select_members"
  ON public.live_scene_sessions
  FOR SELECT
  TO authenticated
  USING (public.is_project_member(project_id));

CREATE POLICY "live_sessions_insert_editors"
  ON public.live_scene_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_edit_project(project_id)
    AND started_by = auth.uid()
  );

CREATE POLICY "live_sessions_update_own_or_editor"
  ON public.live_scene_sessions
  FOR UPDATE
  TO authenticated
  USING (
    started_by = auth.uid()
    OR public.can_override_scene_lock(project_id)
  )
  WITH CHECK (
    started_by = auth.uid()
    OR public.can_override_scene_lock(project_id)
  );

-- 4) Enable realtime on live_scene_sessions so participant lists react.
-- Guarded so re-runs don't fail.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'live_scene_sessions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.live_scene_sessions';
  END IF;
END $$;