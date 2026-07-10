
-- Arena Mode v1
DO $$ BEGIN CREATE TYPE public.arena_mode AS ENUM ('dialogue_duel','rewrite_relay','scene_rescue','adlib_character','comedy_punchup','villain_monologue','pitch_blitz','freewrite'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.arena_status AS ENUM ('draft','open','running','voting','complete','archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.arena_participant_role AS ENUM ('writer','judge','viewer'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.arena_entry_status AS ENUM ('draft','submitted','withdrawn'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.arena_award_type AS ENUM ('best_line','best_dialogue','best_twist','best_character_truth','funniest','most_cinematic','audience_choice','studio_winner'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.arena_judging_mode AS ENUM ('peer','host','panel','hybrid'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.arena_entry_reveal AS ENUM ('named','blind_until_results'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.arena_stakes AS ENUM ('practice','ranked','showcase'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.arena_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  title text NOT NULL,
  mode public.arena_mode NOT NULL,
  prompt text NOT NULL,
  status public.arena_status NOT NULL DEFAULT 'open',
  duration_seconds integer NOT NULL CHECK (duration_seconds > 0 AND duration_seconds <= 3600),
  starts_at timestamptz,
  ends_at timestamptz,
  rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  judging_mode public.arena_judging_mode NOT NULL DEFAULT 'peer',
  entry_reveal public.arena_entry_reveal NOT NULL DEFAULT 'named',
  stakes public.arena_stakes NOT NULL DEFAULT 'practice',
  submission_grace_seconds integer NOT NULL DEFAULT 10 CHECK (submission_grace_seconds >= 0 AND submission_grace_seconds <= 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.arena_sessions TO authenticated;
GRANT ALL ON public.arena_sessions TO service_role;
ALTER TABLE public.arena_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "arena_sessions_select_members" ON public.arena_sessions FOR SELECT TO authenticated USING (public.is_project_member(project_id));
CREATE POLICY "arena_sessions_insert_permitted" ON public.arena_sessions FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() AND public.project_role(project_id) IN ('owner','co_writer','editor','producer','assistant'));
CREATE POLICY "arena_sessions_update_host_or_owner" ON public.arena_sessions FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.owns_project(project_id)) WITH CHECK (created_by = auth.uid() OR public.owns_project(project_id));
CREATE POLICY "arena_sessions_delete_owner" ON public.arena_sessions FOR DELETE TO authenticated USING (public.owns_project(project_id));
CREATE TRIGGER arena_sessions_touch BEFORE UPDATE ON public.arena_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX arena_sessions_project_status_idx ON public.arena_sessions(project_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.arena_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.arena_sessions(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.arena_participant_role NOT NULL DEFAULT 'writer',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.arena_participants TO authenticated;
GRANT ALL ON public.arena_participants TO service_role;
ALTER TABLE public.arena_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "arena_participants_select_members" ON public.arena_participants FOR SELECT TO authenticated USING (public.is_project_member(project_id));
CREATE POLICY "arena_participants_insert_self" ON public.arena_participants FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_project_member(project_id)
    AND EXISTS (SELECT 1 FROM public.arena_sessions s WHERE s.id = arena_participants.session_id AND s.project_id = arena_participants.project_id AND s.status IN ('open','running','voting'))
  );
CREATE POLICY "arena_participants_delete_self_or_host" ON public.arena_participants FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.arena_sessions s WHERE s.id = arena_participants.session_id AND (s.created_by = auth.uid() OR public.owns_project(s.project_id))));

CREATE OR REPLACE FUNCTION public.arena_check_session_project()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_pid uuid;
BEGIN
  SELECT project_id INTO v_pid FROM public.arena_sessions WHERE id = NEW.session_id;
  IF v_pid IS NULL OR v_pid <> NEW.project_id THEN
    RAISE EXCEPTION 'arena: project_id does not match session project';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER arena_participants_check_session BEFORE INSERT OR UPDATE ON public.arena_participants FOR EACH ROW EXECUTE FUNCTION public.arena_check_session_project();

CREATE TABLE IF NOT EXISTS public.arena_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.arena_sessions(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  body text NOT NULL DEFAULT '',
  status public.arena_entry_status NOT NULL DEFAULT 'draft',
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, author_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.arena_entries TO authenticated;
GRANT ALL ON public.arena_entries TO service_role;
ALTER TABLE public.arena_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "arena_entries_select_members" ON public.arena_entries FOR SELECT TO authenticated USING (public.is_project_member(project_id));
CREATE POLICY "arena_entries_insert_writer" ON public.arena_entries FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.arena_participants p JOIN public.arena_sessions s ON s.id = p.session_id
      WHERE p.session_id = arena_entries.session_id AND p.user_id = auth.uid()
        AND p.role = 'writer' AND s.status = 'running' AND s.project_id = arena_entries.project_id
    )
  );
