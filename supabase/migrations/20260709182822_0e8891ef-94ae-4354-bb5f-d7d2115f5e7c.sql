
INSERT INTO public.academy_modules (title, slug, description, order_index, estimated_minutes)
VALUES
  ('Screenplay Basics', 'screenplay-basics', 'The formatting language of the industry. Learn what each block does and why.', 1, 25),
  ('Story Engine', 'story-engine', 'Scenes that turn, characters that want, stakes that shift.', 2, 30)
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title,
      description = EXCLUDED.description,
      order_index = EXCLUDED.order_index,
      estimated_minutes = EXCLUDED.estimated_minutes;

WITH m AS (SELECT id FROM public.academy_modules WHERE slug = 'screenplay-basics')
INSERT INTO public.academy_lessons
  (module_id, title, slug, concept, why_it_matters, example, task_prompt, ai_button_label, order_index, estimated_minutes)
SELECT m.id, x.title, x.slug, x.concept, x.why_it_matters, x.example, x.task_prompt, x.ai_button_label, x.order_index, x.estimated_minutes
FROM m, (VALUES
  ('Scene Headings', 'scene-headings',
   'A scene heading (a "slugline") sets INT/EXT, LOCATION, and TIME. Uppercase. One line. It tells the reader — and later the producer — where and when we are.',
   'A missing or vague slug breaks scene numbering, budgeting, scheduling, and the reader''s spatial map. Directors and 1st ADs read slugs before anything else.',
   E'INT. STEPHAN''S APARTMENT — NIGHT\n\nA single lamp burns. Stephan stares at the ceiling.',
   'Rewrite the opening scene so the slugline is complete: INT or EXT, a specific location, and a time of day.',
   'Fix my sluglines', 1, 4),
  ('Action Lines', 'action-lines',
   'Action is what the camera can see and the microphone can hear. Present tense. Concrete verbs. No inner thoughts unless the character shows them.',
   'Prose that names emotions instead of showing them ("she is sad") kills momentum and reads amateur. Action is a visual grammar.',
   E'WEAK: Maria is really upset about the letter.\nSTRONG: Maria tears the letter, then flattens the pieces on the counter like she can put it back.',
   'Rewrite one action paragraph so every sentence describes something we can see or hear.',
   'Make this more visual', 2, 5),
  ('Show, Don''t Tell', 'show-dont-tell',
   '"Telling" states a feeling or fact. "Showing" gives the reader an image or behavior that lets them draw the conclusion.',
   'Showing respects the audience and makes the reader do the emotional work — which is what makes them care.',
   E'TELL: John is a bad father.\nSHOW: John hands his kid a beer, then goes back to the game.',
   'Pick one line where you told us something and rewrite it as behavior.',
   'Show, don''t tell this', 3, 5),
  ('Character Cues', 'character-cues',
   'A character cue is the UPPERCASE name centered above a dialogue block. First appearance often uses (CONT''D) rules and never re-introduces a name.',
   'Cues aren''t decoration — they drive scheduling ("day of work" per character), casting sides, and the table read.',
   E'STEPHAN\nJust a few more clicks.',
   'Give every dialogue block a clean cue. Delete any nickname-only or lowercase cues.',
   'Clean up my character cues', 4, 3),
  ('Dialogue Rhythm', 'dialogue-rhythm',
   'Speech on the page isn''t transcription. It''s the shortest line that lets the actor find the beat. Cut throat-clearing. Vary length.',
   'A page of dialogue where every line is the same length reads flat aloud. Rhythm carries subtext.',
   E'FLAT: I think we should probably go home now because it''s late.\nSHARP: We should go.\n(beat)\nBefore it gets weird.',
   'Take one dialogue exchange and cut every line by 30%. Read it aloud.',
   'Sharpen this dialogue', 5, 5),
  ('Parentheticals & Transitions', 'parentheticals-transitions',
   'Parentheticals ("wrylies") are for essential delivery only. Transitions (CUT TO:, SMASH CUT TO:) are used sparingly and mean something specific.',
   'Overused wrylies insult actors. Overused transitions look like a first draft trying to sound cinematic.',
   E'MARIA\n(quietly, to herself)\nHe knew.\n\nSMASH CUT TO:',
   'Delete every parenthetical that is not essential to how the line is read.',
   'Trim my wrylies', 6, 3)
) AS x(title, slug, concept, why_it_matters, example, task_prompt, ai_button_label, order_index, estimated_minutes)
ON CONFLICT (module_id, slug) DO UPDATE
  SET title = EXCLUDED.title, concept = EXCLUDED.concept, why_it_matters = EXCLUDED.why_it_matters,
      example = EXCLUDED.example, task_prompt = EXCLUDED.task_prompt, ai_button_label = EXCLUDED.ai_button_label,
      order_index = EXCLUDED.order_index, estimated_minutes = EXCLUDED.estimated_minutes;

