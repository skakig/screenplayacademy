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
      characters: {
        Row: {
          age: string | null
          archetype: string | null
          character_arc: string | null
          contradiction: string | null
          costume_notes: string | null
          created_at: string
          elevenlabs_voice_id: string | null
          external_goal: string | null
          fear: string | null
          id: string
          image_prompt: string | null
          internal_need: string | null
          name: string
          project_id: string
          relationships: string | null
          role: string | null
          secret: string | null
          speech_patterns: string | null
          updated_at: string
          visual_description: string | null
          voice_style: string | null
          wound: string | null
        }
        Insert: {
          age?: string | null
          archetype?: string | null
          character_arc?: string | null
          contradiction?: string | null
          costume_notes?: string | null
          created_at?: string
          elevenlabs_voice_id?: string | null
          external_goal?: string | null
          fear?: string | null
          id?: string
          image_prompt?: string | null
          internal_need?: string | null
          name: string
          project_id: string
          relationships?: string | null
          role?: string | null
          secret?: string | null
          speech_patterns?: string | null
          updated_at?: string
          visual_description?: string | null
          voice_style?: string | null
          wound?: string | null
        }
        Update: {
          age?: string | null
          archetype?: string | null
          character_arc?: string | null
          contradiction?: string | null
          costume_notes?: string | null
          created_at?: string
          elevenlabs_voice_id?: string | null
          external_goal?: string | null
          fear?: string | null
          id?: string
          image_prompt?: string | null
          internal_need?: string | null
          name?: string
          project_id?: string
          relationships?: string | null
          role?: string | null
          secret?: string | null
          speech_patterns?: string | null
          updated_at?: string
          visual_description?: string | null
          voice_style?: string | null
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
