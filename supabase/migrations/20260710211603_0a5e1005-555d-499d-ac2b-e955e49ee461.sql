
-- =========================================================================
-- Arena Mode v1 — Hardening Pass
-- =========================================================================

-- ---- Preflight: archive stale duplicate active sessions per project -----
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY project_id ORDER BY created_at DESC) AS rn
  FROM public.arena_sessions
  WHERE status IN ('open','running','voting')
)
UPDATE public.arena_sessions s
   SET status = 'archived', updated_at = now()
  FROM ranked r
 WHERE s.id = r.id AND r.rn > 1;

-- =========================================================================
-- 1. Session state-machine + protected-field trigger
--    RPCs bypass by setting the arena.trusted GUC; ordinary clients cannot.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.arena_sessions_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_trusted boolean := coalesce(current_setting('arena.trusted', true), '') = 'on';
BEGIN
  IF v_trusted THEN
    RETURN NEW;
  END IF;

  -- Ordinary client updates: block lifecycle + trusted columns entirely.
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'ARENA: status may only change through a lifecycle RPC';
  END IF;
  IF NEW.id            IS DISTINCT FROM OLD.id            THEN RAISE EXCEPTION 'ARENA: id is immutable'; END IF;
  IF NEW.project_id    IS DISTINCT FROM OLD.project_id    THEN RAISE EXCEPTION 'ARENA: project_id is immutable'; END IF;
  IF NEW.created_by    IS DISTINCT FROM OLD.created_by    THEN RAISE EXCEPTION 'ARENA: created_by is immutable'; END IF;
  IF NEW.starts_at     IS DISTINCT FROM OLD.starts_at     THEN RAISE EXCEPTION 'ARENA: starts_at is immutable'; END IF;
  IF NEW.ends_at       IS DISTINCT FROM OLD.ends_at       THEN RAISE EXCEPTION 'ARENA: ends_at is immutable'; END IF;
  IF NEW.created_at    IS DISTINCT FROM OLD.created_at    THEN RAISE EXCEPTION 'ARENA: created_at is immutable'; END IF;

  -- After the round begins, freeze judging + reveal + stakes + grace + mode + duration.
  IF OLD.status <> 'draft' AND OLD.status <> 'open' THEN
    IF NEW.mode                     IS DISTINCT FROM OLD.mode                     THEN RAISE EXCEPTION 'ARENA: mode locked after round start'; END IF;
    IF NEW.duration_seconds         IS DISTINCT FROM OLD.duration_seconds         THEN RAISE EXCEPTION 'ARENA: duration locked after round start'; END IF;
    IF NEW.judging_mode             IS DISTINCT FROM OLD.judging_mode             THEN RAISE EXCEPTION 'ARENA: judging_mode locked after round start'; END IF;
    IF NEW.entry_reveal             IS DISTINCT FROM OLD.entry_reveal             THEN RAISE EXCEPTION 'ARENA: entry_reveal locked after round start'; END IF;
    IF NEW.stakes                   IS DISTINCT FROM OLD.stakes                   THEN RAISE EXCEPTION 'ARENA: stakes locked after round start'; END IF;
    IF NEW.submission_grace_seconds IS DISTINCT FROM OLD.submission_grace_seconds THEN RAISE EXCEPTION 'ARENA: submission_grace_seconds locked after round start'; END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS arena_sessions_guard_trg ON public.arena_sessions;
CREATE TRIGGER arena_sessions_guard_trg BEFORE UPDATE ON public.arena_sessions
FOR EACH ROW EXECUTE FUNCTION public.arena_sessions_guard();

-- Restrict the RLS UPDATE policy to non-lifecycle draft/open edits.
DROP POLICY IF EXISTS "arena_sessions_update_host_or_owner" ON public.arena_sessions;
CREATE POLICY "arena_sessions_update_host_or_owner_meta"
ON public.arena_sessions FOR UPDATE TO authenticated
USING (
  (created_by = auth.uid() OR public.owns_project(project_id))
  AND status IN ('draft','open')
)
WITH CHECK (
  (created_by = auth.uid() OR public.owns_project(project_id))
);

