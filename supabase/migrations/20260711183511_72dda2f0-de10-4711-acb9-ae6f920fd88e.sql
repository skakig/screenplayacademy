
-- =========================================================================
-- Pass 1: character_candidates table
-- =========================================================================
CREATE TABLE public.character_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  detected_name text NOT NULL,
  normalized_name text NOT NULL,
  source_block_ids uuid[] NOT NULL DEFAULT '{}',
  dialogue_line_count integer NOT NULL DEFAULT 0,
  scene_count integer NOT NULL DEFAULT 0,
  candidate_type text NOT NULL DEFAULT 'speaker'
    CHECK (candidate_type IN ('speaker','mentioned','possible_duplicate')),
  confidence numeric NOT NULL DEFAULT 0.5,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','ignored','rejected')),
  merged_into_character_id uuid REFERENCES public.characters(id) ON DELETE SET NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, normalized_name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.character_candidates TO authenticated;
GRANT ALL ON public.character_candidates TO service_role;

ALTER TABLE public.character_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "candidates_select_members"
  ON public.character_candidates FOR SELECT TO authenticated
  USING (public.is_project_member(project_id));

CREATE POLICY "candidates_insert_editors"
  ON public.character_candidates FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_project(project_id));

CREATE POLICY "candidates_update_editors"
  ON public.character_candidates FOR UPDATE TO authenticated
  USING (public.can_edit_project(project_id))
  WITH CHECK (public.can_edit_project(project_id));

CREATE POLICY "candidates_delete_editors"
  ON public.character_candidates FOR DELETE TO authenticated
  USING (public.can_edit_project(project_id));

CREATE INDEX character_candidates_project_status_idx
  ON public.character_candidates (project_id, status);

CREATE TRIGGER character_candidates_updated_at
  BEFORE UPDATE ON public.character_candidates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- Pass 2: characters columns for quarantine, importance, function
-- =========================================================================
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS quarantined_at timestamptz,
  ADD COLUMN IF NOT EXISTS quarantine_reason text,
  ADD COLUMN IF NOT EXISTS importance text
    CHECK (importance IS NULL OR importance IN ('main','supporting','minor','unassigned')),
  ADD COLUMN IF NOT EXISTS story_function text;

CREATE INDEX IF NOT EXISTS characters_project_quarantined_idx
  ON public.characters (project_id, quarantined_at);

-- =========================================================================
-- Pass 2: repair snapshots for 30-day undo
-- =========================================================================
CREATE TABLE public.character_repair_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  character_id uuid,
  snapshot jsonb NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);

GRANT SELECT, INSERT, DELETE ON public.character_repair_snapshots TO authenticated;
GRANT ALL ON public.character_repair_snapshots TO service_role;

ALTER TABLE public.character_repair_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "repair_snapshots_select_members"
  ON public.character_repair_snapshots FOR SELECT TO authenticated
  USING (public.is_project_member(project_id));

CREATE POLICY "repair_snapshots_insert_editors"
  ON public.character_repair_snapshots FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_project(project_id));

CREATE POLICY "repair_snapshots_delete_editors"
  ON public.character_repair_snapshots FOR DELETE TO authenticated
  USING (public.can_edit_project(project_id));

CREATE INDEX character_repair_snapshots_project_idx
  ON public.character_repair_snapshots (project_id, created_at DESC);

