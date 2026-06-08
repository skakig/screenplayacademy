
-- writer_profiles
CREATE TABLE public.writer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  formatting_skill_score INTEGER NOT NULL DEFAULT 50,
  scene_craft_score INTEGER NOT NULL DEFAULT 50,
  dialogue_score INTEGER NOT NULL DEFAULT 50,
  visual_writing_score INTEGER NOT NULL DEFAULT 50,
  character_voice_score INTEGER NOT NULL DEFAULT 50,
  ai_dependence_score INTEGER NOT NULL DEFAULT 50,
  confidence_score INTEGER NOT NULL DEFAULT 50,
  coaching_level TEXT NOT NULL DEFAULT 'gentle',
  total_sessions INTEGER NOT NULL DEFAULT 0,
  total_words_written INTEGER NOT NULL DEFAULT 0,
  total_scenes_written INTEGER NOT NULL DEFAULT 0,
  last_aggregated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.writer_profiles TO authenticated;
GRANT ALL ON public.writer_profiles TO service_role;
ALTER TABLE public.writer_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Writer profiles: own all" ON public.writer_profiles
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_writer_profiles_updated_at BEFORE UPDATE ON public.writer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- writing_events (append-only)
CREATE TABLE public.writing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID,
  scene_id UUID,
  character_id UUID,
  event_type TEXT NOT NULL,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.writing_events TO authenticated;
GRANT ALL ON public.writing_events TO service_role;
ALTER TABLE public.writing_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Writing events: own read" ON public.writing_events
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Writing events: own insert" ON public.writing_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE INDEX writing_events_user_created_idx ON public.writing_events(user_id, created_at DESC);
CREATE INDEX writing_events_project_idx ON public.writing_events(project_id, created_at DESC);

-- coach_recommendations
CREATE TABLE public.coach_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID NOT NULL,
  scene_id UUID,
  rule_key TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  lesson_slug TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  shown_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_recommendations TO authenticated;
GRANT ALL ON public.coach_recommendations TO service_role;
ALTER TABLE public.coach_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Coach recs: owner all" ON public.coach_recommendations
  FOR ALL USING (owns_project(project_id)) WITH CHECK (owns_project(project_id));
CREATE INDEX coach_recommendations_project_idx ON public.coach_recommendations(project_id, status, created_at DESC);
CREATE TRIGGER update_coach_recommendations_updated_at BEFORE UPDATE ON public.coach_recommendations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- editor_sessions
CREATE TABLE public.editor_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  blocks_added INTEGER NOT NULL DEFAULT 0,
  scenes_added INTEGER NOT NULL DEFAULT 0,
  ai_calls INTEGER NOT NULL DEFAULT 0,
  ai_accepts INTEGER NOT NULL DEFAULT 0,
  ai_rejects INTEGER NOT NULL DEFAULT 0,
  format_errors INTEGER NOT NULL DEFAULT 0,
  words_added INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.editor_sessions TO authenticated;
GRANT ALL ON public.editor_sessions TO service_role;
ALTER TABLE public.editor_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Editor sessions: own all" ON public.editor_sessions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX editor_sessions_user_idx ON public.editor_sessions(user_id, started_at DESC);
CREATE TRIGGER update_editor_sessions_updated_at BEFORE UPDATE ON public.editor_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