-- =========================================================================
-- 2. Lifecycle transition validation (defense-in-depth for RPC bugs)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.arena_sessions_transition_check()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  -- allowed transitions:
  IF NOT (
        (OLD.status = 'draft'    AND NEW.status IN ('open','archived'))
     OR (OLD.status = 'open'     AND NEW.status IN ('running','archived'))
     OR (OLD.status = 'running'  AND NEW.status IN ('voting','archived'))
     OR (OLD.status = 'voting'   AND NEW.status IN ('complete','archived'))
     OR (OLD.status = 'complete' AND NEW.status = 'archived')
  ) THEN
    RAISE EXCEPTION 'ARENA: invalid transition % -> %', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS arena_sessions_transition_check_trg ON public.arena_sessions;
CREATE TRIGGER arena_sessions_transition_check_trg BEFORE UPDATE ON public.arena_sessions
FOR EACH ROW EXECUTE FUNCTION public.arena_sessions_transition_check();

-- =========================================================================
-- 3. One active session per project
-- =========================================================================
CREATE UNIQUE INDEX IF NOT EXISTS arena_sessions_one_active_per_project
  ON public.arena_sessions(project_id)
  WHERE status IN ('open','running','voting');

-- =========================================================================
-- 4. Entries: immutable fields + running-window enforcement
-- =========================================================================
CREATE OR REPLACE FUNCTION public.arena_entries_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_trusted boolean := coalesce(current_setting('arena.trusted', true), '') = 'on';
  v_session public.arena_sessions;
BEGIN
  -- Structural immutability always applies.
  IF NEW.session_id IS DISTINCT FROM OLD.session_id THEN RAISE EXCEPTION 'ARENA: session_id is immutable'; END IF;
  IF NEW.project_id IS DISTINCT FROM OLD.project_id THEN RAISE EXCEPTION 'ARENA: project_id is immutable'; END IF;
  IF NEW.author_id  IS DISTINCT FROM OLD.author_id  THEN RAISE EXCEPTION 'ARENA: author_id is immutable'; END IF;

  IF v_trusted THEN RETURN NEW; END IF;

  -- Only the author's draft may be edited from the client.
  IF OLD.status <> 'draft' THEN
    RAISE EXCEPTION 'ARENA: submitted entries cannot be modified';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'ARENA: status transitions must use submit_arena_entry';
  END IF;

  -- Draft body/title edits only while session is running AND within grace.
  SELECT * INTO v_session FROM public.arena_sessions WHERE id = NEW.session_id;
  IF v_session.status <> 'running' THEN
    RAISE EXCEPTION 'ARENA: cannot edit draft outside running round';
  END IF;
  IF v_session.ends_at IS NOT NULL
     AND now() > v_session.ends_at + make_interval(secs => COALESCE(v_session.submission_grace_seconds, 0)) THEN
    RAISE EXCEPTION 'ARENA: submission window has closed';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS arena_entries_guard_trg ON public.arena_entries;
CREATE TRIGGER arena_entries_guard_trg BEFORE UPDATE ON public.arena_entries
FOR EACH ROW EXECUTE FUNCTION public.arena_entries_guard();

-- Tighten UPDATE policy to draft-only.
DROP POLICY IF EXISTS "arena_entries_update_own_draft" ON public.arena_entries;
CREATE POLICY "arena_entries_update_own_draft" ON public.arena_entries
FOR UPDATE TO authenticated
USING (
  author_id = auth.uid()
  AND status = 'draft'
  AND EXISTS (
    SELECT 1 FROM public.arena_sessions s
    WHERE s.id = arena_entries.session_id AND s.status = 'running'
  )
)
WITH CHECK (author_id = auth.uid() AND status = 'draft');

