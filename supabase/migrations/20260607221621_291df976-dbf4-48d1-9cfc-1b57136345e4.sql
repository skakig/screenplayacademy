
-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles: own read" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Profiles: own update" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Profiles: own insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- PROJECTS
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  project_type TEXT NOT NULL DEFAULT 'Feature Film',
  genre TEXT,
  tone TEXT,
  target_length TEXT,
  logline TEXT,
  ai_help_level TEXT DEFAULT 'Balanced',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Projects: owner all" ON public.projects FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_projects_user ON public.projects(user_id);

-- Helper: does the current user own this project?
CREATE OR REPLACE FUNCTION public.owns_project(_project_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.projects WHERE id = _project_id AND user_id = auth.uid());
$$;

-- SCENES
CREATE TABLE public.scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT,
  scene_heading TEXT,
  location TEXT,
  time_of_day TEXT,
  emotional_purpose TEXT,
  plot_purpose TEXT,
  conflict TEXT,
  reversal TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'idea',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scenes TO authenticated;
GRANT ALL ON public.scenes TO service_role;
ALTER TABLE public.scenes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scenes: owner all" ON public.scenes FOR ALL USING (public.owns_project(project_id)) WITH CHECK (public.owns_project(project_id));
CREATE TRIGGER trg_scenes_updated BEFORE UPDATE ON public.scenes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_scenes_project ON public.scenes(project_id);

-- CHARACTERS
CREATE TABLE public.characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  age TEXT,
  archetype TEXT,
  external_goal TEXT,
  internal_need TEXT,
  wound TEXT,
  secret TEXT,
  fear TEXT,
  contradiction TEXT,
  voice_style TEXT,
  speech_patterns TEXT,
  visual_description TEXT,
  costume_notes TEXT,
  relationships TEXT,
  character_arc TEXT,
  elevenlabs_voice_id TEXT,
  image_prompt TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.characters TO authenticated;
GRANT ALL ON public.characters TO service_role;
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Characters: owner all" ON public.characters FOR ALL USING (public.owns_project(project_id)) WITH CHECK (public.owns_project(project_id));
CREATE TRIGGER trg_characters_updated BEFORE UPDATE ON public.characters FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_characters_project ON public.characters(project_id);

-- SCRIPT BLOCKS
CREATE TABLE public.script_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  scene_id UUID REFERENCES public.scenes(id) ON DELETE SET NULL,
  block_type TEXT NOT NULL DEFAULT 'action',
  content TEXT NOT NULL DEFAULT '',
  character_id UUID REFERENCES public.characters(id) ON DELETE SET NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.script_blocks TO authenticated;
GRANT ALL ON public.script_blocks TO service_role;
ALTER TABLE public.script_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Blocks: owner all" ON public.script_blocks FOR ALL USING (public.owns_project(project_id)) WITH CHECK (public.owns_project(project_id));
CREATE TRIGGER trg_blocks_updated BEFORE UPDATE ON public.script_blocks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_blocks_project ON public.script_blocks(project_id);
CREATE INDEX idx_blocks_scene ON public.script_blocks(scene_id);

-- AI REQUESTS LOG
CREATE TABLE public.ai_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL,
  input JSONB,
  output JSONB,
  tokens_used INTEGER,
  status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ai_requests TO authenticated;
GRANT ALL ON public.ai_requests TO service_role;
ALTER TABLE public.ai_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "AI: own read" ON public.ai_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "AI: own insert" ON public.ai_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