-- =========================================================================
-- Promotion RPC: accept a candidate into characters
-- =========================================================================
CREATE OR REPLACE FUNCTION public.accept_character_candidate(
  _candidate_id uuid,
  _overrides jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cand public.character_candidates;
  v_name text;
  v_existing_id uuid;
  v_new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'CANDIDATE: authentication required';
  END IF;

  SELECT * INTO v_cand FROM public.character_candidates
    WHERE id = _candidate_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CANDIDATE: not found';
  END IF;
  IF NOT public.can_edit_project(v_cand.project_id) THEN
    RAISE EXCEPTION 'CANDIDATE: not permitted';
  END IF;
  IF v_cand.status <> 'pending' THEN
    RAISE EXCEPTION 'CANDIDATE: already %', v_cand.status;
  END IF;

  v_name := COALESCE(NULLIF(btrim(_overrides->>'name'), ''), v_cand.detected_name);

  -- Reuse an active (non-quarantined) character with same normalized name if present.
  SELECT id INTO v_existing_id FROM public.characters
   WHERE project_id = v_cand.project_id
     AND quarantined_at IS NULL
     AND upper(btrim(name)) = upper(btrim(v_name))
   LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.character_candidates
       SET status = 'accepted',
           merged_into_character_id = v_existing_id,
           updated_at = now()
     WHERE id = _candidate_id;
    RETURN v_existing_id;
  END IF;

  INSERT INTO public.characters (project_id, name, importance, story_function)
  VALUES (
    v_cand.project_id,
    v_name,
    COALESCE(NULLIF(_overrides->>'importance', ''), 'unassigned'),
    NULLIF(_overrides->>'story_function', '')
  )
  RETURNING id INTO v_new_id;

  UPDATE public.character_candidates
     SET status = 'accepted',
         merged_into_character_id = v_new_id,
         updated_at = now()
   WHERE id = _candidate_id;

  RETURN v_new_id;
END $$;

-- =========================================================================
-- Restore RPC: unquarantine a character (undo)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.restore_quarantined_character(_character_id uuid)
RETURNS public.characters
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.characters;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'REPAIR: authentication required';
  END IF;
  SELECT * INTO v_row FROM public.characters WHERE id = _character_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'REPAIR: character not found'; END IF;
  IF NOT public.can_edit_project(v_row.project_id) THEN
    RAISE EXCEPTION 'REPAIR: not permitted';
  END IF;
  UPDATE public.characters
     SET quarantined_at = NULL,
         quarantine_reason = NULL,
         updated_at = now()
   WHERE id = _character_id
   RETURNING * INTO v_row;
  RETURN v_row;
END $$;

-- =========================================================================
-- One-time repair pass: quarantine obvious structural rows
-- Snapshots pre-repair state so users can restore.
-- Only touches active (non-quarantined) rows.
-- =========================================================================
DO $$
DECLARE
  v_row RECORD;
  v_reason text;
  v_name_trim text;
  v_name_upper text;
BEGIN
  FOR v_row IN
    SELECT id, project_id, name, to_jsonb(characters.*) AS snap
      FROM public.characters
     WHERE quarantined_at IS NULL
       AND name IS NOT NULL
  LOOP
    v_name_trim := btrim(v_row.name);
    v_name_upper := upper(v_name_trim);
    v_reason := NULL;

    IF v_name_trim = '' THEN
      v_reason := 'empty_name';
    ELSIF v_name_upper ~ '^(INT\.?|EXT\.?|INT\.?/EXT\.?|I/E)[[:space:]\.]' THEN
      v_reason := 'scene_heading';
    ELSIF v_name_upper ~ '(CUT TO:?|FADE IN:?|FADE OUT:?|FADE TO:?|DISSOLVE TO:?|SMASH CUT:?|MATCH CUT:?)' THEN
      v_reason := 'transition';
    ELSIF v_name_upper ~ '^(ACT|SCENE|COLD OPEN|TEASER|THE END|END OF ACT|EPILOGUE|PROLOGUE)[[:space:]0-9]*$' THEN
      v_reason := 'structural_label';
    ELSIF v_name_upper ~ '[[:space:]](DAY|NIGHT|MORNING|EVENING|DAWN|DUSK|CONTINUOUS|LATER|MOMENTS LATER)$' THEN
      v_reason := 'time_of_day_tail';
    ELSIF length(v_name_trim) > 60 THEN
      v_reason := 'too_long';
    ELSIF array_length(regexp_split_to_array(v_name_trim, '\s+'), 1) > 6 THEN
      v_reason := 'too_many_words';
    ELSIF v_name_trim ~ '^[^[:alnum:]]+$' THEN
      v_reason := 'punctuation_only';
    END IF;

    IF v_reason IS NOT NULL THEN
      INSERT INTO public.character_repair_snapshots (project_id, character_id, snapshot, reason)
      VALUES (v_row.project_id, v_row.id, v_row.snap, v_reason);

      UPDATE public.characters
         SET quarantined_at = now(),
             quarantine_reason = v_reason,
             updated_at = now()
       WHERE id = v_row.id;
    END IF;
  END LOOP;
END $$;