CREATE POLICY "arena_entries_update_own_draft" ON public.arena_entries FOR UPDATE TO authenticated
  USING (author_id = auth.uid() AND EXISTS (SELECT 1 FROM public.arena_sessions s WHERE s.id = arena_entries.session_id AND s.status = 'running'))
  WITH CHECK (author_id = auth.uid());
CREATE POLICY "arena_entries_delete_own_draft" ON public.arena_entries FOR DELETE TO authenticated USING (author_id = auth.uid() AND status = 'draft');
CREATE TRIGGER arena_entries_touch BEFORE UPDATE ON public.arena_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER arena_entries_check_session BEFORE INSERT OR UPDATE ON public.arena_entries FOR EACH ROW EXECUTE FUNCTION public.arena_check_session_project();
CREATE INDEX arena_entries_session_idx ON public.arena_entries(session_id);

CREATE TABLE IF NOT EXISTS public.arena_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.arena_sessions(id) ON DELETE CASCADE,
  entry_id uuid NOT NULL REFERENCES public.arena_entries(id) ON DELETE CASCADE,
  voter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score_originality smallint NOT NULL CHECK (score_originality BETWEEN 1 AND 5),
  score_character_truth smallint NOT NULL CHECK (score_character_truth BETWEEN 1 AND 5),
  score_cinematic_value smallint NOT NULL CHECK (score_cinematic_value BETWEEN 1 AND 5),
  score_emotional_impact smallint NOT NULL CHECK (score_emotional_impact BETWEEN 1 AND 5),
  score_craft smallint NOT NULL CHECK (score_craft BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, entry_id, voter_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.arena_votes TO authenticated;
GRANT ALL ON public.arena_votes TO service_role;
ALTER TABLE public.arena_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "arena_votes_select_members" ON public.arena_votes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.arena_sessions s WHERE s.id = arena_votes.session_id AND public.is_project_member(s.project_id)));
CREATE POLICY "arena_votes_insert_eligible" ON public.arena_votes FOR INSERT TO authenticated
  WITH CHECK (
    voter_id = auth.uid()
    AND EXISTS (
      SELECT 1
        FROM public.arena_sessions s
        JOIN public.arena_entries e ON e.id = arena_votes.entry_id AND e.session_id = s.id
        JOIN public.arena_participants p ON p.session_id = s.id AND p.user_id = auth.uid() AND p.role IN ('writer','judge')
       WHERE s.id = arena_votes.session_id AND s.status = 'voting' AND e.author_id <> auth.uid() AND e.status = 'submitted'
    )
  );
CREATE POLICY "arena_votes_update_own_while_voting" ON public.arena_votes FOR UPDATE TO authenticated
  USING (voter_id = auth.uid() AND EXISTS (SELECT 1 FROM public.arena_sessions s WHERE s.id = arena_votes.session_id AND s.status = 'voting'))
  WITH CHECK (voter_id = auth.uid());
CREATE INDEX arena_votes_entry_idx ON public.arena_votes(entry_id);

CREATE OR REPLACE FUNCTION public.arena_check_vote_entry()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_sid uuid;
BEGIN
  SELECT session_id INTO v_sid FROM public.arena_entries WHERE id = NEW.entry_id;
  IF v_sid IS NULL OR v_sid <> NEW.session_id THEN
    RAISE EXCEPTION 'arena: vote entry does not belong to session';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER arena_votes_check_entry BEFORE INSERT OR UPDATE ON public.arena_votes FOR EACH ROW EXECUTE FUNCTION public.arena_check_vote_entry();

CREATE TABLE IF NOT EXISTS public.arena_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.arena_sessions(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  entry_id uuid NOT NULL REFERENCES public.arena_entries(id) ON DELETE CASCADE,
  awarded_to uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  award_type public.arena_award_type NOT NULL,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, entry_id, award_type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.arena_awards TO authenticated;
GRANT ALL ON public.arena_awards TO service_role;
ALTER TABLE public.arena_awards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "arena_awards_select_members" ON public.arena_awards FOR SELECT TO authenticated USING (public.is_project_member(project_id));
CREATE POLICY "arena_awards_insert_host_or_owner" ON public.arena_awards FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.arena_sessions s WHERE s.id = arena_awards.session_id AND s.project_id = arena_awards.project_id AND s.status IN ('voting','complete') AND (s.created_by = auth.uid() OR public.owns_project(s.project_id)))
  );
CREATE POLICY "arena_awards_delete_host_or_owner" ON public.arena_awards FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.arena_sessions s WHERE s.id = arena_awards.session_id AND (s.created_by = auth.uid() OR public.owns_project(s.project_id))));
CREATE TRIGGER arena_awards_check_session BEFORE INSERT OR UPDATE ON public.arena_awards FOR EACH ROW EXECUTE FUNCTION public.arena_check_session_project();

