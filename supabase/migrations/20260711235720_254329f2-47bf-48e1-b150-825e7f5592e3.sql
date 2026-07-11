ALTER TABLE public.audio_assets
  ADD COLUMN IF NOT EXISTS lines_total integer,
  ADD COLUMN IF NOT EXISTS lines_done integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_line_label text,
  ADD COLUMN IF NOT EXISTS error_message text;