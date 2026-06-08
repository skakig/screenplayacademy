export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      academy_lessons: {
        Row: {
          ai_button_label: string | null
          concept: string | null
          created_at: string
          estimated_minutes: number
          example: string | null
          id: string
          module_id: string
          order_index: number
          slug: string
          task_prompt: string | null
          title: string
          why_it_matters: string | null
        }
        Insert: {
          ai_button_label?: string | null
          concept?: string | null
          created_at?: string
          estimated_minutes?: number
          example?: string | null
          id?: string
          module_id: string
          order_index?: number
          slug: string
          task_prompt?: string | null
          title: string
          why_it_matters?: string | null
        }
        Update: {
          ai_button_label?: string | null
          concept?: string | null
          created_at?: string
          estimated_minutes?: number
          example?: string | null
          id?: string
          module_id?: string
          order_index?: number
          slug?: string
          task_prompt?: string | null
          title?: string
          why_it_matters?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academy_lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "academy_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_modules: {
        Row: {
          created_at: string
          description: string | null
          estimated_minutes: number
          id: string
          order_index: number
          slug: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          estimated_minutes?: number
          id?: string
          order_index?: number
          slug: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          estimated_minutes?: number
          id?: string
          order_index?: number
          slug?: string
          title?: string
        }
        Relationships: []
      }
      ai_requests: {
        Row: {
          created_at: string
          id: string
          input: Json | null
          output: Json | null
          project_id: string | null
          request_type: string
          status: string | null
          tokens_used: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          input?: Json | null
          output?: Json | null
          project_id?: string | null
          request_type: string
          status?: string | null
          tokens_used?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          input?: Json | null
          output?: Json | null
          project_id?: string | null
          request_type?: string
          status?: string | null
          tokens_used?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_assets: {
        Row: {
          audio_url: string | null
          created_at: string
          duration_seconds: number | null
          id: string
          kind: string
          project_id: string
          scene_id: string | null
          status: string
          updated_at: string
          voice_map: Json
        }
        Insert: {
          audio_url?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          kind?: string
          project_id: string
          scene_id?: string | null
          status?: string
          updated_at?: string
          voice_map?: Json
        }
        Update: {
          audio_url?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          kind?: string
          project_id?: string
          scene_id?: string | null
          status?: string
          updated_at?: string
          voice_map?: Json
        }
        Relationships: []
      }
      character_arcs: {
        Row: {
          arc_type: string | null
          character_id: string
          climax_choice: string | null
          core_lie: string | null
          created_at: string
          ending_belief: string | null
          ending_tmh_level: number | null
          final_image: string | null
          id: string
          midpoint_tmh_level: number | null
          moral_test: string | null
          project_id: string
          regression_level: number | null
          starting_belief: string | null
          starting_tmh_level: number | null
          temptation: string | null
          truth_learned: string | null
          updated_at: string
        }
        Insert: {
          arc_type?: string | null
          character_id: string
          climax_choice?: string | null
          core_lie?: string | null
          created_at?: string
          ending_belief?: string | null
          ending_tmh_level?: number | null
          final_image?: string | null
          id?: string
          midpoint_tmh_level?: number | null
          moral_test?: string | null
          project_id: string
          regression_level?: number | null
          starting_belief?: string | null
          starting_tmh_level?: number | null
          temptation?: string | null
          truth_learned?: string | null
          updated_at?: string
        }
        Update: {
          arc_type?: string | null
          character_id?: string
          climax_choice?: string | null
          core_lie?: string | null
          created_at?: string
          ending_belief?: string | null
          ending_tmh_level?: number | null
          final_image?: string | null
          id?: string
          midpoint_tmh_level?: number | null
          moral_test?: string | null
          project_id?: string
          regression_level?: number | null
          starting_belief?: string | null
          starting_tmh_level?: number | null
          temptation?: string | null
          truth_learned?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      character_evidence_events: {
        Row: {
          block_id: string | null
          character_id: string
          content: string
          created_at: string
          event_type: string
          id: string
          metadata: Json
          project_id: string
          scene_id: string | null
        }
        Insert: {
          block_id?: string | null
          character_id: string
          content?: string
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          project_id: string
          scene_id?: string | null
        }
        Update: {
          block_id?: string | null
          character_id?: string
          content?: string
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          project_id?: string
          scene_id?: string | null
        }
        Relationships: []
      }
      character_relationships: {
        Row: {
          character_id: string
          conflict_level: number | null
          created_at: string
          id: string
          other_wants: string | null
          power_dynamic: string | null
          private_truth: string | null
          project_id: string
          public_dynamic: string | null
          related_character_id: string
          relationship_arc: string | null
          relationship_type: string | null
          secret_between: string | null
          trust_level: number | null
          updated_at: string
          wants_from_other: string | null
        }
        Insert: {
          character_id: string
          conflict_level?: number | null
          created_at?: string
          id?: string
          other_wants?: string | null
          power_dynamic?: string | null
          private_truth?: string | null
          project_id: string
          public_dynamic?: string | null
          related_character_id: string
          relationship_arc?: string | null
          relationship_type?: string | null
          secret_between?: string | null
          trust_level?: number | null
          updated_at?: string
          wants_from_other?: string | null
        }
        Update: {
          character_id?: string
          conflict_level?: number | null
          created_at?: string
          id?: string
          other_wants?: string | null
          power_dynamic?: string | null
          private_truth?: string | null
          project_id?: string
          public_dynamic?: string | null
          related_character_id?: string
          relationship_arc?: string | null
          relationship_type?: string | null
          secret_between?: string | null
          trust_level?: number | null
          updated_at?: string
          wants_from_other?: string | null
        }
        Relationships: []
      }
      character_scene_arc_states: {
        Row: {
          arc_movement: string | null
          character_id: string
          cost: string | null
          created_at: string
          emotional_state_end: string | null
          emotional_state_start: string | null
          goal_in_scene: string | null
          id: string
          lie_believed: string | null
          need_in_scene: string | null
          project_id: string
          relationship_shift: string | null
          revelation: string | null
          scene_id: string
          tactic: string | null
          tmh_end_level: number | null
          tmh_start_level: number | null
          updated_at: string
        }
        Insert: {
          arc_movement?: string | null
          character_id: string
          cost?: string | null
          created_at?: string
          emotional_state_end?: string | null
          emotional_state_start?: string | null
          goal_in_scene?: string | null
          id?: string
          lie_believed?: string | null
          need_in_scene?: string | null
          project_id: string
          relationship_shift?: string | null
          revelation?: string | null
          scene_id: string
          tactic?: string | null
          tmh_end_level?: number | null
          tmh_start_level?: number | null
          updated_at?: string
        }
        Update: {
          arc_movement?: string | null
          character_id?: string
          cost?: string | null
          created_at?: string
          emotional_state_end?: string | null
          emotional_state_start?: string | null
          goal_in_scene?: string | null
          id?: string
          lie_believed?: string | null
          need_in_scene?: string | null
          project_id?: string
          relationship_shift?: string | null
          revelation?: string | null
          scene_id?: string
          tactic?: string | null
          tmh_end_level?: number | null
          tmh_start_level?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      character_scene_states: {
        Row: {
          character_id: string
          continuity_notes: string | null
          created_at: string
          emotional_state: string | null
          fear_in_scene: string | null
          goal_in_scene: string | null
          id: string
          moral_pressure: string | null
          project_id: string
          relationship_shift: string | null
          scene_id: string
          secret_status: string | null
          tactic: string | null
          tmh_level: number | null
          updated_at: string
        }
        Insert: {
          character_id: string
          continuity_notes?: string | null
          created_at?: string
          emotional_state?: string | null
          fear_in_scene?: string | null
          goal_in_scene?: string | null
          id?: string
          moral_pressure?: string | null
          project_id: string
          relationship_shift?: string | null
          scene_id: string
          secret_status?: string | null
          tactic?: string | null
          tmh_level?: number | null
          updated_at?: string
        }
        Update: {
          character_id?: string
          continuity_notes?: string | null
          created_at?: string
          emotional_state?: string | null
          fear_in_scene?: string | null
          goal_in_scene?: string | null
          id?: string
          moral_pressure?: string | null
          project_id?: string
          relationship_shift?: string | null
          scene_id?: string
          secret_status?: string | null
          tactic?: string | null
          tmh_level?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      character_snapshots: {
        Row: {
          character_id: string
          computed_at: string
          created_at: string
          emotional_baseline: Json
          goals: Json
          id: string
          known_languages: Json
          line_count: number
          project_id: string
          register: string | null
          updated_at: string
          verbosity: string | null
          vocabulary_signature: Json
        }
        Insert: {
          character_id: string
          computed_at?: string
          created_at?: string
          emotional_baseline?: Json
          goals?: Json
          id?: string
          known_languages?: Json
          line_count?: number
          project_id: string
          register?: string | null
          updated_at?: string
          verbosity?: string | null
          vocabulary_signature?: Json
        }
        Update: {
          character_id?: string
          computed_at?: string
          created_at?: string
          emotional_baseline?: Json
          goals?: Json
          id?: string
          known_languages?: Json
          line_count?: number
          project_id?: string
          register?: string | null
          updated_at?: string
          verbosity?: string | null
          vocabulary_signature?: Json
        }
        Relationships: []
      }
      characters: {
        Row: {
          act1_state: string | null
          act2_pressure: string | null
          age: string | null
          alias: string | null
          archetype: string | null
          betrayal_triggers: string | null
          biggest_loss: string | null
          biggest_shame: string | null
          character_arc: string | null
          character_type: string | null
          childhood: string | null
          climax_choice: string | null
          color_palette: string | null
          conflict_style: string | null
          contradiction: string | null
          core_lie: string | null
          core_temptation: string | null
          core_vice: string | null
          core_virtue: string | null
          corruption_path: string | null
          costume_notes: string | null
          created_at: string
          dark_night_state: string | null
          defining_wound: string | null
          directness_level: string | null
          elevenlabs_voice_id: string | null
          emotional_openness: string | null
          ending_behavior: string | null
          ending_belief: string | null
          external_goal: string | null
          favorite_phrases: string | null
          fear: string | null
          fear_response: string | null
          final_image: string | null
          flaws: string | null
          forbidden_phrases: string | null
          formative_relationship: string | null
          group_name: string
          habits: string | null
          how_they_apologize: string | null
          how_they_lie: string | null
          how_they_threaten: string | null
          humor_style: string | null
          id: string
          image_prompt: string | null
          internal_need: string | null
          lies_about: string | null
          life_before_story: string | null
          midpoint_shift: string | null
          might_do_under_pressure: string | null
          moral_blind_spot: string | null
          moral_test: string | null
          moral_wound: string | null
          movement_style: string | null
          name: string
          never_says_aloud: string | null
          occupation: string | null
          portrait_url: string | null
          project_id: string
          redemption_path: string | null
          relationships: string | null
          role: string | null
          secret: string | null
          sentence_rhythm: string | null
          signature_props: string | null
          silence_pattern: string | null
          speech_patterns: string | null
          starting_behavior: string | null
          starting_belief: string | null
          status: string | null
          strengths: string | null
          subtext_pattern: string | null
          summary: string | null
          temperament: string | null
          tmh_aspirational: number | null
          tmh_baseline: number | null
          tmh_shadow: number | null
          tmh_stress: number | null
          trust_triggers: string | null
          updated_at: string
          visual_description: string | null
          visual_symbol: string | null
          vocabulary_level: string | null
          voice_archetype: string | null
          voice_style: string | null
          voice_summary: string | null
          what_they_justify: string | null
          would_never_do: string | null
          wound: string | null
        }
        Insert: {
          act1_state?: string | null
          act2_pressure?: string | null
          age?: string | null
          alias?: string | null
          archetype?: string | null
          betrayal_triggers?: string | null
          biggest_loss?: string | null
          biggest_shame?: string | null
          character_arc?: string | null
          character_type?: string | null
          childhood?: string | null
          climax_choice?: string | null
          color_palette?: string | null
          conflict_style?: string | null
          contradiction?: string | null
          core_lie?: string | null
          core_temptation?: string | null
          core_vice?: string | null
          core_virtue?: string | null
          corruption_path?: string | null
          costume_notes?: string | null
          created_at?: string
          dark_night_state?: string | null
          defining_wound?: string | null
          directness_level?: string | null
          elevenlabs_voice_id?: string | null
          emotional_openness?: string | null
          ending_behavior?: string | null
          ending_belief?: string | null
          external_goal?: string | null
          favorite_phrases?: string | null
          fear?: string | null
          fear_response?: string | null
          final_image?: string | null
          flaws?: string | null
          forbidden_phrases?: string | null
          formative_relationship?: string | null
          group_name?: string
          habits?: string | null
          how_they_apologize?: string | null
          how_they_lie?: string | null
          how_they_threaten?: string | null
          humor_style?: string | null
          id?: string
          image_prompt?: string | null
          internal_need?: string | null
          lies_about?: string | null
          life_before_story?: string | null
          midpoint_shift?: string | null
          might_do_under_pressure?: string | null
          moral_blind_spot?: string | null
          moral_test?: string | null
          moral_wound?: string | null
          movement_style?: string | null
          name: string
          never_says_aloud?: string | null
          occupation?: string | null
          portrait_url?: string | null
          project_id: string
          redemption_path?: string | null
          relationships?: string | null
          role?: string | null
          secret?: string | null
          sentence_rhythm?: string | null
          signature_props?: string | null
          silence_pattern?: string | null
          speech_patterns?: string | null
          starting_behavior?: string | null
          starting_belief?: string | null
          status?: string | null
          strengths?: string | null
          subtext_pattern?: string | null
          summary?: string | null
          temperament?: string | null
          tmh_aspirational?: number | null
          tmh_baseline?: number | null
          tmh_shadow?: number | null
          tmh_stress?: number | null
          trust_triggers?: string | null
          updated_at?: string
          visual_description?: string | null
          visual_symbol?: string | null
          vocabulary_level?: string | null
          voice_archetype?: string | null
          voice_style?: string | null
          voice_summary?: string | null
          what_they_justify?: string | null
          would_never_do?: string | null
          wound?: string | null
        }
        Update: {
          act1_state?: string | null
          act2_pressure?: string | null
          age?: string | null
          alias?: string | null
          archetype?: string | null
          betrayal_triggers?: string | null
          biggest_loss?: string | null
          biggest_shame?: string | null
          character_arc?: string | null
          character_type?: string | null
          childhood?: string | null
          climax_choice?: string | null
          color_palette?: string | null
          conflict_style?: string | null
          contradiction?: string | null
          core_lie?: string | null
          core_temptation?: string | null
          core_vice?: string | null
          core_virtue?: string | null
          corruption_path?: string | null
          costume_notes?: string | null
          created_at?: string
          dark_night_state?: string | null
          defining_wound?: string | null
          directness_level?: string | null
          elevenlabs_voice_id?: string | null
          emotional_openness?: string | null
          ending_behavior?: string | null
          ending_belief?: string | null
          external_goal?: string | null
          favorite_phrases?: string | null
          fear?: string | null
          fear_response?: string | null
          final_image?: string | null
          flaws?: string | null
          forbidden_phrases?: string | null
          formative_relationship?: string | null
          group_name?: string
          habits?: string | null
          how_they_apologize?: string | null
          how_they_lie?: string | null
          how_they_threaten?: string | null
          humor_style?: string | null
          id?: string
          image_prompt?: string | null
          internal_need?: string | null
          lies_about?: string | null
          life_before_story?: string | null
          midpoint_shift?: string | null
          might_do_under_pressure?: string | null
          moral_blind_spot?: string | null
          moral_test?: string | null
          moral_wound?: string | null
          movement_style?: string | null
          name?: string
          never_says_aloud?: string | null
          occupation?: string | null
          portrait_url?: string | null
          project_id?: string
          redemption_path?: string | null
          relationships?: string | null
          role?: string | null
          secret?: string | null
          sentence_rhythm?: string | null
          signature_props?: string | null
          silence_pattern?: string | null
          speech_patterns?: string | null
          starting_behavior?: string | null
          starting_belief?: string | null
          status?: string | null
          strengths?: string | null
          subtext_pattern?: string | null
          summary?: string | null
          temperament?: string | null
          tmh_aspirational?: number | null
          tmh_baseline?: number | null
          tmh_shadow?: number | null
          tmh_stress?: number | null
          trust_triggers?: string | null
          updated_at?: string
          visual_description?: string | null
          visual_symbol?: string | null
          vocabulary_level?: string | null
          voice_archetype?: string | null
          voice_style?: string | null
          voice_summary?: string | null
          what_they_justify?: string | null
          would_never_do?: string | null
          wound?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "characters_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_recommendations: {
        Row: {
          body: string
          created_at: string
          id: string
          lesson_slug: string | null
          project_id: string
          resolved_at: string | null
          rule_key: string
          scene_id: string | null
          severity: string
          shown_at: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          lesson_slug?: string | null
          project_id: string
          resolved_at?: string | null
          rule_key: string
          scene_id?: string | null
          severity?: string
          shown_at?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          lesson_slug?: string | null
          project_id?: string
          resolved_at?: string | null
          rule_key?: string
          scene_id?: string | null
          severity?: string
          shown_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      editor_sessions: {
        Row: {
          ai_accepts: number
          ai_calls: number
          ai_rejects: number
          blocks_added: number
          created_at: string
          ended_at: string | null
          format_errors: number
          id: string
          project_id: string
          scenes_added: number
          started_at: string
          updated_at: string
          user_id: string
          words_added: number
        }
        Insert: {
          ai_accepts?: number
          ai_calls?: number
          ai_rejects?: number
          blocks_added?: number
          created_at?: string
          ended_at?: string | null
          format_errors?: number
          id?: string
          project_id: string
          scenes_added?: number
          started_at?: string
          updated_at?: string
          user_id: string
          words_added?: number
        }
        Update: {
          ai_accepts?: number
          ai_calls?: number
          ai_rejects?: number
          blocks_added?: number
          created_at?: string
          ended_at?: string | null
          format_errors?: number
          id?: string
          project_id?: string
          scenes_added?: number
          started_at?: string
          updated_at?: string
          user_id?: string
          words_added?: number
        }
        Relationships: []
      }
      guided_step_versions: {
        Row: {
          content: string
          created_at: string
          id: string
          label: string | null
          project_id: string
          source: string
          step_key: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          label?: string | null
          project_id: string
          source?: string
          step_key: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          label?: string | null
          project_id?: string
          source?: string
          step_key?: string
          user_id?: string
        }
        Relationships: []
      }
      pitch_packages: {
        Row: {
          budget_tier: string | null
          character_bible: string | null
          comparables: string | null
          created_at: string
          generated_at: string | null
          id: string
          logline: string | null
          one_page_synopsis: string | null
          pitch_email: string | null
          poster_prompt: string | null
          project_id: string
          short_synopsis: string | null
          target_audience: string | null
          tone_statement: string | null
          trailer_vo: string | null
          treatment: string | null
          updated_at: string
        }
        Insert: {
          budget_tier?: string | null
          character_bible?: string | null
          comparables?: string | null
          created_at?: string
          generated_at?: string | null
          id?: string
          logline?: string | null
          one_page_synopsis?: string | null
          pitch_email?: string | null
          poster_prompt?: string | null
          project_id: string
          short_synopsis?: string | null
          target_audience?: string | null
          tone_statement?: string | null
          trailer_vo?: string | null
          treatment?: string | null
          updated_at?: string
        }
        Update: {
          budget_tier?: string | null
          character_bible?: string | null
          comparables?: string | null
          created_at?: string
          generated_at?: string | null
          id?: string
          logline?: string | null
          one_page_synopsis?: string | null
          pitch_email?: string | null
          poster_prompt?: string | null
          project_id?: string
          short_synopsis?: string | null
          target_audience?: string | null
          tone_statement?: string | null
          trailer_vo?: string | null
          treatment?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          current_period_end: string | null
          email: string | null
          full_name: string | null
          id: string
          plan: string
          stripe_customer_id: string | null
          subscription_tier: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          current_period_end?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          plan?: string
          stripe_customer_id?: string | null
          subscription_tier?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          current_period_end?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          plan?: string
          stripe_customer_id?: string | null
          subscription_tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_guided_steps: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          order_index: number
          output_reference_id: string | null
          output_type: string | null
          project_id: string
          status: string
          step_key: string
          title: string
          updated_at: string
          user_id: string
          user_output: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          order_index?: number
          output_reference_id?: string | null
          output_type?: string | null
          project_id: string
          status?: string
          step_key: string
          title: string
          updated_at?: string
          user_id: string
          user_output?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          order_index?: number
          output_reference_id?: string | null
          output_type?: string | null
          project_id?: string
          status?: string
          step_key?: string
          title?: string
          updated_at?: string
          user_id?: string
          user_output?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          ai_help_level: string | null
          created_at: string
          genre: string | null
          id: string
          logline: string | null
          project_type: string
          status: string
          target_length: string | null
          title: string
          tone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_help_level?: string | null
          created_at?: string
          genre?: string | null
          id?: string
          logline?: string | null
          project_type?: string
          status?: string
          target_length?: string | null
          title: string
          tone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_help_level?: string | null
          created_at?: string
          genre?: string | null
          id?: string
          logline?: string | null
          project_type?: string
          status?: string
          target_length?: string | null
          title?: string
          tone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scene_arc_beats: {
        Row: {
          act: string | null
          arc_status: string | null
          created_at: string
          emotional_charge: number | null
          external_plot_change: string | null
          id: string
          moral_pressure: string | null
          project_id: string
          question_answered: string | null
          question_raised: string | null
          relationship_change: string | null
          scene_id: string
          scene_purpose: string | null
          scene_strength_score: number | null
          scene_turn: string | null
          sequence_name: string | null
          stakes_change: string | null
          story_beat: string | null
          theme_connection: string | null
          updated_at: string
        }
        Insert: {
          act?: string | null
          arc_status?: string | null
          created_at?: string
          emotional_charge?: number | null
          external_plot_change?: string | null
          id?: string
          moral_pressure?: string | null
          project_id: string
          question_answered?: string | null
          question_raised?: string | null
          relationship_change?: string | null
          scene_id: string
          scene_purpose?: string | null
          scene_strength_score?: number | null
          scene_turn?: string | null
          sequence_name?: string | null
          stakes_change?: string | null
          story_beat?: string | null
          theme_connection?: string | null
          updated_at?: string
        }
        Update: {
          act?: string | null
          arc_status?: string | null
          created_at?: string
          emotional_charge?: number | null
          external_plot_change?: string | null
          id?: string
          moral_pressure?: string | null
          project_id?: string
          question_answered?: string | null
          question_raised?: string | null
          relationship_change?: string | null
          scene_id?: string
          scene_purpose?: string | null
          scene_strength_score?: number | null
          scene_turn?: string | null
          sequence_name?: string | null
          stakes_change?: string | null
          story_beat?: string | null
          theme_connection?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      scene_patterns: {
        Row: {
          capability_type: string | null
          communicative_intent: string | null
          constraint_level: number | null
          created_at: string
          environmental_stakes: string | null
          failure_branches: Json
          id: string
          pattern_key: string | null
          project_id: string
          scene_id: string
          success_condition: string | null
          updated_at: string
        }
        Insert: {
          capability_type?: string | null
          communicative_intent?: string | null
          constraint_level?: number | null
          created_at?: string
          environmental_stakes?: string | null
          failure_branches?: Json
          id?: string
          pattern_key?: string | null
          project_id: string
          scene_id: string
          success_condition?: string | null
          updated_at?: string
        }
        Update: {
          capability_type?: string | null
          communicative_intent?: string | null
          constraint_level?: number | null
          created_at?: string
          environmental_stakes?: string | null
          failure_branches?: Json
          id?: string
          pattern_key?: string | null
          project_id?: string
          scene_id?: string
          success_condition?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      scenes: {
        Row: {
          conflict: string | null
          created_at: string
          emotional_purpose: string | null
          id: string
          location: string | null
          order_index: number
          plot_purpose: string | null
          project_id: string
          reversal: string | null
          scene_heading: string | null
          status: string
          time_of_day: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          conflict?: string | null
          created_at?: string
          emotional_purpose?: string | null
          id?: string
          location?: string | null
          order_index?: number
          plot_purpose?: string | null
          project_id: string
          reversal?: string | null
          scene_heading?: string | null
          status?: string
          time_of_day?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          conflict?: string | null
          created_at?: string
          emotional_purpose?: string | null
          id?: string
          location?: string | null
          order_index?: number
          plot_purpose?: string | null
          project_id?: string
          reversal?: string | null
          scene_heading?: string | null
          status?: string
          time_of_day?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scenes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      script_blocks: {
        Row: {
          block_type: string
          character_id: string | null
          content: string
          created_at: string
          id: string
          metadata: Json
          order_index: number
          project_id: string
          scene_id: string | null
          updated_at: string
        }
        Insert: {
          block_type?: string
          character_id?: string | null
          content?: string
          created_at?: string
          id?: string
          metadata?: Json
          order_index?: number
          project_id: string
          scene_id?: string | null
          updated_at?: string
        }
        Update: {
          block_type?: string
          character_id?: string | null
          content?: string
          created_at?: string
          id?: string
          metadata?: Json
          order_index?: number
          project_id?: string
          scene_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "script_blocks_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "script_blocks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "script_blocks_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      story_arcs: {
        Row: {
          arc_type: string | null
          central_question: string | null
          climax_choice: string | null
          created_at: string
          darkest_moment: string | null
          final_state: string | null
          id: string
          midpoint_shift: string | null
          opening_state: string | null
          project_id: string
          structure_model: string | null
          theme: string | null
          updated_at: string
        }
        Insert: {
          arc_type?: string | null
          central_question?: string | null
          climax_choice?: string | null
          created_at?: string
          darkest_moment?: string | null
          final_state?: string | null
          id?: string
          midpoint_shift?: string | null
          opening_state?: string | null
          project_id: string
          structure_model?: string | null
          theme?: string | null
          updated_at?: string
        }
        Update: {
          arc_type?: string | null
          central_question?: string | null
          climax_choice?: string | null
          created_at?: string
          darkest_moment?: string | null
          final_state?: string | null
          id?: string
          midpoint_shift?: string | null
          opening_state?: string | null
          project_id?: string
          structure_model?: string | null
          theme?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      storyboard_assets: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          order_index: number
          project_id: string
          prompt: string
          scene_id: string | null
          status: string
          style: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          order_index?: number
          project_id: string
          prompt: string
          scene_id?: string | null
          status?: string
          style?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          order_index?: number
          project_id?: string
          prompt?: string
          scene_id?: string | null
          status?: string
          style?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_lesson_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          lesson_id: string
          saved_output_id: string | null
          status: string
          updated_at: string
          user_id: string
          user_output: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          lesson_id: string
          saved_output_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
          user_output?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          lesson_id?: string
          saved_output_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          user_output?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "academy_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      user_onboarding: {
        Row: {
          app_walkthrough_completed: boolean
          coaching_level: string
          created_at: string
          first_project_created: boolean
          id: string
          preferred_mode: string
          updated_at: string
          user_id: string
          writer_experience_level: string | null
        }
        Insert: {
          app_walkthrough_completed?: boolean
          coaching_level?: string
          created_at?: string
          first_project_created?: boolean
          id?: string
          preferred_mode?: string
          updated_at?: string
          user_id: string
          writer_experience_level?: string | null
        }
        Update: {
          app_walkthrough_completed?: boolean
          coaching_level?: string
          created_at?: string
          first_project_created?: boolean
          id?: string
          preferred_mode?: string
          updated_at?: string
          user_id?: string
          writer_experience_level?: string | null
        }
        Relationships: []
      }
      writer_profiles: {
        Row: {
          ai_dependence_score: number
          character_voice_score: number
          coaching_level: string
          confidence_score: number
          created_at: string
          dialogue_score: number
          formatting_skill_score: number
          id: string
          last_aggregated_at: string | null
          scene_craft_score: number
          total_scenes_written: number
          total_sessions: number
          total_words_written: number
          updated_at: string
          user_id: string
          visual_writing_score: number
        }
        Insert: {
          ai_dependence_score?: number
          character_voice_score?: number
          coaching_level?: string
          confidence_score?: number
          created_at?: string
          dialogue_score?: number
          formatting_skill_score?: number
          id?: string
          last_aggregated_at?: string | null
          scene_craft_score?: number
          total_scenes_written?: number
          total_sessions?: number
          total_words_written?: number
          updated_at?: string
          user_id: string
          visual_writing_score?: number
        }
        Update: {
          ai_dependence_score?: number
          character_voice_score?: number
          coaching_level?: string
          confidence_score?: number
          created_at?: string
          dialogue_score?: number
          formatting_skill_score?: number
          id?: string
          last_aggregated_at?: string | null
          scene_craft_score?: number
          total_scenes_written?: number
          total_sessions?: number
          total_words_written?: number
          updated_at?: string
          user_id?: string
          visual_writing_score?: number
        }
        Relationships: []
      }
      writing_events: {
        Row: {
          character_id: string | null
          context: Json
          created_at: string
          event_type: string
          id: string
          project_id: string | null
          scene_id: string | null
          user_id: string
        }
        Insert: {
          character_id?: string | null
          context?: Json
          created_at?: string
          event_type: string
          id?: string
          project_id?: string | null
          scene_id?: string | null
          user_id: string
        }
        Update: {
          character_id?: string | null
          context?: Json
          created_at?: string
          event_type?: string
          id?: string
          project_id?: string | null
          scene_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      owns_project: { Args: { _project_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
