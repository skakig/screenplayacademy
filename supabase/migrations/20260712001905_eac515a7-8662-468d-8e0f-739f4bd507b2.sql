
-- Phase 3 — World & story entities (universe-scoped, owner-only RLS)
-- Persisted rows produced by promoting import_candidates of world/story types.

CREATE TABLE public.world_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id UUID NOT NULL REFERENCES public.story_universes(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES public.import_candidates(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  normalized_key TEXT NOT NULL,
  int_ext TEXT,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (universe_id, normalized_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.world_locations TO authenticated;
GRANT ALL ON public.world_locations TO service_role;
ALTER TABLE public.world_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "world_locations_owner_all" ON public.world_locations FOR ALL
  USING (EXISTS (SELECT 1 FROM public.story_universes u WHERE u.id = universe_id AND u.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.story_universes u WHERE u.id = universe_id AND u.owner_id = auth.uid()));
CREATE INDEX idx_world_locations_universe ON public.world_locations(universe_id);
CREATE TRIGGER trg_world_locations_updated BEFORE UPDATE ON public.world_locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.world_factions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id UUID NOT NULL REFERENCES public.story_universes(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES public.import_candidates(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  normalized_key TEXT NOT NULL,
  kind TEXT,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (universe_id, normalized_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.world_factions TO authenticated;
GRANT ALL ON public.world_factions TO service_role;
ALTER TABLE public.world_factions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "world_factions_owner_all" ON public.world_factions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.story_universes u WHERE u.id = universe_id AND u.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.story_universes u WHERE u.id = universe_id AND u.owner_id = auth.uid()));
CREATE INDEX idx_world_factions_universe ON public.world_factions(universe_id);
CREATE TRIGGER trg_world_factions_updated BEFORE UPDATE ON public.world_factions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.world_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id UUID NOT NULL REFERENCES public.story_universes(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES public.import_candidates(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  normalized_key TEXT NOT NULL,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (universe_id, normalized_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.world_artifacts TO authenticated;
GRANT ALL ON public.world_artifacts TO service_role;
ALTER TABLE public.world_artifacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "world_artifacts_owner_all" ON public.world_artifacts FOR ALL
  USING (EXISTS (SELECT 1 FROM public.story_universes u WHERE u.id = universe_id AND u.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.story_universes u WHERE u.id = universe_id AND u.owner_id = auth.uid()));
CREATE INDEX idx_world_artifacts_universe ON public.world_artifacts(universe_id);
CREATE TRIGGER trg_world_artifacts_updated BEFORE UPDATE ON public.world_artifacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.world_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id UUID NOT NULL REFERENCES public.story_universes(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES public.import_candidates(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  normalized_key TEXT NOT NULL,
  statement TEXT NOT NULL,
  scope TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (universe_id, normalized_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.world_rules TO authenticated;
GRANT ALL ON public.world_rules TO service_role;
ALTER TABLE public.world_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "world_rules_owner_all" ON public.world_rules FOR ALL
  USING (EXISTS (SELECT 1 FROM public.story_universes u WHERE u.id = universe_id AND u.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.story_universes u WHERE u.id = universe_id AND u.owner_id = auth.uid()));
CREATE INDEX idx_world_rules_universe ON public.world_rules(universe_id);
CREATE TRIGGER trg_world_rules_updated BEFORE UPDATE ON public.world_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.world_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id UUID NOT NULL REFERENCES public.story_universes(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES public.import_candidates(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  normalized_key TEXT NOT NULL,
  summary TEXT,
  sequence INTEGER,
  location_id UUID REFERENCES public.world_locations(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (universe_id, normalized_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.world_events TO authenticated;
GRANT ALL ON public.world_events TO service_role;
ALTER TABLE public.world_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "world_events_owner_all" ON public.world_events FOR ALL
  USING (EXISTS (SELECT 1 FROM public.story_universes u WHERE u.id = universe_id AND u.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.story_universes u WHERE u.id = universe_id AND u.owner_id = auth.uid()));
CREATE INDEX idx_world_events_universe ON public.world_events(universe_id);
CREATE INDEX idx_world_events_sequence ON public.world_events(universe_id, sequence);
CREATE TRIGGER trg_world_events_updated BEFORE UPDATE ON public.world_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.world_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id UUID NOT NULL REFERENCES public.story_universes(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES public.import_candidates(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  normalized_key TEXT NOT NULL,
  question TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (universe_id, normalized_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.world_threads TO authenticated;
GRANT ALL ON public.world_threads TO service_role;
ALTER TABLE public.world_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "world_threads_owner_all" ON public.world_threads FOR ALL
  USING (EXISTS (SELECT 1 FROM public.story_universes u WHERE u.id = universe_id AND u.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.story_universes u WHERE u.id = universe_id AND u.owner_id = auth.uid()));
CREATE INDEX idx_world_threads_universe ON public.world_threads(universe_id);
CREATE TRIGGER trg_world_threads_updated BEFORE UPDATE ON public.world_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.world_timeline_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id UUID NOT NULL REFERENCES public.story_universes(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.world_events(id) ON DELETE SET NULL,
  candidate_id UUID REFERENCES public.import_candidates(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  when_hint TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.world_timeline_entries TO authenticated;
GRANT ALL ON public.world_timeline_entries TO service_role;
ALTER TABLE public.world_timeline_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "world_timeline_entries_owner_all" ON public.world_timeline_entries FOR ALL
  USING (EXISTS (SELECT 1 FROM public.story_universes u WHERE u.id = universe_id AND u.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.story_universes u WHERE u.id = universe_id AND u.owner_id = auth.uid()));
CREATE INDEX idx_world_timeline_universe ON public.world_timeline_entries(universe_id, sequence);
CREATE TRIGGER trg_world_timeline_updated BEFORE UPDATE ON public.world_timeline_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