WITH m AS (SELECT id FROM public.academy_modules WHERE slug = 'story-engine')
INSERT INTO public.academy_lessons
  (module_id, title, slug, concept, why_it_matters, example, task_prompt, ai_button_label, order_index, estimated_minutes)
SELECT m.id, x.title, x.slug, x.concept, x.why_it_matters, x.example, x.task_prompt, x.ai_button_label, x.order_index, x.estimated_minutes
FROM m, (VALUES
  ('The Scene Turn', 'scene-turn',
   'Every scene starts in one emotional/tactical state and ends in a different one. If nothing changed, it''s not a scene — it''s a checkpoint.',
   'Scenes without a turn are the #1 reason a first draft feels flat even when the dialogue is sharp.',
   E'START: Maria trusts Ben.\nEND: Maria realizes Ben has been lying — but decides to keep pretending.',
   'For one scene: write one sentence for the state at the start, one for the state at the end. They must be different.',
   'Diagnose the turn', 1, 6),
  ('Goal & Obstacle', 'goal-obstacle',
   'In every scene the POV character wants something specific and someone/something is in the way. No goal = no scene.',
   'When a character has no scene goal, actors have nothing to play and the audience has nothing to root for.',
   E'GOAL: Get the key from Dad without waking Mom.\nOBSTACLE: Dad is drunk and won''t stop talking.',
   'Name the goal and obstacle for your current scene. If you can''t, rewrite the scene.',
   'Name my goal & obstacle', 2, 5),
  ('Subtext', 'subtext',
   'Subtext is what characters really mean under what they say. In a well-written scene the surface conversation is about coffee; the real conversation is about power.',
   'On-the-nose dialogue announces the emotion. Subtext lets the audience feel smart for catching it.',
   E'ON-NOSE: I still love you.\nSUBTEXT: You left the porch light on.',
   'Pick a line where a character says exactly what they feel. Rewrite it as an image, an object, or an unrelated topic.',
   'Rewrite this with subtext', 3, 6),
  ('Stakes Shift', 'stakes-shift',
   'Stakes are what''s lost if the character fails. A good scene raises them — from personal to relational, relational to public, public to mortal.',
   'A story that ends with the same stakes it started with feels small, even if every scene is well-crafted.',
   E'START: Ben might get grounded.\nEND: Ben might get his sister deported.',
   'Write one line describing what changes at stake between scene start and scene end.',
   'Escalate my stakes', 4, 6),
  ('Character Wound', 'character-wound',
   'The wound is the past event a character refuses to look at — the reason they can''t just get what they want. It drives every misstep in the script.',
   'Characters without a wound feel like avatars. The wound is what makes a want feel earned.',
   E'WOUND: At 9, Stephan watched his brother drown. He now signs every relationship off before he''s asked to save it.',
   'For your protagonist, write the sentence: "The reason they can''t just __ is because __."',
   'Find my character''s wound', 5, 7)
) AS x(title, slug, concept, why_it_matters, example, task_prompt, ai_button_label, order_index, estimated_minutes)
ON CONFLICT (module_id, slug) DO UPDATE
  SET title = EXCLUDED.title, concept = EXCLUDED.concept, why_it_matters = EXCLUDED.why_it_matters,
      example = EXCLUDED.example, task_prompt = EXCLUDED.task_prompt, ai_button_label = EXCLUDED.ai_button_label,
      order_index = EXCLUDED.order_index, estimated_minutes = EXCLUDED.estimated_minutes;