-- =========================================================================
-- 5. Vote privacy
-- =========================================================================
DROP POLICY IF EXISTS "arena_votes_select_members" ON public.arena_votes;
CREATE POLICY "arena_votes_select_own_or_complete" ON public.arena_votes
FOR SELECT TO authenticated
USING (
  voter_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.arena_sessions s
    WHERE s.id = arena_votes.session_id
      AND public.is_project_member(s.project_id)
      AND s.status = 'complete'
  )
);

-- =========================================================================
-- 6. Participants: revoke direct INSERT, keep DELETE for self-leave.
-- =========================================================================
DROP POLICY IF EXISTS "arena_participants_insert_self" ON public.arena_participants;
-- (No INSERT policy = INSERT denied for non-superuser roles; RPCs run as SECURITY DEFINER.)

-- =========================================================================
-- 7. Suggestions: partial unique index for one-promotion-per-entry
-- =========================================================================
CREATE UNIQUE INDEX IF NOT EXISTS suggestions_arena_entry_unique
  ON public.suggestions ((metadata->>'arena_entry_id'))
  WHERE metadata->>'source' = 'arena' AND metadata->>'arena_entry_id' IS NOT NULL;

-- =========================================================================
-- 8. RPCs
-- =========================================================================

-- 8a. create_arena_session (atomic)
CREATE OR REPLACE FUNCTION public.create_arena_session(
  _project_id uuid,
  _title text,
  _mode public.arena_mode,
  _prompt text,
  _duration_seconds integer,
  _submission_grace_seconds integer DEFAULT 10,
  _judging_mode public.arena_judging_mode DEFAULT 'peer',
  _entry_reveal public.arena_entry_reveal DEFAULT 'named',
  _stakes public.arena_stakes DEFAULT 'practice',
  _rules jsonb DEFAULT '{}'::jsonb
) RETURNS public.arena_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.arena_sessions;
  v_role text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ARENA: authentication required'; END IF;
  IF _title IS NULL OR btrim(_title) = '' THEN RAISE EXCEPTION 'ARENA: title required'; END IF;
  IF _prompt IS NULL OR btrim(_prompt) = '' THEN RAISE EXCEPTION 'ARENA: prompt required'; END IF;
  IF _duration_seconds IS NULL OR _duration_seconds < 60 OR _duration_seconds > 3600 THEN
    RAISE EXCEPTION 'ARENA: duration_seconds must be between 60 and 3600';
  END IF;
  v_role := public.project_role(_project_id);
  IF v_role IS NULL OR v_role NOT IN ('owner','co_writer','editor','producer','assistant') THEN
    RAISE EXCEPTION 'ARENA: your project role cannot host rounds';
  END IF;

  INSERT INTO public.arena_sessions
    (project_id, created_by, title, mode, prompt, status,
     duration_seconds, submission_grace_seconds, judging_mode, entry_reveal, stakes, rules)
  VALUES
    (_project_id, v_uid, btrim(_title), _mode, btrim(_prompt), 'open',
     _duration_seconds, COALESCE(_submission_grace_seconds, 10),
     COALESCE(_judging_mode, 'peer'), COALESCE(_entry_reveal, 'named'),
     COALESCE(_stakes, 'practice'), COALESCE(_rules, '{}'::jsonb))
  RETURNING * INTO v_row;

  INSERT INTO public.arena_participants (session_id, project_id, user_id, role)
  VALUES (v_row.id, _project_id, v_uid, 'writer');

  RETURN v_row;
