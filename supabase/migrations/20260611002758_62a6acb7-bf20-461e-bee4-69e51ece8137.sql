
-- ============== IMPORT SESSIONS ==============
CREATE TABLE public.import_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  file_name TEXT,
  raw_text TEXT,
  status TEXT NOT NULL DEFAULT 'uploaded',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_sessions TO authenticated;
GRANT ALL ON public.import_sessions TO service_role;
ALTER TABLE public.import_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Import sessions: owner select"
  ON public.import_sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND (project_id IS NULL OR public.owns_project(project_id)));

CREATE POLICY "Import sessions: owner insert"
  ON public.import_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND (project_id IS NULL OR public.owns_project(project_id)));

CREATE POLICY "Import sessions: owner update"
  ON public.import_sessions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Import sessions: owner delete"
  ON public.import_sessions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_import_sessions_project ON public.import_sessions(project_id, created_at DESC);
CREATE INDEX idx_import_sessions_user ON public.import_sessions(user_id, created_at DESC);

CREATE TRIGGER trg_import_sessions_updated
  BEFORE UPDATE ON public.import_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== IMPORT BLOCK CANDIDATES ==============
CREATE TABLE public.import_block_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_session_id UUID NOT NULL REFERENCES public.import_sessions(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  raw_text TEXT NOT NULL DEFAULT '',
  proposed_block_type TEXT NOT NULL DEFAULT 'action',
  confidence TEXT NOT NULL DEFAULT 'low',
  reason TEXT,
  needs_review BOOLEAN NOT NULL DEFAULT false,
  proposed_scene_index INTEGER,
  proposed_character_name TEXT,
  user_override_type TEXT,
  approved BOOLEAN NOT NULL DEFAULT false,
  removed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_block_candidates TO authenticated;
GRANT ALL ON public.import_block_candidates TO service_role;
ALTER TABLE public.import_block_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Import candidates: owner all"
  ON public.import_block_candidates FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.import_sessions s WHERE s.id = import_session_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.import_sessions s WHERE s.id = import_session_id AND s.user_id = auth.uid()));

CREATE INDEX idx_import_candidates_session ON public.import_block_candidates(import_session_id, order_index);

CREATE TRIGGER trg_import_candidates_updated
  BEFORE UPDATE ON public.import_block_candidates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== IMPORT REPORTS ==============
CREATE TABLE public.import_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  import_session_id UUID NOT NULL REFERENCES public.import_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary TEXT,
  counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_reports TO authenticated;
GRANT ALL ON public.import_reports TO service_role;
ALTER TABLE public.import_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Import reports: owner all"
  ON public.import_reports FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_import_reports_session ON public.import_reports(import_session_id);
CREATE INDEX idx_import_reports_project ON public.import_reports(project_id, created_at DESC);

CREATE TRIGGER trg_import_reports_updated
  BEFORE UPDATE ON public.import_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== IMPORT WARNINGS ==============
CREATE TABLE public.import_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.import_reports(id) ON DELETE CASCADE,
  severity TEXT NOT NULL DEFAULT 'info',
  type TEXT NOT NULL DEFAULT 'unknown',
  message TEXT NOT NULL DEFAULT '',
  related_candidate_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_warnings TO authenticated;
GRANT ALL ON public.import_warnings TO service_role;
ALTER TABLE public.import_warnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Import warnings: owner all"
  ON public.import_warnings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.import_reports r WHERE r.id = report_id AND r.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.import_reports r WHERE r.id = report_id AND r.user_id = auth.uid()));

CREATE INDEX idx_import_warnings_report ON public.import_warnings(report_id);

-- ============== IMPORT RECOMMENDATIONS ==============
CREATE TABLE public.import_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.import_reports(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'note',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  accepted BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_recommendations TO authenticated;
GRANT ALL ON public.import_recommendations TO service_role;
ALTER TABLE public.import_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Import recommendations: owner all"
  ON public.import_recommendations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.import_reports r WHERE r.id = report_id AND r.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.import_reports r WHERE r.id = report_id AND r.user_id = auth.uid()));

CREATE INDEX idx_import_recommendations_report ON public.import_recommendations(report_id);

CREATE TRIGGER trg_import_recommendations_updated
  BEFORE UPDATE ON public.import_recommendations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
