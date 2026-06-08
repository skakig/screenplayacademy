-- character_snapshots
CREATE TABLE public.character_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  character_id uuid NOT NULL,
  register text,
  verbosity text,
  vocabulary_signature jsonb NOT NULL DEFAULT '[]'::jsonb,
  emotional_baseline jsonb NOT NULL DEFAULT '{}'::jsonb,
  goals jsonb NOT NULL DEFAULT '[]'::jsonb,
  known_languages jsonb NOT NULL DEFAULT '[]'::jsonb,
  line_count integer NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (character_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.character_snapshots TO authenticated;
GRANT ALL ON public.character_snapshots TO service_role;
ALTER TABLE public.character_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Char snapshots: owner all" ON public.character_snapshots
  FOR ALL USING (public.owns_project(project_id))
  WITH CHECK (public.owns_project(project_id));
CREATE TRIGGER tr_character_snapshots_updated_at
  BEFORE UPDATE ON public.character_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- character_evidence_events
CREATE TABLE public.character_evidence_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  character_id uuid NOT NULL,
  scene_id uuid,
  block_id uuid,
  event_type text NOT NULL DEFAULT 'dialogue',
  content text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cee_character ON public.character_evidence_events(character_id, created_at);
CREATE INDEX idx_cee_project ON public.character_evidence_events(project_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.character_evidence_events TO authenticated;
GRANT ALL ON public.character_evidence_events TO service_role;
ALTER TABLE public.character_evidence_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Char evidence: owner all" ON public.character_evidence_events
  FOR ALL USING (public.owns_project(project_id))
  WITH CHECK (public.owns_project(project_id));

-- scene_patterns
CREATE TABLE public.scene_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  scene_id uuid NOT NULL,
  capability_type text,
  constraint_level integer,
  communicative_intent text,
  environmental_stakes text,
  success_condition text,
  failure_branches jsonb NOT NULL DEFAULT '[]'::jsonb,
  pattern_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scene_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scene_patterns TO authenticated;
GRANT ALL ON public.scene_patterns TO service_role;
ALTER TABLE public.scene_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scene patterns: owner all" ON public.scene_patterns
  FOR ALL USING (public.owns_project(project_id))
  WITH CHECK (public.owns_project(project_id));
CREATE TRIGGER tr_scene_patterns_updated_at
  BEFORE UPDATE ON public.scene_patterns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();