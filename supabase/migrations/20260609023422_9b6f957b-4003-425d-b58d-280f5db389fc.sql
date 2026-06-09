
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_languages text[] NOT NULL DEFAULT ARRAY['en']::text[],
  ADD COLUMN IF NOT EXISTS ui_language text NOT NULL DEFAULT 'en';

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS screenplay_language text NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS project_language text NOT NULL DEFAULT 'en';

ALTER TABLE public.script_blocks
  ADD COLUMN IF NOT EXISTS language text;

ALTER TABLE public.project_dictionary
  ADD COLUMN IF NOT EXISTS language text,
  ADD COLUMN IF NOT EXISTS cognate_of jsonb,
  ADD COLUMN IF NOT EXISTS false_friend_risk text[];
