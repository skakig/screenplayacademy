
CREATE TABLE public.story_universes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  primary_language TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.story_universes TO authenticated;
GRANT ALL ON public.story_universes TO service_role;
ALTER TABLE public.story_universes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "universes_owner_all" ON public.story_universes
  FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER trg_story_universes_updated_at
  BEFORE UPDATE ON public.story_universes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_story_universes_owner ON public.story_universes(owner_id);

CREATE TABLE public.source_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id UUID NOT NULL REFERENCES public.story_universes(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'unknown',
  media_type TEXT NOT NULL DEFAULT 'text/plain',
  language TEXT,
  filename TEXT,
  byte_size INTEGER NOT NULL DEFAULT 0,
  checksum TEXT NOT NULL,
  storage_path TEXT,
  normalized_text TEXT,
  parser_adapter TEXT,
  parser_version TEXT,
  structural_hints JSONB NOT NULL DEFAULT '{}'::jsonb,
  diagnostics JSONB NOT NULL DEFAULT '{}'::jsonb,
  authority TEXT NOT NULL DEFAULT 'reference',
  rights_note TEXT,
  status TEXT NOT NULL DEFAULT 'ingested',
  ingest_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (universe_id, checksum)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.source_documents TO authenticated;
GRANT ALL ON public.source_documents TO service_role;
ALTER TABLE public.source_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "source_documents_universe_owner_all" ON public.source_documents
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.story_universes u
             WHERE u.id = universe_id AND u.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.story_universes u
             WHERE u.id = universe_id AND u.owner_id = auth.uid())
  );
CREATE TRIGGER trg_source_documents_updated_at
  BEFORE UPDATE ON public.source_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_source_documents_universe ON public.source_documents(universe_id);
CREATE INDEX idx_source_documents_project ON public.source_documents(project_id);

CREATE TABLE public.source_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.source_documents(id) ON DELETE CASCADE,
  universe_id UUID NOT NULL REFERENCES public.story_universes(id) ON DELETE CASCADE,
  segment_type TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  heading TEXT,
  raw_text TEXT NOT NULL,
  normalized_text TEXT NOT NULL,
  location JSONB NOT NULL DEFAULT '{}'::jsonb,
  speakers TEXT[] NOT NULL DEFAULT '{}',
  language TEXT,
  checksum TEXT NOT NULL,
  segmenter_adapter TEXT NOT NULL,
  segmenter_version TEXT NOT NULL,
  stable_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, segmenter_adapter, segmenter_version, sequence)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.source_segments TO authenticated;
GRANT ALL ON public.source_segments TO service_role;
ALTER TABLE public.source_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "source_segments_universe_owner_all" ON public.source_segments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.story_universes u
             WHERE u.id = universe_id AND u.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.story_universes u
             WHERE u.id = universe_id AND u.owner_id = auth.uid())
  );
CREATE INDEX idx_source_segments_document ON public.source_segments(document_id, sequence);
CREATE INDEX idx_source_segments_universe ON public.source_segments(universe_id);
CREATE INDEX idx_source_segments_stable_key ON public.source_segments(stable_key);

CREATE TABLE public.import_extraction_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.source_documents(id) ON DELETE CASCADE,
  universe_id UUID NOT NULL REFERENCES public.story_universes(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  adapter TEXT NOT NULL,
  adapter_version TEXT NOT NULL,
  input_checksum TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'succeeded',
  output_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, stage, adapter, adapter_version, input_checksum)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_extraction_runs TO authenticated;
GRANT ALL ON public.import_extraction_runs TO service_role;
ALTER TABLE public.import_extraction_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "extraction_runs_universe_owner_all" ON public.import_extraction_runs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.story_universes u
             WHERE u.id = universe_id AND u.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.story_universes u
             WHERE u.id = universe_id AND u.owner_id = auth.uid())
  );
CREATE INDEX idx_extraction_runs_document ON public.import_extraction_runs(document_id, stage);