-- Lifecycle RPCs
CREATE OR REPLACE FUNCTION public.start_arena_round(_session_id uuid)
RETURNS public.arena_sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.arena_sessions;
BEGIN
  SELECT * INTO v_row FROM public.arena_sessions WHERE id = _session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ARENA: session not found'; END IF;
  IF v_row.created_by <> auth.uid() AND NOT public.owns_project(v_row.project_id) THEN RAISE EXCEPTION 'ARENA: only host or owner'; END IF;
  IF v_row.status NOT IN ('draft','open') THEN RAISE EXCEPTION 'ARENA: cannot start from %', v_row.status; END IF;
  UPDATE public.arena_sessions SET status='running', starts_at=now(), ends_at=now() + make_interval(secs => v_row.duration_seconds), updated_at=now() WHERE id=_session_id RETURNING * INTO v_row;
  RETURN v_row;
END $$;
REVOKE ALL ON FUNCTION public.start_arena_round(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_arena_round(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.advance_arena_round_if_due(_session_id uuid)
RETURNS public.arena_sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.arena_sessions;
BEGIN
  SELECT * INTO v_row FROM public.arena_sessions WHERE id = _session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ARENA: session not found'; END IF;
  IF NOT public.is_project_member(v_row.project_id) THEN RAISE EXCEPTION 'ARENA: not a member'; END IF;
  IF v_row.status = 'running' AND v_row.ends_at IS NOT NULL AND v_row.ends_at + make_interval(secs => COALESCE(v_row.submission_grace_seconds,0)) <= now() THEN
    UPDATE public.arena_sessions SET status='voting', updated_at=now() WHERE id=_session_id RETURNING * INTO v_row;
  END IF;
  RETURN v_row;
END $$;
REVOKE ALL ON FUNCTION public.advance_arena_round_if_due(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advance_arena_round_if_due(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.end_arena_round(_session_id uuid)
RETURNS public.arena_sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.arena_sessions;
BEGIN
  SELECT * INTO v_row FROM public.arena_sessions WHERE id = _session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ARENA: session not found'; END IF;
  IF v_row.created_by <> auth.uid() AND NOT public.owns_project(v_row.project_id) THEN RAISE EXCEPTION 'ARENA: only host or owner'; END IF;
  IF v_row.status <> 'running' THEN RAISE EXCEPTION 'ARENA: cannot end from %', v_row.status; END IF;
  UPDATE public.arena_sessions SET status='voting', ends_at=LEAST(COALESCE(ends_at,now()), now()), updated_at=now() WHERE id=_session_id RETURNING * INTO v_row;
  RETURN v_row;
END $$;
REVOKE ALL ON FUNCTION public.end_arena_round(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.end_arena_round(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.finalize_arena_round(_session_id uuid)
RETURNS public.arena_sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.arena_sessions; v_winner uuid;
BEGIN
  SELECT * INTO v_row FROM public.arena_sessions WHERE id = _session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ARENA: session not found'; END IF;
  IF v_row.created_by <> auth.uid() AND NOT public.owns_project(v_row.project_id) THEN RAISE EXCEPTION 'ARENA: only host or owner'; END IF;
  IF v_row.status <> 'voting' THEN RAISE EXCEPTION 'ARENA: cannot finalize from %', v_row.status; END IF;
  SELECT e.id INTO v_winner FROM public.arena_entries e LEFT JOIN public.arena_votes v ON v.entry_id = e.id
    WHERE e.session_id = _session_id AND e.status='submitted' GROUP BY e.id
    ORDER BY AVG(COALESCE(v.score_originality,0)+COALESCE(v.score_character_truth,0)+COALESCE(v.score_cinematic_value,0)+COALESCE(v.score_emotional_impact,0)+COALESCE(v.score_craft,0)) DESC NULLS LAST,
             AVG(COALESCE(v.score_character_truth,0)) DESC NULLS LAST,
             AVG(COALESCE(v.score_cinematic_value,0)) DESC NULLS LAST,
             e.created_at ASC
    LIMIT 1;
  UPDATE public.arena_sessions SET status='complete', updated_at=now() WHERE id=_session_id RETURNING * INTO v_row;
  IF v_winner IS NOT NULL THEN
    INSERT INTO public.arena_awards (session_id, project_id, entry_id, awarded_to, award_type, title)
    SELECT _session_id, v_row.project_id, e.id, e.author_id, 'studio_winner', 'Studio Winner' FROM public.arena_entries e WHERE e.id = v_winner
    ON CONFLICT (session_id, entry_id, award_type) DO NOTHING;
  END IF;
  RETURN v_row;
END $$;
REVOKE ALL ON FUNCTION public.finalize_arena_round(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_arena_round(uuid) TO authenticated, service_role;
