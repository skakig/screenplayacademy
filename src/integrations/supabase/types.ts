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
      arena_awards: {
        Row: {
          award_type: Database["public"]["Enums"]["arena_award_type"]
          awarded_to: string
          created_at: string
          entry_id: string
          id: string
          project_id: string
          session_id: string
          title: string | null
        }
        Insert: {
          award_type: Database["public"]["Enums"]["arena_award_type"]
          awarded_to: string
          created_at?: string
          entry_id: string
          id?: string
          project_id: string
          session_id: string
          title?: string | null
        }
        Update: {
          award_type?: Database["public"]["Enums"]["arena_award_type"]
          awarded_to?: string
          created_at?: string
          entry_id?: string
          id?: string
          project_id?: string
          session_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "arena_awards_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "arena_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_awards_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_awards_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "arena_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_entries: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          project_id: string
          session_id: string
          status: Database["public"]["Enums"]["arena_entry_status"]
          submitted_at: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          body?: string
          created_at?: string
          id?: string
          project_id: string
          session_id: string
          status?: Database["public"]["Enums"]["arena_entry_status"]
          submitted_at?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          project_id?: string
          session_id?: string
          status?: Database["public"]["Enums"]["arena_entry_status"]
          submitted_at?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_entries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "arena_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_participants: {
        Row: {
          id: string
          joined_at: string
          project_id: string
          role: Database["public"]["Enums"]["arena_participant_role"]
          session_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          project_id: string
          role?: Database["public"]["Enums"]["arena_participant_role"]
          session_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          project_id?: string
          role?: Database["public"]["Enums"]["arena_participant_role"]
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_participants_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "arena_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_sessions: {
        Row: {
          created_at: string
          created_by: string
          duration_seconds: number
          ends_at: string | null
          entry_reveal: Database["public"]["Enums"]["arena_entry_reveal"]
          id: string
          judging_mode: Database["public"]["Enums"]["arena_judging_mode"]
          mode: Database["public"]["Enums"]["arena_mode"]
          project_id: string
          prompt: string
          rules: Json
          stakes: Database["public"]["Enums"]["arena_stakes"]
          starts_at: string | null
          status: Database["public"]["Enums"]["arena_status"]
          submission_grace_seconds: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          duration_seconds: number
          ends_at?: string | null
          entry_reveal?: Database["public"]["Enums"]["arena_entry_reveal"]
          id?: string
          judging_mode?: Database["public"]["Enums"]["arena_judging_mode"]
          mode: Database["public"]["Enums"]["arena_mode"]
          project_id: string
          prompt: string
          rules?: Json
          stakes?: Database["public"]["Enums"]["arena_stakes"]
          starts_at?: string | null
          status?: Database["public"]["Enums"]["arena_status"]
          submission_grace_seconds?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          duration_seconds?: number
          ends_at?: string | null
          entry_reveal?: Database["public"]["Enums"]["arena_entry_reveal"]
          id?: string
          judging_mode?: Database["public"]["Enums"]["arena_judging_mode"]
          mode?: Database["public"]["Enums"]["arena_mode"]
          project_id?: string
          prompt?: string
          rules?: Json
          stakes?: Database["public"]["Enums"]["arena_stakes"]
          starts_at?: string | null
          status?: Database["public"]["Enums"]["arena_status"]
          submission_grace_seconds?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_votes: {
        Row: {
          comment: string | null
          created_at: string
          entry_id: string
          id: string
          score_character_truth: number
          score_cinematic_value: number
          score_craft: number
          score_emotional_impact: number
          score_originality: number
          session_id: string
          voter_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          entry_id: string
          id?: string
          score_character_truth: number
          score_cinematic_value: number
          score_craft: number
          score_emotional_impact: number
          score_originality: number
          session_id: string
          voter_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          entry_id?: string
          id?: string
          score_character_truth?: number
          score_cinematic_value?: number
          score_craft?: number
          score_emotional_impact?: number
          score_originality?: number
          session_id?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_votes_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "arena_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_votes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "arena_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_assets: {
        Row: {
          audio_url: string | null
          cache_key: string | null
          created_at: string
          current_line_label: string | null
          duration_seconds: number | null
          error_message: string | null
          id: string
          kind: string
          lines_done: number
          lines_total: number | null
          project_id: string
          scene_id: string | null
          status: string
          updated_at: string
          voice_map: Json
        }
        Insert: {
          audio_url?: string | null
          cache_key?: string | null
          created_at?: string
          current_line_label?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          kind?: string
          lines_done?: number
          lines_total?: number | null
          project_id: string
          scene_id?: string | null
          status?: string
          updated_at?: string
          voice_map?: Json
        }
        Update: {
          audio_url?: string | null
          cache_key?: string | null
          created_at?: string
          current_line_label?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          kind?: string
          lines_done?: number
          lines_total?: number | null
          project_id?: string
          scene_id?: string | null
          status?: string
          updated_at?: string
          voice_map?: Json
        }
        Relationships: []
      }
      character_aliases: {
        Row: {
          alias_kind: string
          alias_text: string
          character_id: string
          created_at: string
          id: string
          normalized: string
          project_id: string
          source: string
        }
        Insert: {
          alias_kind?: string
          alias_text: string
          character_id: string
          created_at?: string
          id?: string
          normalized: string
          project_id: string
          source?: string
        }
        Update: {
          alias_kind?: string
          alias_text?: string
          character_id?: string
          created_at?: string
          id?: string
          normalized?: string
          project_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_aliases_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_aliases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
      character_bible_entries: {
        Row: {
          alias_count: number
          bible_id: string
          character_id: string
          created_at: string
          evidence_count: number
          id: string
          project_id: string
          promoted_candidate_id: string | null
          scene_appearance_count: number
          snapshot: Json
          source: string
          universe_id: string
          updated_at: string
        }
        Insert: {
          alias_count?: number
          bible_id: string
          character_id: string
          created_at?: string
          evidence_count?: number
          id?: string
          project_id: string
          promoted_candidate_id?: string | null
          scene_appearance_count?: number
          snapshot?: Json
          source: string
          universe_id: string
          updated_at?: string
        }
        Update: {
          alias_count?: number
          bible_id?: string
          character_id?: string
          created_at?: string
          evidence_count?: number
          id?: string
          project_id?: string
          promoted_candidate_id?: string | null
          scene_appearance_count?: number
          snapshot?: Json
          source?: string
          universe_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_bible_entries_bible_id_fkey"
            columns: ["bible_id"]
            isOneToOne: false
            referencedRelation: "character_bibles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_bible_entries_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_bible_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_bible_entries_promoted_candidate_id_fkey"
            columns: ["promoted_candidate_id"]
            isOneToOne: false
            referencedRelation: "character_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_bible_entries_universe_id_fkey"
            columns: ["universe_id"]
            isOneToOne: false
            referencedRelation: "story_universes"
            referencedColumns: ["id"]
          },
        ]
      }
      character_bibles: {
        Row: {
          created_at: string
          entries: Json
          generated_by: string
          id: string
          project_id: string
          source_document_ids: string[]
          summary: string | null
          universe_id: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          entries?: Json
          generated_by: string
          id?: string
          project_id: string
          source_document_ids?: string[]
          summary?: string | null
          universe_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          entries?: Json
          generated_by?: string
          id?: string
          project_id?: string
          source_document_ids?: string[]
          summary?: string | null
          universe_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "character_bibles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_bibles_universe_id_fkey"
            columns: ["universe_id"]
            isOneToOne: false
            referencedRelation: "story_universes"
            referencedColumns: ["id"]
          },
        ]
      }
      character_candidates: {
        Row: {
          candidate_type: string
          confidence: number
          created_at: string
          detected_name: string
          dialogue_line_count: number
          first_seen_at: string
          id: string
          last_seen_at: string
          merged_into_character_id: string | null
          normalized_name: string
          project_id: string
          scene_count: number
          source_block_ids: string[]
          status: string
          updated_at: string
        }
        Insert: {
          candidate_type?: string
          confidence?: number
          created_at?: string
          detected_name: string
          dialogue_line_count?: number
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          merged_into_character_id?: string | null
          normalized_name: string
          project_id: string
          scene_count?: number
          source_block_ids?: string[]
          status?: string
          updated_at?: string
        }
        Update: {
          candidate_type?: string
          confidence?: number
          created_at?: string
          detected_name?: string
          dialogue_line_count?: number
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          merged_into_character_id?: string | null
          normalized_name?: string
          project_id?: string
          scene_count?: number
          source_block_ids?: string[]
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_candidates_merged_into_character_id_fkey"
            columns: ["merged_into_character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_candidates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
      character_merges: {
        Row: {
          chosen_values: Json
          created_at: string
          id: string
          kind: string
          merged_by: string | null
          merged_character_id: string
          primary_character_id: string
          project_id: string
          snapshot: Json
          undone_at: string | null
        }
        Insert: {
          chosen_values?: Json
          created_at?: string
          id?: string
          kind?: string
          merged_by?: string | null
          merged_character_id: string
          primary_character_id: string
          project_id: string
          snapshot?: Json
          undone_at?: string | null
        }
        Update: {
          chosen_values?: Json
          created_at?: string
          id?: string
          kind?: string
          merged_by?: string | null
          merged_character_id?: string
          primary_character_id?: string
          project_id?: string
          snapshot?: Json
          undone_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "character_merges_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
      character_repair_snapshots: {
        Row: {
          character_id: string | null
          created_at: string
          expires_at: string
          id: string
          project_id: string
          reason: string
          snapshot: Json
        }
        Insert: {
          character_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          project_id: string
          reason: string
          snapshot: Json
        }
        Update: {
          character_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          project_id?: string
          reason?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "character_repair_snapshots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
          archived_at: string | null
          betrayal_triggers: string | null
          biggest_loss: string | null
          biggest_shame: string | null
          canonical_name: string | null
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
          display_name: string | null
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
          importance: string | null
          internal_need: string | null
          lies_about: string | null
          life_before_story: string | null
          merged_into: string | null
          midpoint_shift: string | null
          might_do_under_pressure: string | null
          moral_blind_spot: string | null
          moral_test: string | null
          moral_wound: string | null
          movement_style: string | null
          name: string
          never_says_aloud: string | null
          occupation: string | null
          portrait_path: string | null
          portrait_seed: number | null
          portrait_url: string | null
          project_id: string
          quarantine_reason: string | null
          quarantined_at: string | null
          rank: string | null
          redemption_path: string | null
          relationships: string | null
          role: string | null
          secret: string | null
          sentence_rhythm: string | null
          signature_props: string | null
          silence_pattern: string | null
          speaker_labels: string[]
          speech_patterns: string | null
          starting_behavior: string | null
          starting_belief: string | null
          status: string | null
          story_function: string | null
          strengths: string | null
          subtext_pattern: string | null
          summary: string | null
          temperament: string | null
          title: string | null
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
          archived_at?: string | null
          betrayal_triggers?: string | null
          biggest_loss?: string | null
          biggest_shame?: string | null
          canonical_name?: string | null
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
          display_name?: string | null
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
          importance?: string | null
          internal_need?: string | null
          lies_about?: string | null
          life_before_story?: string | null
          merged_into?: string | null
          midpoint_shift?: string | null
          might_do_under_pressure?: string | null
          moral_blind_spot?: string | null
          moral_test?: string | null
          moral_wound?: string | null
          movement_style?: string | null
          name: string
          never_says_aloud?: string | null
          occupation?: string | null
          portrait_path?: string | null
          portrait_seed?: number | null
          portrait_url?: string | null
          project_id: string
          quarantine_reason?: string | null
          quarantined_at?: string | null
          rank?: string | null
          redemption_path?: string | null
          relationships?: string | null
          role?: string | null
          secret?: string | null
          sentence_rhythm?: string | null
          signature_props?: string | null
          silence_pattern?: string | null
          speaker_labels?: string[]
          speech_patterns?: string | null
          starting_behavior?: string | null
          starting_belief?: string | null
          status?: string | null
          story_function?: string | null
          strengths?: string | null
          subtext_pattern?: string | null
          summary?: string | null
          temperament?: string | null
          title?: string | null
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
          archived_at?: string | null
          betrayal_triggers?: string | null
          biggest_loss?: string | null
          biggest_shame?: string | null
          canonical_name?: string | null
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
          display_name?: string | null
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
          importance?: string | null
          internal_need?: string | null
          lies_about?: string | null
          life_before_story?: string | null
          merged_into?: string | null
          midpoint_shift?: string | null
          might_do_under_pressure?: string | null
          moral_blind_spot?: string | null
          moral_test?: string | null
          moral_wound?: string | null
          movement_style?: string | null
          name?: string
          never_says_aloud?: string | null
          occupation?: string | null
          portrait_path?: string | null
          portrait_seed?: number | null
          portrait_url?: string | null
          project_id?: string
          quarantine_reason?: string | null
          quarantined_at?: string | null
          rank?: string | null
          redemption_path?: string | null
          relationships?: string | null
          role?: string | null
          secret?: string | null
          sentence_rhythm?: string | null
          signature_props?: string | null
          silence_pattern?: string | null
          speaker_labels?: string[]
          speech_patterns?: string | null
          starting_behavior?: string | null
          starting_belief?: string | null
          status?: string | null
          story_function?: string | null
          strengths?: string | null
          subtext_pattern?: string | null
          summary?: string | null
          temperament?: string | null
          title?: string | null
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
            foreignKeyName: "characters_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
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
      comments: {
        Row: {
          anchor_offset_end: number | null
          anchor_offset_start: number | null
          anchor_text: string | null
          author_id: string
          body: string
          created_at: string
          id: string
          metadata: Json
          parent_comment_id: string | null
          project_id: string
          resolved_at: string | null
          resolved_by: string | null
          scene_id: string | null
          script_block_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          anchor_offset_end?: number | null
          anchor_offset_start?: number | null
          anchor_text?: string | null
          author_id: string
          body: string
          created_at?: string
          id?: string
          metadata?: Json
          parent_comment_id?: string | null
          project_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          scene_id?: string | null
          script_block_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          anchor_offset_end?: number | null
          anchor_offset_start?: number | null
          anchor_text?: string | null
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          metadata?: Json
          parent_comment_id?: string | null
          project_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          scene_id?: string | null
          script_block_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_script_block_id_fkey"
            columns: ["script_block_id"]
            isOneToOne: false
            referencedRelation: "script_blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_take_comparisons: {
        Row: {
          created_at: string
          id: string
          label: string
          left_take_id: string
          project_id: string
          right_take_id: string
          saved_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          left_take_id: string
          project_id: string
          right_take_id: string
          saved_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          left_take_id?: string
          project_id?: string
          right_take_id?: string
          saved_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "draft_take_comparisons_left_take_id_fkey"
            columns: ["left_take_id"]
            isOneToOne: false
            referencedRelation: "draft_takes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_take_comparisons_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_take_comparisons_right_take_id_fkey"
            columns: ["right_take_id"]
            isOneToOne: false
            referencedRelation: "draft_takes"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_takes: {
        Row: {
          block_count: number
          captured_at: string
          created_at: string
          id: string
          name: string
          payload: Json
          project_id: string
          updated_at: string
          user_id: string
          word_count: number
        }
        Insert: {
          block_count?: number
          captured_at?: string
          created_at?: string
          id?: string
          name: string
          payload: Json
          project_id: string
          updated_at?: string
          user_id: string
          word_count?: number
        }
        Update: {
          block_count?: number
          captured_at?: string
          created_at?: string
          id?: string
          name?: string
          payload?: Json
          project_id?: string
          updated_at?: string
          user_id?: string
          word_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "draft_takes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
      import_block_candidates: {
        Row: {
          approved: boolean
          confidence: string
          created_at: string
          id: string
          import_session_id: string
          needs_review: boolean
          order_index: number
          proposed_block_type: string
          proposed_character_name: string | null
          proposed_scene_index: number | null
          raw_text: string
          reason: string | null
          removed: boolean
          updated_at: string
          user_override_type: string | null
        }
        Insert: {
          approved?: boolean
          confidence?: string
          created_at?: string
          id?: string
          import_session_id: string
          needs_review?: boolean
          order_index: number
          proposed_block_type?: string
          proposed_character_name?: string | null
          proposed_scene_index?: number | null
          raw_text?: string
          reason?: string | null
          removed?: boolean
          updated_at?: string
          user_override_type?: string | null
        }
        Update: {
          approved?: boolean
          confidence?: string
          created_at?: string
          id?: string
          import_session_id?: string
          needs_review?: boolean
          order_index?: number
          proposed_block_type?: string
          proposed_character_name?: string | null
          proposed_scene_index?: number | null
          raw_text?: string
          reason?: string | null
          removed?: boolean
          updated_at?: string
          user_override_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_block_candidates_import_session_id_fkey"
            columns: ["import_session_id"]
            isOneToOne: false
            referencedRelation: "import_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      import_candidates: {
        Row: {
          candidate_type: string
          confidence: number
          created_at: string
          created_by: string
          document_id: string | null
          extractor_adapter: string
          extractor_version: string
          id: string
          normalized_key: string
          promoted_ref: Json | null
          proposed_payload: Json
          review_notes: string | null
          status: string
          universe_id: string
          updated_at: string
        }
        Insert: {
          candidate_type: string
          confidence?: number
          created_at?: string
          created_by: string
          document_id?: string | null
          extractor_adapter: string
          extractor_version: string
          id?: string
          normalized_key: string
          promoted_ref?: Json | null
          proposed_payload?: Json
          review_notes?: string | null
          status?: string
          universe_id: string
          updated_at?: string
        }
        Update: {
          candidate_type?: string
          confidence?: number
          created_at?: string
          created_by?: string
          document_id?: string | null
          extractor_adapter?: string
          extractor_version?: string
          id?: string
          normalized_key?: string
          promoted_ref?: Json | null
          proposed_payload?: Json
          review_notes?: string | null
          status?: string
          universe_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_candidates_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "source_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_candidates_universe_id_fkey"
            columns: ["universe_id"]
            isOneToOne: false
            referencedRelation: "story_universes"
            referencedColumns: ["id"]
          },
        ]
      }
      import_evidence: {
        Row: {
          candidate_id: string
          confidence: number
          created_at: string
          direct_or_inferred: string
          evidence_type: string
          excerpt: string
          id: string
          location_hint: string | null
          segment_id: string
          universe_id: string
        }
        Insert: {
          candidate_id: string
          confidence?: number
          created_at?: string
          direct_or_inferred?: string
          evidence_type?: string
          excerpt: string
          id?: string
          location_hint?: string | null
          segment_id: string
          universe_id: string
        }
        Update: {
          candidate_id?: string
          confidence?: number
          created_at?: string
          direct_or_inferred?: string
          evidence_type?: string
          excerpt?: string
          id?: string
          location_hint?: string | null
          segment_id?: string
          universe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_evidence_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "import_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_evidence_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "source_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_evidence_universe_id_fkey"
            columns: ["universe_id"]
            isOneToOne: false
            referencedRelation: "story_universes"
            referencedColumns: ["id"]
          },
        ]
      }
      import_extraction_runs: {
        Row: {
          adapter: string
          adapter_version: string
          created_at: string
          document_id: string
          error: string | null
          id: string
          input_checksum: string
          output_summary: Json
          stage: string
          status: string
          universe_id: string
        }
        Insert: {
          adapter: string
          adapter_version: string
          created_at?: string
          document_id: string
          error?: string | null
          id?: string
          input_checksum: string
          output_summary?: Json
          stage: string
          status?: string
          universe_id: string
        }
        Update: {
          adapter?: string
          adapter_version?: string
          created_at?: string
          document_id?: string
          error?: string | null
          id?: string
          input_checksum?: string
          output_summary?: Json
          stage?: string
          status?: string
          universe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_extraction_runs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "source_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_extraction_runs_universe_id_fkey"
            columns: ["universe_id"]
            isOneToOne: false
            referencedRelation: "story_universes"
            referencedColumns: ["id"]
          },
        ]
      }
      import_identity_decisions: {
        Row: {
          canonical_name: string | null
          created_at: string
          decided_by: string
          decision: string
          id: string
          kept_separate_candidate_ids: string[]
          merged_candidate_ids: string[]
          reason: string | null
          subject_key: string
          subject_type: string
          universe_id: string
          updated_at: string
        }
        Insert: {
          canonical_name?: string | null
          created_at?: string
          decided_by: string
          decision: string
          id?: string
          kept_separate_candidate_ids?: string[]
          merged_candidate_ids?: string[]
          reason?: string | null
          subject_key: string
          subject_type: string
          universe_id: string
          updated_at?: string
        }
        Update: {
          canonical_name?: string | null
          created_at?: string
          decided_by?: string
          decision?: string
          id?: string
          kept_separate_candidate_ids?: string[]
          merged_candidate_ids?: string[]
          reason?: string | null
          subject_key?: string
          subject_type?: string
          universe_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_identity_decisions_universe_id_fkey"
            columns: ["universe_id"]
            isOneToOne: false
            referencedRelation: "story_universes"
            referencedColumns: ["id"]
          },
        ]
      }
      import_recommendations: {
        Row: {
          accepted: boolean | null
          created_at: string
          id: string
          kind: string
          payload: Json
          report_id: string
          updated_at: string
        }
        Insert: {
          accepted?: boolean | null
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          report_id: string
          updated_at?: string
        }
        Update: {
          accepted?: boolean | null
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          report_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_recommendations_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "import_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      import_reports: {
        Row: {
          counts: Json
          created_at: string
          id: string
          import_session_id: string
          project_id: string | null
          summary: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          counts?: Json
          created_at?: string
          id?: string
          import_session_id: string
          project_id?: string | null
          summary?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          counts?: Json
          created_at?: string
          id?: string
          import_session_id?: string
          project_id?: string | null
          summary?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_reports_import_session_id_fkey"
            columns: ["import_session_id"]
            isOneToOne: false
            referencedRelation: "import_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      import_sessions: {
        Row: {
          created_at: string
          error: string | null
          file_name: string | null
          id: string
          project_id: string | null
          raw_text: string | null
          source_type: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          file_name?: string | null
          id?: string
          project_id?: string | null
          raw_text?: string | null
          source_type: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          file_name?: string | null
          id?: string
          project_id?: string | null
          raw_text?: string | null
          source_type?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      import_warnings: {
        Row: {
          created_at: string
          id: string
          message: string
          related_candidate_ids: string[]
          report_id: string
          severity: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string
          related_candidate_ids?: string[]
          report_id: string
          severity?: string
          type?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          related_candidate_ids?: string[]
          report_id?: string
          severity?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_warnings_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "import_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      live_scene_sessions: {
        Row: {
          ended_at: string | null
          id: string
          metadata: Json
          project_id: string
          scene_id: string
          started_at: string
          started_by: string
          status: string
        }
        Insert: {
          ended_at?: string | null
          id?: string
          metadata?: Json
          project_id: string
          scene_id: string
          started_at?: string
          started_by: string
          status?: string
        }
        Update: {
          ended_at?: string | null
          id?: string
          metadata?: Json
          project_id?: string
          scene_id?: string
          started_at?: string
          started_by?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_scene_sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_scene_sessions_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
        ]
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
      processed_webhook_events: {
        Row: {
          environment: string
          event_id: string
          event_type: string
          received_at: string
        }
        Insert: {
          environment: string
          event_id: string
          event_type: string
          received_at?: string
        }
        Update: {
          environment?: string
          event_id?: string
          event_type?: string
          received_at?: string
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
          preferred_languages: string[]
          stripe_customer_id: string | null
          subscription_tier: string
          ui_language: string
          ui_preferences: Json
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
          preferred_languages?: string[]
          stripe_customer_id?: string | null
          subscription_tier?: string
          ui_language?: string
          ui_preferences?: Json
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
          preferred_languages?: string[]
          stripe_customer_id?: string | null
          subscription_tier?: string
          ui_language?: string
          ui_preferences?: Json
          updated_at?: string
        }
        Relationships: []
      }
      project_alias_memory: {
        Row: {
          created_at: string
          created_by: string | null
          decision: string
          id: string
          normalized: string
          project_id: string
          resolves_to_character_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          decision: string
          id?: string
          normalized: string
          project_id: string
          resolves_to_character_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          decision?: string
          id?: string
          normalized?: string
          project_id?: string
          resolves_to_character_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_alias_memory_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_alias_memory_resolves_to_character_id_fkey"
            columns: ["resolves_to_character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      project_dictionary: {
        Row: {
          approved: boolean
          category: string
          cognate_of: Json | null
          created_at: string
          created_by: string | null
          created_from: string
          false_friend_risk: string[] | null
          id: string
          language: string | null
          normalized_term: string | null
          notes: string | null
          project_id: string
          term: string
          updated_at: string
        }
        Insert: {
          approved?: boolean
          category?: string
          cognate_of?: Json | null
          created_at?: string
          created_by?: string | null
          created_from?: string
          false_friend_risk?: string[] | null
          id?: string
          language?: string | null
          normalized_term?: string | null
          notes?: string | null
          project_id: string
          term: string
          updated_at?: string
        }
        Update: {
          approved?: boolean
          category?: string
          cognate_of?: Json | null
          created_at?: string
          created_by?: string | null
          created_from?: string
          false_friend_risk?: string[] | null
          id?: string
          language?: string | null
          normalized_term?: string | null
          notes?: string | null
          project_id?: string
          term?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_dictionary_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
      project_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          project_id: string
          role: string
          status: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by: string
          project_id: string
          role?: string
          status?: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          project_id?: string
          role?: string
          status?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_invites_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          joined_at: string | null
          last_seen_at: string | null
          project_id: string
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          last_seen_at?: string | null
          project_id: string
          role?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          last_seen_at?: string | null
          project_id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          ai_help_level: string | null
          created_at: string
          default_universe_id: string | null
          genre: string | null
          id: string
          logline: string | null
          metadata: Json
          project_language: string
          project_type: string
          screenplay_language: string
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
          default_universe_id?: string | null
          genre?: string | null
          id?: string
          logline?: string | null
          metadata?: Json
          project_language?: string
          project_type?: string
          screenplay_language?: string
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
          default_universe_id?: string | null
          genre?: string | null
          id?: string
          logline?: string | null
          metadata?: Json
          project_language?: string
          project_type?: string
          screenplay_language?: string
          status?: string
          target_length?: string | null
          title?: string
          tone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_default_universe_id_fkey"
            columns: ["default_universe_id"]
            isOneToOne: false
            referencedRelation: "story_universes"
            referencedColumns: ["id"]
          },
        ]
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
      scene_assignments: {
        Row: {
          assigned_by: string | null
          assignee_id: string
          created_at: string
          due_at: string | null
          id: string
          note: string | null
          project_id: string
          scene_id: string
          status: string
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          assignee_id: string
          created_at?: string
          due_at?: string | null
          id?: string
          note?: string | null
          project_id: string
          scene_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          assignee_id?: string
          created_at?: string
          due_at?: string | null
          id?: string
          note?: string | null
          project_id?: string
          scene_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scene_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scene_assignments_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      scene_locks: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          lock_type: string
          locked_by: string
          project_id: string
          reason: string | null
          released_at: string | null
          scene_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          lock_type?: string
          locked_by: string
          project_id: string
          reason?: string | null
          released_at?: string | null
          scene_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          lock_type?: string
          locked_by?: string
          project_id?: string
          reason?: string | null
          released_at?: string | null
          scene_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scene_locks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scene_locks_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
        ]
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
      scene_snapshots: {
        Row: {
          block_count: number
          created_at: string
          id: string
          label: string | null
          project_id: string
          scene_id: string
          snapshot: Json
          summary: string | null
          updated_at: string
          user_id: string
          word_count: number
        }
        Insert: {
          block_count?: number
          created_at?: string
          id?: string
          label?: string | null
          project_id: string
          scene_id: string
          snapshot: Json
          summary?: string | null
          updated_at?: string
          user_id: string
          word_count?: number
        }
        Update: {
          block_count?: number
          created_at?: string
          id?: string
          label?: string | null
          project_id?: string
          scene_id?: string
          snapshot?: Json
          summary?: string | null
          updated_at?: string
          user_id?: string
          word_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "scene_snapshots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scene_snapshots_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
        ]
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
          source_vault_scene_id: string | null
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
          source_vault_scene_id?: string | null
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
          source_vault_scene_id?: string | null
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
          {
            foreignKeyName: "scenes_source_vault_scene_id_fkey"
            columns: ["source_vault_scene_id"]
            isOneToOne: false
            referencedRelation: "vault_scenes"
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
          language: string | null
          metadata: Json
          order_index: number
          project_id: string
          revision: number
          scene_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          block_type?: string
          character_id?: string | null
          content?: string
          created_at?: string
          id?: string
          language?: string | null
          metadata?: Json
          order_index?: number
          project_id: string
          revision?: number
          scene_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          block_type?: string
          character_id?: string | null
          content?: string
          created_at?: string
          id?: string
          language?: string | null
          metadata?: Json
          order_index?: number
          project_id?: string
          revision?: number
          scene_id?: string | null
          updated_at?: string
          updated_by?: string | null
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
      series_knowledge_node_evidence: {
        Row: {
          confidence: number
          created_at: string
          evidence_id: string | null
          excerpt: string
          id: string
          node_id: string
          segment_id: string | null
        }
        Insert: {
          confidence?: number
          created_at?: string
          evidence_id?: string | null
          excerpt?: string
          id?: string
          node_id: string
          segment_id?: string | null
        }
        Update: {
          confidence?: number
          created_at?: string
          evidence_id?: string | null
          excerpt?: string
          id?: string
          node_id?: string
          segment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "series_knowledge_node_evidence_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "import_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "series_knowledge_node_evidence_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "series_knowledge_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "series_knowledge_node_evidence_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "source_segments"
            referencedColumns: ["id"]
          },
        ]
      }
      series_knowledge_nodes: {
        Row: {
          concept_type: string
          created_at: string
          current_status: string
          entity_ids: string[]
          entity_kind: string | null
          explanation: string
          extractor: string
          extractor_version: string
          id: string
          importance: string
          normalized_key: string
          role_relevance: string[]
          title: string
          universe_id: string
          updated_at: string
        }
        Insert: {
          concept_type: string
          created_at?: string
          current_status?: string
          entity_ids?: string[]
          entity_kind?: string | null
          explanation?: string
          extractor?: string
          extractor_version?: string
          id?: string
          importance?: string
          normalized_key: string
          role_relevance?: string[]
          title: string
          universe_id: string
          updated_at?: string
        }
        Update: {
          concept_type?: string
          created_at?: string
          current_status?: string
          entity_ids?: string[]
          entity_kind?: string | null
          explanation?: string
          extractor?: string
          extractor_version?: string
          id?: string
          importance?: string
          normalized_key?: string
          role_relevance?: string[]
          title?: string
          universe_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "series_knowledge_nodes_universe_id_fkey"
            columns: ["universe_id"]
            isOneToOne: false
            referencedRelation: "story_universes"
            referencedColumns: ["id"]
          },
        ]
      }
      series_knowledge_prerequisites: {
        Row: {
          created_at: string
          id: string
          node_id: string
          prerequisite_node_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          node_id: string
          prerequisite_node_id: string
        }
        Update: {
          created_at?: string
          id?: string
          node_id?: string
          prerequisite_node_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "series_knowledge_prerequisites_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "series_knowledge_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "series_knowledge_prerequisites_prerequisite_node_id_fkey"
            columns: ["prerequisite_node_id"]
            isOneToOne: false
            referencedRelation: "series_knowledge_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      source_documents: {
        Row: {
          authority: string
          byte_size: number
          checksum: string
          created_at: string
          diagnostics: Json
          filename: string | null
          id: string
          ingest_error: string | null
          language: string | null
          media_type: string
          normalized_text: string | null
          parser_adapter: string | null
          parser_version: string | null
          project_id: string | null
          rights_note: string | null
          source_type: string
          status: string
          storage_path: string | null
          structural_hints: Json
          title: string
          universe_id: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          authority?: string
          byte_size?: number
          checksum: string
          created_at?: string
          diagnostics?: Json
          filename?: string | null
          id?: string
          ingest_error?: string | null
          language?: string | null
          media_type?: string
          normalized_text?: string | null
          parser_adapter?: string | null
          parser_version?: string | null
          project_id?: string | null
          rights_note?: string | null
          source_type?: string
          status?: string
          storage_path?: string | null
          structural_hints?: Json
          title: string
          universe_id: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          authority?: string
          byte_size?: number
          checksum?: string
          created_at?: string
          diagnostics?: Json
          filename?: string | null
          id?: string
          ingest_error?: string | null
          language?: string | null
          media_type?: string
          normalized_text?: string | null
          parser_adapter?: string | null
          parser_version?: string | null
          project_id?: string | null
          rights_note?: string | null
          source_type?: string
          status?: string
          storage_path?: string | null
          structural_hints?: Json
          title?: string
          universe_id?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_documents_universe_id_fkey"
            columns: ["universe_id"]
            isOneToOne: false
            referencedRelation: "story_universes"
            referencedColumns: ["id"]
          },
        ]
      }
      source_segments: {
        Row: {
          checksum: string
          created_at: string
          document_id: string
          heading: string | null
          id: string
          language: string | null
          location: Json
          normalized_text: string
          raw_text: string
          segment_type: string
          segmenter_adapter: string
          segmenter_version: string
          sequence: number
          speakers: string[]
          stable_key: string
          universe_id: string
        }
        Insert: {
          checksum: string
          created_at?: string
          document_id: string
          heading?: string | null
          id?: string
          language?: string | null
          location?: Json
          normalized_text: string
          raw_text: string
          segment_type: string
          segmenter_adapter: string
          segmenter_version: string
          sequence: number
          speakers?: string[]
          stable_key: string
          universe_id: string
        }
        Update: {
          checksum?: string
          created_at?: string
          document_id?: string
          heading?: string | null
          id?: string
          language?: string | null
          location?: Json
          normalized_text?: string
          raw_text?: string
          segment_type?: string
          segmenter_adapter?: string
          segmenter_version?: string
          sequence?: number
          speakers?: string[]
          stable_key?: string
          universe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_segments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "source_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_segments_universe_id_fkey"
            columns: ["universe_id"]
            isOneToOne: false
            referencedRelation: "story_universes"
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
      story_universes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
          primary_language: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id: string
          primary_language?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          primary_language?: string | null
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
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          price_id: string
          product_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id: string
          product_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string
          product_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      suggestions: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          after: Json
          applied_to_canonical: boolean
          author_id: string | null
          before: Json | null
          created_at: string
          id: string
          metadata: Json | null
          project_id: string
          rationale: string | null
          rejected_at: string | null
          rejected_by: string | null
          scene_id: string | null
          script_block_id: string | null
          source: string
          status: string
          suggestion_type: string
          title: string | null
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          after: Json
          applied_to_canonical?: boolean
          author_id?: string | null
          before?: Json | null
          created_at?: string
          id?: string
          metadata?: Json | null
          project_id: string
          rationale?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          scene_id?: string | null
          script_block_id?: string | null
          source?: string
          status?: string
          suggestion_type: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          after?: Json
          applied_to_canonical?: boolean
          author_id?: string | null
          before?: Json | null
          created_at?: string
          id?: string
          metadata?: Json | null
          project_id?: string
          rationale?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          scene_id?: string | null
          script_block_id?: string | null
          source?: string
          status?: string
          suggestion_type?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestions_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestions_script_block_id_fkey"
            columns: ["script_block_id"]
            isOneToOne: false
            referencedRelation: "script_blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_counters: {
        Row: {
          count_used: number
          created_at: string
          environment: string
          feature: string
          id: string
          period_start: string
          updated_at: string
          user_id: string
        }
        Insert: {
          count_used?: number
          created_at?: string
          environment?: string
          feature: string
          id?: string
          period_start: string
          updated_at?: string
          user_id: string
        }
        Update: {
          count_used?: number
          created_at?: string
          environment?: string
          feature?: string
          id?: string
          period_start?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      usage_credit_grants: {
        Row: {
          amount_consumed: number
          amount_granted: number
          created_at: string
          environment: string
          expires_at: string | null
          feature: string
          id: string
          price_id: string | null
          stripe_session_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_consumed?: number
          amount_granted: number
          created_at?: string
          environment: string
          expires_at?: string | null
          feature: string
          id?: string
          price_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_consumed?: number
          amount_granted?: number
          created_at?: string
          environment?: string
          expires_at?: string | null
          feature?: string
          id?: string
          price_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string
          user_id?: string
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
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vault_scenes: {
        Row: {
          alternate_of: string | null
          archived_at: string | null
          content: string
          created_at: string
          created_by: string | null
          emotional_tone: string | null
          estimated_position: string
          id: string
          kind: string
          linked_character_ids: string[]
          linked_scene_id: string | null
          location: string | null
          notes: string
          project_id: string
          status: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          alternate_of?: string | null
          archived_at?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          emotional_tone?: string | null
          estimated_position?: string
          id?: string
          kind?: string
          linked_character_ids?: string[]
          linked_scene_id?: string | null
          location?: string | null
          notes?: string
          project_id: string
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Update: {
          alternate_of?: string | null
          archived_at?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          emotional_tone?: string | null
          estimated_position?: string
          id?: string
          kind?: string
          linked_character_ids?: string[]
          linked_scene_id?: string | null
          location?: string | null
          notes?: string
          project_id?: string
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vault_scenes_alternate_of_fkey"
            columns: ["alternate_of"]
            isOneToOne: false
            referencedRelation: "vault_scenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vault_scenes_linked_scene_id_fkey"
            columns: ["linked_scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vault_scenes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      world_artifacts: {
        Row: {
          candidate_id: string | null
          created_at: string
          description: string | null
          id: string
          metadata: Json
          name: string
          normalized_key: string
          universe_id: string
          updated_at: string
        }
        Insert: {
          candidate_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          name: string
          normalized_key: string
          universe_id: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          name?: string
          normalized_key?: string
          universe_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "world_artifacts_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "import_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "world_artifacts_universe_id_fkey"
            columns: ["universe_id"]
            isOneToOne: false
            referencedRelation: "story_universes"
            referencedColumns: ["id"]
          },
        ]
      }
      world_events: {
        Row: {
          candidate_id: string | null
          created_at: string
          id: string
          location_id: string | null
          metadata: Json
          name: string
          normalized_key: string
          sequence: number | null
          summary: string | null
          universe_id: string
          updated_at: string
        }
        Insert: {
          candidate_id?: string | null
          created_at?: string
          id?: string
          location_id?: string | null
          metadata?: Json
          name: string
          normalized_key: string
          sequence?: number | null
          summary?: string | null
          universe_id: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string | null
          created_at?: string
          id?: string
          location_id?: string | null
          metadata?: Json
          name?: string
          normalized_key?: string
          sequence?: number | null
          summary?: string | null
          universe_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "world_events_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "import_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "world_events_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "world_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "world_events_universe_id_fkey"
            columns: ["universe_id"]
            isOneToOne: false
            referencedRelation: "story_universes"
            referencedColumns: ["id"]
          },
        ]
      }
      world_factions: {
        Row: {
          candidate_id: string | null
          created_at: string
          description: string | null
          id: string
          kind: string | null
          metadata: Json
          name: string
          normalized_key: string
          universe_id: string
          updated_at: string
        }
        Insert: {
          candidate_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          kind?: string | null
          metadata?: Json
          name: string
          normalized_key: string
          universe_id: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          kind?: string | null
          metadata?: Json
          name?: string
          normalized_key?: string
          universe_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "world_factions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "import_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "world_factions_universe_id_fkey"
            columns: ["universe_id"]
            isOneToOne: false
            referencedRelation: "story_universes"
            referencedColumns: ["id"]
          },
        ]
      }
      world_locations: {
        Row: {
          candidate_id: string | null
          created_at: string
          description: string | null
          id: string
          int_ext: string | null
          metadata: Json
          name: string
          normalized_key: string
          universe_id: string
          updated_at: string
        }
        Insert: {
          candidate_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          int_ext?: string | null
          metadata?: Json
          name: string
          normalized_key: string
          universe_id: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          int_ext?: string | null
          metadata?: Json
          name?: string
          normalized_key?: string
          universe_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "world_locations_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "import_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "world_locations_universe_id_fkey"
            columns: ["universe_id"]
            isOneToOne: false
            referencedRelation: "story_universes"
            referencedColumns: ["id"]
          },
        ]
      }
      world_rules: {
        Row: {
          candidate_id: string | null
          created_at: string
          id: string
          metadata: Json
          name: string
          normalized_key: string
          scope: string | null
          statement: string
          universe_id: string
          updated_at: string
        }
        Insert: {
          candidate_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          normalized_key: string
          scope?: string | null
          statement: string
          universe_id: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          normalized_key?: string
          scope?: string | null
          statement?: string
          universe_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "world_rules_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "import_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "world_rules_universe_id_fkey"
            columns: ["universe_id"]
            isOneToOne: false
            referencedRelation: "story_universes"
            referencedColumns: ["id"]
          },
        ]
      }
      world_threads: {
        Row: {
          candidate_id: string | null
          created_at: string
          id: string
          metadata: Json
          name: string
          normalized_key: string
          question: string | null
          status: string
          universe_id: string
          updated_at: string
        }
        Insert: {
          candidate_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          normalized_key: string
          question?: string | null
          status?: string
          universe_id: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          normalized_key?: string
          question?: string | null
          status?: string
          universe_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "world_threads_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "import_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "world_threads_universe_id_fkey"
            columns: ["universe_id"]
            isOneToOne: false
            referencedRelation: "story_universes"
            referencedColumns: ["id"]
          },
        ]
      }
      world_timeline_entries: {
        Row: {
          candidate_id: string | null
          created_at: string
          event_id: string | null
          id: string
          label: string
          metadata: Json
          sequence: number
          universe_id: string
          updated_at: string
          when_hint: string | null
        }
        Insert: {
          candidate_id?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          label: string
          metadata?: Json
          sequence: number
          universe_id: string
          updated_at?: string
          when_hint?: string | null
        }
        Update: {
          candidate_id?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          label?: string
          metadata?: Json
          sequence?: number
          universe_id?: string
          updated_at?: string
          when_hint?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "world_timeline_entries_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "import_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "world_timeline_entries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "world_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "world_timeline_entries_universe_id_fkey"
            columns: ["universe_id"]
            isOneToOne: false
            referencedRelation: "story_universes"
            referencedColumns: ["id"]
          },
        ]
      }
      writer_knowledge_state: {
        Row: {
          confidence: number
          created_at: string
          evidence_of_understanding: Json
          id: string
          knowledge_node_id: string
          last_checked_at: string | null
          preferred_presentation: string
          status: string
          universe_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          evidence_of_understanding?: Json
          id?: string
          knowledge_node_id: string
          last_checked_at?: string | null
          preferred_presentation?: string
          status?: string
          universe_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          evidence_of_understanding?: Json
          id?: string
          knowledge_node_id?: string
          last_checked_at?: string | null
          preferred_presentation?: string
          status?: string
          universe_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "writer_knowledge_state_knowledge_node_id_fkey"
            columns: ["knowledge_node_id"]
            isOneToOne: false
            referencedRelation: "series_knowledge_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "writer_knowledge_state_universe_id_fkey"
            columns: ["universe_id"]
            isOneToOne: false
            referencedRelation: "story_universes"
            referencedColumns: ["id"]
          },
        ]
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
      accept_character_candidate: {
        Args: { _candidate_id: string; _overrides?: Json }
        Returns: string
      }
      accept_project_invite: {
        Args: { _token: string }
        Returns: {
          project_id: string
          status: string
        }[]
      }
      advance_arena_round_if_due: {
        Args: { _session_id: string }
        Returns: {
          created_at: string
          created_by: string
          duration_seconds: number
          ends_at: string | null
          entry_reveal: Database["public"]["Enums"]["arena_entry_reveal"]
          id: string
          judging_mode: Database["public"]["Enums"]["arena_judging_mode"]
          mode: Database["public"]["Enums"]["arena_mode"]
          project_id: string
          prompt: string
          rules: Json
          stakes: Database["public"]["Enums"]["arena_stakes"]
          starts_at: string | null
          status: Database["public"]["Enums"]["arena_status"]
          submission_grace_seconds: number
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "arena_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      archive_arena_session: {
        Args: { _session_id: string }
        Returns: {
          created_at: string
          created_by: string
          duration_seconds: number
          ends_at: string | null
          entry_reveal: Database["public"]["Enums"]["arena_entry_reveal"]
          id: string
          judging_mode: Database["public"]["Enums"]["arena_judging_mode"]
          mode: Database["public"]["Enums"]["arena_mode"]
          project_id: string
          prompt: string
          rules: Json
          stakes: Database["public"]["Enums"]["arena_stakes"]
          starts_at: string | null
          status: Database["public"]["Enums"]["arena_status"]
          submission_grace_seconds: number
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "arena_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      award_arena_entry: {
        Args: {
          _award_type: Database["public"]["Enums"]["arena_award_type"]
          _entry_id: string
          _session_id: string
          _title?: string
        }
        Returns: {
          award_type: Database["public"]["Enums"]["arena_award_type"]
          awarded_to: string
          created_at: string
          entry_id: string
          id: string
          project_id: string
          session_id: string
          title: string | null
        }
        SetofOptions: {
          from: "*"
          to: "arena_awards"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      can_accept_suggestion: { Args: { _project_id: string }; Returns: boolean }
      can_archive_suggestion: {
        Args: { _project_id: string }
        Returns: boolean
      }
      can_claim_scene: { Args: { _project_id: string }; Returns: boolean }
      can_comment_on_project: {
        Args: { _project_id: string }
        Returns: boolean
      }
      can_create_suggestion: { Args: { _project_id: string }; Returns: boolean }
      can_edit_project: { Args: { _project_id: string }; Returns: boolean }
      can_manage_scene_assignments: {
        Args: { _project_id: string }
        Returns: boolean
      }
      can_override_scene_lock: {
        Args: { _project_id: string }
        Returns: boolean
      }
      can_reject_suggestion: { Args: { _project_id: string }; Returns: boolean }
      can_resolve_project_comments: {
        Args: { _project_id: string }
        Returns: boolean
      }
      can_view_suggestions: { Args: { _project_id: string }; Returns: boolean }
      consume_usage: {
        Args: { _amount: number; _environment?: string; _feature: string }
        Returns: number
      }
      create_arena_session: {
        Args: {
          _duration_seconds: number
          _entry_reveal?: Database["public"]["Enums"]["arena_entry_reveal"]
          _judging_mode?: Database["public"]["Enums"]["arena_judging_mode"]
          _mode: Database["public"]["Enums"]["arena_mode"]
          _project_id: string
          _prompt: string
          _rules?: Json
          _stakes?: Database["public"]["Enums"]["arena_stakes"]
          _submission_grace_seconds?: number
          _title: string
        }
        Returns: {
          created_at: string
          created_by: string
          duration_seconds: number
          ends_at: string | null
          entry_reveal: Database["public"]["Enums"]["arena_entry_reveal"]
          id: string
          judging_mode: Database["public"]["Enums"]["arena_judging_mode"]
          mode: Database["public"]["Enums"]["arena_mode"]
          project_id: string
          prompt: string
          rules: Json
          stakes: Database["public"]["Enums"]["arena_stakes"]
          starts_at: string | null
          status: Database["public"]["Enums"]["arena_status"]
          submission_grace_seconds: number
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "arena_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_subscription_tier: {
        Args: { check_env?: string; user_uuid: string }
        Returns: string
      }
      end_arena_round: {
        Args: { _session_id: string }
        Returns: {
          created_at: string
          created_by: string
          duration_seconds: number
          ends_at: string | null
          entry_reveal: Database["public"]["Enums"]["arena_entry_reveal"]
          id: string
          judging_mode: Database["public"]["Enums"]["arena_judging_mode"]
          mode: Database["public"]["Enums"]["arena_mode"]
          project_id: string
          prompt: string
          rules: Json
          stakes: Database["public"]["Enums"]["arena_stakes"]
          starts_at: string | null
          status: Database["public"]["Enums"]["arena_status"]
          submission_grace_seconds: number
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "arena_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      finalize_arena_round: {
        Args: { _session_id: string }
        Returns: {
          created_at: string
          created_by: string
          duration_seconds: number
          ends_at: string | null
          entry_reveal: Database["public"]["Enums"]["arena_entry_reveal"]
          id: string
          judging_mode: Database["public"]["Enums"]["arena_judging_mode"]
          mode: Database["public"]["Enums"]["arena_mode"]
          project_id: string
          prompt: string
          rules: Json
          stakes: Database["public"]["Enums"]["arena_stakes"]
          starts_at: string | null
          status: Database["public"]["Enums"]["arena_status"]
          submission_grace_seconds: number
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "arena_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_arena_voting_entries: {
        Args: { _session_id: string }
        Returns: {
          anonymous_label: string
          author_id: string
          body: string
          entry_id: string
          session_id: string
          status: Database["public"]["Enums"]["arena_entry_status"]
          submitted_at: string
          title: string
        }[]
      }
      get_arena_voting_progress: {
        Args: { _session_id: string }
        Returns: {
          completed_voters: number
          current_user_has_voted: boolean
          eligible_voters: number
          entries_with_votes: number
        }[]
      }
      get_project_member_identities: {
        Args: { _project_id: string; _user_ids: string[] }
        Returns: {
          avatar_url: string
          display_name: string
          user_id: string
        }[]
      }
      get_usage_snapshot: {
        Args: { _environment?: string }
        Returns: {
          credits_remaining: number
          feature: string
          monthly_limit: number
          tier: string
          used: number
        }[]
      }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      has_arena_entry_read_access: {
        Args: {
          _author_id: string
          _project_id: string
          _session_id: string
          _status: Database["public"]["Enums"]["arena_entry_status"]
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_project_member: { Args: { _project_id: string }; Returns: boolean }
      join_arena_session: {
        Args: {
          _role?: Database["public"]["Enums"]["arena_participant_role"]
          _session_id: string
        }
        Returns: {
          id: string
          joined_at: string
          project_id: string
          role: Database["public"]["Enums"]["arena_participant_role"]
          session_id: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "arena_participants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      owns_project: { Args: { _project_id: string }; Returns: boolean }
      project_role: { Args: { _project_id: string }; Returns: string }
      promote_arena_entry: {
        Args: {
          _entry_id: string
          _session_id: string
          _suggestion_type?: string
        }
        Returns: {
          already_existed: boolean
          id: string
        }[]
      }
      restore_quarantined_character: {
        Args: { _character_id: string }
        Returns: {
          act1_state: string | null
          act2_pressure: string | null
          age: string | null
          alias: string | null
          archetype: string | null
          archived_at: string | null
          betrayal_triggers: string | null
          biggest_loss: string | null
          biggest_shame: string | null
          canonical_name: string | null
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
          display_name: string | null
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
          importance: string | null
          internal_need: string | null
          lies_about: string | null
          life_before_story: string | null
          merged_into: string | null
          midpoint_shift: string | null
          might_do_under_pressure: string | null
          moral_blind_spot: string | null
          moral_test: string | null
          moral_wound: string | null
          movement_style: string | null
          name: string
          never_says_aloud: string | null
          occupation: string | null
          portrait_path: string | null
          portrait_seed: number | null
          portrait_url: string | null
          project_id: string
          quarantine_reason: string | null
          quarantined_at: string | null
          rank: string | null
          redemption_path: string | null
          relationships: string | null
          role: string | null
          secret: string | null
          sentence_rhythm: string | null
          signature_props: string | null
          silence_pattern: string | null
          speaker_labels: string[]
          speech_patterns: string | null
          starting_behavior: string | null
          starting_belief: string | null
          status: string | null
          story_function: string | null
          strengths: string | null
          subtext_pattern: string | null
          summary: string | null
          temperament: string | null
          title: string | null
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
        SetofOptions: {
          from: "*"
          to: "characters"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      start_arena_round: {
        Args: { _session_id: string }
        Returns: {
          created_at: string
          created_by: string
          duration_seconds: number
          ends_at: string | null
          entry_reveal: Database["public"]["Enums"]["arena_entry_reveal"]
          id: string
          judging_mode: Database["public"]["Enums"]["arena_judging_mode"]
          mode: Database["public"]["Enums"]["arena_mode"]
          project_id: string
          prompt: string
          rules: Json
          stakes: Database["public"]["Enums"]["arena_stakes"]
          starts_at: string | null
          status: Database["public"]["Enums"]["arena_status"]
          submission_grace_seconds: number
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "arena_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_arena_entry: {
        Args: { _entry_id: string }
        Returns: {
          author_id: string
          body: string
          created_at: string
          id: string
          project_id: string
          session_id: string
          status: Database["public"]["Enums"]["arena_entry_status"]
          submitted_at: string | null
          title: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "arena_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_my_project_last_seen: {
        Args: { _project_id: string }
        Returns: undefined
      }
      usage_limit_for: {
        Args: { _feature: string; _tier: string }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      arena_award_type:
        | "best_line"
        | "best_dialogue"
        | "best_twist"
        | "best_character_truth"
        | "funniest"
        | "most_cinematic"
        | "audience_choice"
        | "studio_winner"
      arena_entry_reveal: "named" | "blind_until_results"
      arena_entry_status: "draft" | "submitted" | "withdrawn"
      arena_judging_mode: "peer" | "host" | "panel" | "hybrid"
      arena_mode:
        | "dialogue_duel"
        | "rewrite_relay"
        | "scene_rescue"
        | "adlib_character"
        | "comedy_punchup"
        | "villain_monologue"
        | "pitch_blitz"
        | "freewrite"
      arena_participant_role: "writer" | "judge" | "viewer"
      arena_stakes: "practice" | "ranked" | "showcase"
      arena_status:
        | "draft"
        | "open"
        | "running"
        | "voting"
        | "complete"
        | "archived"
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
    Enums: {
      app_role: ["admin", "moderator", "user"],
      arena_award_type: [
        "best_line",
        "best_dialogue",
        "best_twist",
        "best_character_truth",
        "funniest",
        "most_cinematic",
        "audience_choice",
        "studio_winner",
      ],
      arena_entry_reveal: ["named", "blind_until_results"],
      arena_entry_status: ["draft", "submitted", "withdrawn"],
      arena_judging_mode: ["peer", "host", "panel", "hybrid"],
      arena_mode: [
        "dialogue_duel",
        "rewrite_relay",
        "scene_rescue",
        "adlib_character",
        "comedy_punchup",
        "villain_monologue",
        "pitch_blitz",
        "freewrite",
      ],
      arena_participant_role: ["writer", "judge", "viewer"],
      arena_stakes: ["practice", "ranked", "showcase"],
      arena_status: [
        "draft",
        "open",
        "running",
        "voting",
        "complete",
        "archived",
      ],
    },
  },
} as const
