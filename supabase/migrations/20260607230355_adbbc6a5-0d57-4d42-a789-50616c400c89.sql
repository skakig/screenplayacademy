
-- Extend characters with the full rich profile fields
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS group_name text NOT NULL DEFAULT 'Main Cast',
  ADD COLUMN IF NOT EXISTS alias text,
  ADD COLUMN IF NOT EXISTS character_type text,
  ADD COLUMN IF NOT EXISTS occupation text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS core_lie text,
  -- Backstory
  ADD COLUMN IF NOT EXISTS childhood text,
  ADD COLUMN IF NOT EXISTS defining_wound text,
  ADD COLUMN IF NOT EXISTS formative_relationship text,
  ADD COLUMN IF NOT EXISTS biggest_loss text,
  ADD COLUMN IF NOT EXISTS biggest_shame text,
  ADD COLUMN IF NOT EXISTS life_before_story text,
  ADD COLUMN IF NOT EXISTS lies_about text,
  ADD COLUMN IF NOT EXISTS never_says_aloud text,
  -- Personality
  ADD COLUMN IF NOT EXISTS temperament text,
  ADD COLUMN IF NOT EXISTS strengths text,
  ADD COLUMN IF NOT EXISTS flaws text,
  ADD COLUMN IF NOT EXISTS habits text,
  ADD COLUMN IF NOT EXISTS conflict_style text,
  ADD COLUMN IF NOT EXISTS fear_response text,
  ADD COLUMN IF NOT EXISTS trust_triggers text,
  ADD COLUMN IF NOT EXISTS betrayal_triggers text,
  ADD COLUMN IF NOT EXISTS humor_style text,
  -- TMH moral profile
  ADD COLUMN IF NOT EXISTS tmh_baseline integer,
  ADD COLUMN IF NOT EXISTS tmh_stress integer,
  ADD COLUMN IF NOT EXISTS tmh_aspirational integer,
  ADD COLUMN IF NOT EXISTS tmh_shadow integer,
  ADD COLUMN IF NOT EXISTS moral_wound text,
  ADD COLUMN IF NOT EXISTS moral_blind_spot text,
  ADD COLUMN IF NOT EXISTS core_temptation text,
  ADD COLUMN IF NOT EXISTS core_virtue text,
  ADD COLUMN IF NOT EXISTS core_vice text,
  ADD COLUMN IF NOT EXISTS moral_test text,
  ADD COLUMN IF NOT EXISTS what_they_justify text,
  ADD COLUMN IF NOT EXISTS would_never_do text,
  ADD COLUMN IF NOT EXISTS might_do_under_pressure text,
  ADD COLUMN IF NOT EXISTS redemption_path text,
  ADD COLUMN IF NOT EXISTS corruption_path text,
  -- Voice & dialogue
  ADD COLUMN IF NOT EXISTS voice_summary text,
  ADD COLUMN IF NOT EXISTS vocabulary_level text,
  ADD COLUMN IF NOT EXISTS sentence_rhythm text,
  ADD COLUMN IF NOT EXISTS directness_level text,
  ADD COLUMN IF NOT EXISTS emotional_openness text,
  ADD COLUMN IF NOT EXISTS favorite_phrases text,
  ADD COLUMN IF NOT EXISTS forbidden_phrases text,
  ADD COLUMN IF NOT EXISTS how_they_lie text,
  ADD COLUMN IF NOT EXISTS how_they_apologize text,
  ADD COLUMN IF NOT EXISTS how_they_threaten text,
  ADD COLUMN IF NOT EXISTS subtext_pattern text,
  ADD COLUMN IF NOT EXISTS silence_pattern text,
  ADD COLUMN IF NOT EXISTS voice_archetype text,
  -- Visual identity
  ADD COLUMN IF NOT EXISTS color_palette text,
  ADD COLUMN IF NOT EXISTS signature_props text,
  ADD COLUMN IF NOT EXISTS visual_symbol text,
  ADD COLUMN IF NOT EXISTS movement_style text,
  ADD COLUMN IF NOT EXISTS portrait_url text,
  -- Arc
  ADD COLUMN IF NOT EXISTS starting_belief text,
  ADD COLUMN IF NOT EXISTS ending_belief text,
  ADD COLUMN IF NOT EXISTS starting_behavior text,
  ADD COLUMN IF NOT EXISTS ending_behavior text,
  ADD COLUMN IF NOT EXISTS act1_state text,
  ADD COLUMN IF NOT EXISTS act2_pressure text,
  ADD COLUMN IF NOT EXISTS midpoint_shift text,
  ADD COLUMN IF NOT EXISTS dark_night_state text,
  ADD COLUMN IF NOT EXISTS climax_choice text,
  ADD COLUMN IF NOT EXISTS final_image text;

-- Relationships
CREATE TABLE IF NOT EXISTS public.character_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  character_id uuid NOT NULL,
  related_character_id uuid NOT NULL,
  relationship_type text,
  public_dynamic text,
  private_truth text,
  power_dynamic text,
  wants_from_other text,
  other_wants text,
  secret_between text,
  trust_level integer,
  conflict_level integer,
  relationship_arc text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.character_relationships TO authenticated;
GRANT ALL ON public.character_relationships TO service_role;
ALTER TABLE public.character_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Relationships: owner all" ON public.character_relationships
  FOR ALL USING (public.owns_project(project_id)) WITH CHECK (public.owns_project(project_id));
CREATE TRIGGER trg_character_relationships_updated_at
  BEFORE UPDATE ON public.character_relationships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Scene states
CREATE TABLE IF NOT EXISTS public.character_scene_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  character_id uuid NOT NULL,
  scene_id uuid NOT NULL,
  emotional_state text,
  goal_in_scene text,
  fear_in_scene text,
  tactic text,
  tmh_level integer,
  moral_pressure text,
  relationship_shift text,
  secret_status text,
  continuity_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (character_id, scene_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.character_scene_states TO authenticated;
GRANT ALL ON public.character_scene_states TO service_role;
ALTER TABLE public.character_scene_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scene states: owner all" ON public.character_scene_states
  FOR ALL USING (public.owns_project(project_id)) WITH CHECK (public.owns_project(project_id));
CREATE TRIGGER trg_character_scene_states_updated_at
  BEFORE UPDATE ON public.character_scene_states
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
