
CREATE TABLE public.import_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id UUID NOT NULL REFERENCES public.story_universes(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.source_documents(id) ON DELETE SET NULL,
  candidate_type TEXT NOT NULL,
  normalized_key TEXT NOT NULL,
  proposed_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC(4,3) NOT NULL DEFAULT 0.5,
  status TEXT NOT NULL DEFAULT 'pending',   -- pending|accepted|rejected|merged|kept_separate
  review_notes TEXT,
  promoted_ref JSONB,                       -- { table, id } once promoted
  extractor_adapter TEXT NOT NULL,
  extractor_version TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (universe_id, candidate_type, normalized_key, extractor_adapter, extractor_version)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_candidates TO authenticated;
GRANT ALL ON public.import_candidates TO service_role;
ALTER TABLE public.import_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "import_candidates_owner_all" ON public.import_candidates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.story_universes u
             WHERE u.id = universe_id AND u.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.story_universes u
             WHERE u.id = universe_id AND u.owner_id = auth.uid())
  );
CREATE TRIGGER trg_import_candidates_updated_at
  BEFORE UPDATE ON public.import_candidates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_import_candidates_universe ON public.import_candidates(universe_id, status);
CREATE INDEX idx_import_candidates_type ON public.import_candidates(universe_id, candidate_type);

CREATE TABLE public.import_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.import_candidates(id) ON DELETE CASCADE,
  segment_id UUID NOT NULL REFERENCES public.source_segments(id) ON DELETE CASCADE,
  universe_id UUID NOT NULL REFERENCES public.story_universes(id) ON DELETE CASCADE,
  excerpt TEXT NOT NULL,
  evidence_type TEXT NOT NULL DEFAULT 'source_quotation',
  confidence NUMERIC(4,3) NOT NULL DEFAULT 0.5,
  direct_or_inferred TEXT NOT NULL DEFAULT 'direct',
  location_hint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, segment_id, excerpt)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_evidence TO authenticated;
GRANT ALL ON public.import_evidence TO service_role;
ALTER TABLE public.import_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "import_evidence_owner_all" ON public.import_evidence
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.story_universes u
             WHERE u.id = universe_id AND u.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.story_universes u
             WHERE u.id = universe_id AND u.owner_id = auth.uid())
  );
CREATE INDEX idx_import_evidence_candidate ON public.import_evidence(candidate_id);
CREATE INDEX idx_import_evidence_segment ON public.import_evidence(segment_id);

CREATE TABLE public.import_identity_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id UUID NOT NULL REFERENCES public.story_universes(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL,                -- character|location|faction|...
  subject_key TEXT NOT NULL,                 -- normalized name / cluster key
  decision TEXT NOT NULL,                    -- merge|keep_separate|link
  canonical_name TEXT,
  merged_candidate_ids UUID[] NOT NULL DEFAULT '{}',
  kept_separate_candidate_ids UUID[] NOT NULL DEFAULT '{}',
  reason TEXT,
  decided_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (universe_id, subject_type, subject_key, decision)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_identity_decisions TO authenticated;
GRANT ALL ON public.import_identity_decisions TO service_role;
ALTER TABLE public.import_identity_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "import_identity_decisions_owner_all" ON public.import_identity_decisions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.story_universes u
             WHERE u.id = universe_id AND u.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.story_universes u
             WHERE u.id = universe_id AND u.owner_id = auth.uid())
  );
CREATE TRIGGER trg_import_identity_decisions_updated_at
  BEFORE UPDATE ON public.import_identity_decisions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_import_identity_decisions_universe ON public.import_identity_decisions(universe_id, subject_type);