END $$;
REVOKE ALL ON FUNCTION public.create_arena_session(uuid,text,public.arena_mode,text,integer,integer,public.arena_judging_mode,public.arena_entry_reveal,public.arena_stakes,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_arena_session(uuid,text,public.arena_mode,text,integer,integer,public.arena_judging_mode,public.arena_entry_reveal,public.arena_stakes,jsonb) TO authenticated, service_role;

-- 8b. join_arena_session
CREATE OR REPLACE FUNCTION public.join_arena_session(
  _session_id uuid,
  _role public.arena_participant_role DEFAULT 'writer'
) RETURNS public.arena_participants
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_session public.arena_sessions;
  v_row public.arena_participants;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ARENA: authentication required'; END IF;
  SELECT * INTO v_session FROM public.arena_sessions WHERE id = _session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ARENA: session not found'; END IF;
  IF NOT public.is_project_member(v_session.project_id) THEN
    RAISE EXCEPTION 'ARENA: not a project member';
  END IF;

  -- Stage rules:
  IF v_session.status IN ('complete','archived') THEN
    RAISE EXCEPTION 'ARENA: round is closed';
  END IF;
  IF _role = 'writer' AND v_session.status <> 'open' THEN
    RAISE EXCEPTION 'ARENA: writers can only join before the round starts';
  END IF;
  IF _role = 'judge' AND v_session.status NOT IN ('open','running','voting') THEN
    RAISE EXCEPTION 'ARENA: judges can only join before voting closes';
  END IF;

  INSERT INTO public.arena_participants (session_id, project_id, user_id, role)
  VALUES (_session_id, v_session.project_id, v_uid, _role)
  ON CONFLICT (session_id, user_id) DO UPDATE
    SET role = CASE
      -- allow upgrading viewer -> writer/judge only before running
      WHEN public.arena_participants.role = 'viewer' AND EXCLUDED.role IN ('writer','judge') AND v_session.status = 'open' THEN EXCLUDED.role
      ELSE public.arena_participants.role
    END
  RETURNING * INTO v_row;

  RETURN v_row;
END $$;
REVOKE ALL ON FUNCTION public.join_arena_session(uuid, public.arena_participant_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_arena_session(uuid, public.arena_participant_role) TO authenticated, service_role;

-- 8c. submit_arena_entry
CREATE OR REPLACE FUNCTION public.submit_arena_entry(_entry_id uuid)
RETURNS public.arena_entries
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_entry public.arena_entries;
  v_session public.arena_sessions;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ARENA: authentication required'; END IF;
  SELECT * INTO v_entry FROM public.arena_entries WHERE id = _entry_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ARENA: entry not found'; END IF;
  IF v_entry.author_id <> v_uid THEN RAISE EXCEPTION 'ARENA: not your entry'; END IF;
  IF v_entry.status <> 'draft' THEN RAISE EXCEPTION 'ARENA: entry already %', v_entry.status; END IF;
  IF btrim(coalesce(v_entry.body,'')) = '' THEN RAISE EXCEPTION 'ARENA: entry body is empty'; END IF;

  SELECT * INTO v_session FROM public.arena_sessions WHERE id = v_entry.session_id;
  IF v_session.status <> 'running' THEN RAISE EXCEPTION 'ARENA: round is not running'; END IF;
  IF v_session.ends_at IS NOT NULL
     AND now() > v_session.ends_at + make_interval(secs => COALESCE(v_session.submission_grace_seconds, 0)) THEN
    RAISE EXCEPTION 'ARENA: submission window has closed';
  END IF;

  PERFORM set_config('arena.trusted', 'on', true);
  UPDATE public.arena_entries
     SET status = 'submitted', submitted_at = now(), updated_at = now()
   WHERE id = _entry_id
   RETURNING * INTO v_entry;
  PERFORM set_config('arena.trusted', 'off', true);
  RETURN v_entry;
END $$;
REVOKE ALL ON FUNCTION public.submit_arena_entry(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_arena_entry(uuid) TO authenticated, service_role;

-- 8d. award_arena_entry — derives project + awarded_to from the DB
CREATE OR REPLACE FUNCTION public.award_arena_entry(
  _session_id uuid,
  _entry_id uuid,
  _award_type public.arena_award_type,
  _title text DEFAULT NULL
) RETURNS public.arena_awards
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_session public.arena_sessions;
  v_entry public.arena_entries;
  v_row public.arena_awards;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ARENA: authentication required'; END IF;
  SELECT * INTO v_session FROM public.arena_sessions WHERE id = _session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ARENA: session not found'; END IF;
  IF v_session.created_by <> v_uid AND NOT public.owns_project(v_session.project_id) THEN
    RAISE EXCEPTION 'ARENA: only host or owner may award';
  END IF;
  IF v_session.status NOT IN ('voting','complete') THEN
    RAISE EXCEPTION 'ARENA: cannot award from %', v_session.status;
  END IF;
  SELECT * INTO v_entry FROM public.arena_entries WHERE id = _entry_id;
  IF NOT FOUND OR v_entry.session_id <> _session_id THEN
    RAISE EXCEPTION 'ARENA: entry does not belong to session';
  END IF;

  INSERT INTO public.arena_awards (session_id, project_id, entry_id, awarded_to, award_type, title)
  VALUES (_session_id, v_session.project_id, _entry_id, v_entry.author_id, _award_type, _title)
  ON CONFLICT (session_id, entry_id, award_type) DO UPDATE
    SET title = COALESCE(EXCLUDED.title, public.arena_awards.title)
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;
REVOKE ALL ON FUNCTION public.award_arena_entry(uuid,uuid,public.arena_award_type,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_arena_entry(uuid,uuid,public.arena_award_type,text) TO authenticated, service_role;

-- 8e. promote_arena_entry — atomic, idempotent
CREATE OR REPLACE FUNCTION public.promote_arena_entry(
  _session_id uuid,
  _entry_id uuid,
  _suggestion_type text DEFAULT 'structure_note'
) RETURNS TABLE(id uuid, already_existed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_session public.arena_sessions;
  v_entry public.arena_entries;
  v_role text;
  v_award_type text;
  v_existing_id uuid;
  v_new_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ARENA: authentication required'; END IF;
  SELECT * INTO v_session FROM public.arena_sessions WHERE id = _session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ARENA: session not found'; END IF;
  IF v_session.status <> 'complete' THEN RAISE EXCEPTION 'ARENA: only complete rounds may be promoted'; END IF;
  v_role := public.project_role(v_session.project_id);
  IF v_uid <> v_session.created_by
     AND (v_role IS NULL OR v_role NOT IN ('owner','co_writer','editor')) THEN
    RAISE EXCEPTION 'ARENA: not permitted to promote';
  END IF;
  SELECT * INTO v_entry FROM public.arena_entries WHERE id = _entry_id;
  IF NOT FOUND OR v_entry.session_id <> _session_id THEN
    RAISE EXCEPTION 'ARENA: entry does not belong to session';
  END IF;
  IF v_entry.status <> 'submitted' THEN
    RAISE EXCEPTION 'ARENA: only submitted entries may be promoted';
  END IF;
  IF _suggestion_type NOT IN ('structure_note','rewrite_scene') THEN
    RAISE EXCEPTION 'ARENA: invalid suggestion type';
  END IF;

  -- Idempotency via unique index on suggestions.metadata->>'arena_entry_id'
  SELECT s.id INTO v_existing_id FROM public.suggestions s
   WHERE s.metadata->>'source' = 'arena'
     AND s.metadata->>'arena_entry_id' = _entry_id::text
   LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    id := v_existing_id; already_existed := true; RETURN NEXT; RETURN;
  END IF;

  SELECT a.award_type::text INTO v_award_type
    FROM public.arena_awards a
   WHERE a.session_id = _session_id AND a.entry_id = _entry_id
   ORDER BY (a.award_type = 'studio_winner') DESC, a.created_at ASC
   LIMIT 1;

  BEGIN
    INSERT INTO public.suggestions
      (project_id, author_id, source, suggestion_type, status, title, rationale, after, metadata)
    VALUES
      (v_session.project_id,
       v_uid,
       'human',
       _suggestion_type,
       'open',
       COALESCE(v_entry.title, 'Arena · ' || v_session.title),
       'Promoted from Arena round "' || v_session.title || '" (' || replace(v_session.mode::text,'_',' ') || ').',
       jsonb_build_object('text', v_entry.body, 'arena_entry_title', v_entry.title),
       jsonb_build_object(
         'source', 'arena',
         'arena_session_id', _session_id::text,
         'arena_entry_id', _entry_id::text,
         'arena_award_type', v_award_type,
         'arena_original_author_id', v_entry.author_id::text
       ))
    RETURNING suggestions.id INTO v_new_id;
    id := v_new_id; already_existed := false; RETURN NEXT; RETURN;
  EXCEPTION WHEN unique_violation THEN
    SELECT s.id INTO v_existing_id FROM public.suggestions s
     WHERE s.metadata->>'source' = 'arena'
       AND s.metadata->>'arena_entry_id' = _entry_id::text
     LIMIT 1;
    id := v_existing_id; already_existed := true; RETURN NEXT; RETURN;
  END;
END $$;
REVOKE ALL ON FUNCTION public.promote_arena_entry(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.promote_arena_entry(uuid,uuid,text) TO authenticated, service_role;

-- 8f. get_arena_voting_progress
CREATE OR REPLACE FUNCTION public.get_arena_voting_progress(_session_id uuid)
RETURNS TABLE(eligible_voters int, completed_voters int, entries_with_votes int, current_user_has_voted boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_session public.arena_sessions;
  v_eligible int;
  v_completed int;
  v_entries int;
  v_i_voted boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ARENA: authentication required'; END IF;
  SELECT * INTO v_session FROM public.arena_sessions WHERE id = _session_id;
  IF NOT FOUND OR NOT public.is_project_member(v_session.project_id) THEN
    RAISE EXCEPTION 'ARENA: not a project member';
  END IF;

  SELECT count(*) INTO v_eligible FROM public.arena_participants p
   WHERE p.session_id = _session_id AND p.role IN ('writer','judge');
  SELECT count(DISTINCT v.voter_id) INTO v_completed FROM public.arena_votes v
   WHERE v.session_id = _session_id;
  SELECT count(DISTINCT v.entry_id) INTO v_entries FROM public.arena_votes v
   WHERE v.session_id = _session_id;
  SELECT EXISTS(SELECT 1 FROM public.arena_votes v WHERE v.session_id = _session_id AND v.voter_id = v_uid) INTO v_i_voted;

  eligible_voters := v_eligible;
  completed_voters := v_completed;
  entries_with_votes := v_entries;
  current_user_has_voted := v_i_voted;
  RETURN NEXT;
END $$;
REVOKE ALL ON FUNCTION public.get_arena_voting_progress(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_arena_voting_progress(uuid) TO authenticated, service_role;

-- 8g. get_arena_voting_entries — blind-safe entries feed
CREATE OR REPLACE FUNCTION public.get_arena_voting_entries(_session_id uuid)
RETURNS TABLE(
  entry_id uuid,
  session_id uuid,
  anonymous_label text,
  title text,
  body text,
  status public.arena_entry_status,
  author_id uuid,
  submitted_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_session public.arena_sessions;
  v_blind boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ARENA: authentication required'; END IF;
  SELECT * INTO v_session FROM public.arena_sessions WHERE id = _session_id;
  IF NOT FOUND OR NOT public.is_project_member(v_session.project_id) THEN
    RAISE EXCEPTION 'ARENA: not a project member';
  END IF;
  v_blind := (v_session.entry_reveal = 'blind_until_results' AND v_session.status = 'voting');

  RETURN QUERY
  SELECT e.id AS entry_id,
         e.session_id,
         'Entry ' || chr(64 + row_number() OVER (ORDER BY e.submitted_at NULLS LAST, e.id))::text AS anonymous_label,
         CASE WHEN v_blind AND e.author_id <> v_uid THEN NULL ELSE e.title END AS title,
         e.body,
         e.status,
         CASE WHEN v_blind AND e.author_id <> v_uid THEN NULL ELSE e.author_id END AS author_id,
         e.submitted_at
    FROM public.arena_entries e
   WHERE e.session_id = _session_id
     AND e.status = 'submitted'
   ORDER BY e.submitted_at NULLS LAST, e.id;
END $$;
REVOKE ALL ON FUNCTION public.get_arena_voting_entries(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_arena_voting_entries(uuid) TO authenticated, service_role;

-- =========================================================================
-- 9. finalize_arena_round — co-winner support, DB-authoritative
-- =========================================================================
CREATE OR REPLACE FUNCTION public.finalize_arena_round(_session_id uuid)
RETURNS public.arena_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.arena_sessions;
  v_top_key numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'ARENA: authentication required'; END IF;
  SELECT * INTO v_row FROM public.arena_sessions WHERE id = _session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ARENA: session not found'; END IF;
  IF v_row.created_by <> auth.uid() AND NOT public.owns_project(v_row.project_id) THEN
    RAISE EXCEPTION 'ARENA: only host or owner';
  END IF;
  IF v_row.status <> 'voting' THEN RAISE EXCEPTION 'ARENA: cannot finalize from %', v_row.status; END IF;

  PERFORM set_config('arena.trusted', 'on', true);
  UPDATE public.arena_sessions SET status = 'complete', updated_at = now()
   WHERE id = _session_id RETURNING * INTO v_row;
  PERFORM set_config('arena.trusted', 'off', true);

  -- Compute ranking key: (avg total, avg character truth, avg cinematic value)
  WITH scored AS (
    SELECT e.id AS entry_id,
           e.author_id,
           AVG(COALESCE(v.score_originality,0)+COALESCE(v.score_character_truth,0)+
               COALESCE(v.score_cinematic_value,0)+COALESCE(v.score_emotional_impact,0)+
               COALESCE(v.score_craft,0)) AS total_avg,
           AVG(COALESCE(v.score_character_truth,0)) AS ct_avg,
           AVG(COALESCE(v.score_cinematic_value,0)) AS cv_avg
      FROM public.arena_entries e
      LEFT JOIN public.arena_votes v ON v.entry_id = e.id
     WHERE e.session_id = _session_id AND e.status = 'submitted'
     GROUP BY e.id, e.author_id
  ),
  ranked_scored AS (
    SELECT entry_id, author_id,
           ROW_NUMBER() OVER (
             ORDER BY total_avg DESC NULLS LAST, ct_avg DESC NULLS LAST, cv_avg DESC NULLS LAST
           ) AS rn,
           total_avg, ct_avg, cv_avg
      FROM scored
  ),
  winners AS (
    SELECT r.entry_id, r.author_id
      FROM ranked_scored r
      JOIN ranked_scored top ON top.rn = 1
     WHERE r.total_avg IS NOT DISTINCT FROM top.total_avg
       AND r.ct_avg    IS NOT DISTINCT FROM top.ct_avg
       AND r.cv_avg    IS NOT DISTINCT FROM top.cv_avg
       AND r.total_avg IS NOT NULL
  )
  INSERT INTO public.arena_awards (session_id, project_id, entry_id, awarded_to, award_type, title)
  SELECT _session_id, v_row.project_id, w.entry_id, w.author_id, 'studio_winner', 'Studio Winner'
    FROM winners w
  ON CONFLICT (session_id, entry_id, award_type) DO NOTHING;

  RETURN v_row;
END $$;
REVOKE ALL ON FUNCTION public.finalize_arena_round(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_arena_round(uuid) TO authenticated, service_role;

-- =========================================================================
-- 10. Wrap start/end/advance with GUC so status trigger allows the change
-- =========================================================================
CREATE OR REPLACE FUNCTION public.start_arena_round(_session_id uuid)
RETURNS public.arena_sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.arena_sessions;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'ARENA: authentication required'; END IF;
  SELECT * INTO v_row FROM public.arena_sessions WHERE id = _session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ARENA: session not found'; END IF;
  IF v_row.created_by <> auth.uid() AND NOT public.owns_project(v_row.project_id) THEN RAISE EXCEPTION 'ARENA: only host or owner'; END IF;
  IF v_row.status NOT IN ('draft','open') THEN RAISE EXCEPTION 'ARENA: cannot start from %', v_row.status; END IF;
  PERFORM set_config('arena.trusted', 'on', true);
  UPDATE public.arena_sessions
     SET status='running', starts_at=now(),
         ends_at=now() + make_interval(secs => v_row.duration_seconds),
         updated_at=now()
   WHERE id=_session_id RETURNING * INTO v_row;
  PERFORM set_config('arena.trusted', 'off', true);
  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.advance_arena_round_if_due(_session_id uuid)
RETURNS public.arena_sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.arena_sessions;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'ARENA: authentication required'; END IF;
  SELECT * INTO v_row FROM public.arena_sessions WHERE id = _session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ARENA: session not found'; END IF;
  IF NOT public.is_project_member(v_row.project_id) THEN RAISE EXCEPTION 'ARENA: not a member'; END IF;
  IF v_row.status = 'running' AND v_row.ends_at IS NOT NULL
     AND v_row.ends_at + make_interval(secs => COALESCE(v_row.submission_grace_seconds,0)) <= now() THEN
    PERFORM set_config('arena.trusted', 'on', true);
    UPDATE public.arena_sessions SET status='voting', updated_at=now() WHERE id=_session_id RETURNING * INTO v_row;
    PERFORM set_config('arena.trusted', 'off', true);
  END IF;
  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.end_arena_round(_session_id uuid)
RETURNS public.arena_sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.arena_sessions;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'ARENA: authentication required'; END IF;
  SELECT * INTO v_row FROM public.arena_sessions WHERE id = _session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ARENA: session not found'; END IF;
  IF v_row.created_by <> auth.uid() AND NOT public.owns_project(v_row.project_id) THEN RAISE EXCEPTION 'ARENA: only host or owner'; END IF;
  IF v_row.status <> 'running' THEN RAISE EXCEPTION 'ARENA: cannot end from %', v_row.status; END IF;
  PERFORM set_config('arena.trusted', 'on', true);
  UPDATE public.arena_sessions SET status='voting', updated_at=now() WHERE id=_session_id RETURNING * INTO v_row;
  PERFORM set_config('arena.trusted', 'off', true);
  RETURN v_row;
END $$;

REVOKE ALL ON FUNCTION public.start_arena_round(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_arena_round(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.advance_arena_round_if_due(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advance_arena_round_if_due(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.end_arena_round(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.end_arena_round(uuid) TO authenticated, service_role;

-- =========================================================================
-- 11. archive helper — the ordinary UPDATE policy blocks status changes,
--     so archiving must go through an RPC too.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.archive_arena_session(_session_id uuid)
RETURNS public.arena_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.arena_sessions;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'ARENA: authentication required'; END IF;
  SELECT * INTO v_row FROM public.arena_sessions WHERE id = _session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ARENA: session not found'; END IF;
  IF v_row.created_by <> auth.uid() AND NOT public.owns_project(v_row.project_id) THEN
    RAISE EXCEPTION 'ARENA: only host or owner';
  END IF;
  IF v_row.status = 'archived' THEN RETURN v_row; END IF;
  PERFORM set_config('arena.trusted', 'on', true);
  UPDATE public.arena_sessions SET status='archived', updated_at=now() WHERE id=_session_id RETURNING * INTO v_row;
  PERFORM set_config('arena.trusted', 'off', true);
  RETURN v_row;
END $$;
REVOKE ALL ON FUNCTION public.archive_arena_session(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_arena_session(uuid) TO authenticated, service_role;
