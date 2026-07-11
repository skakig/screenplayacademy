ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS portrait_seed bigint,
  ADD COLUMN IF NOT EXISTS portrait_path text;

CREATE UNIQUE INDEX IF NOT EXISTS characters_project_voice_unique
  ON public.characters (project_id, elevenlabs_voice_id)
  WHERE elevenlabs_voice_id IS NOT NULL;