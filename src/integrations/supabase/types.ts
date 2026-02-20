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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      monthly_summaries: {
        Row: {
          compliance_tracker: Json
          executive_summary: string
          generated_at: string
          id: string
          month: number
          month_comparison: Json | null
          morocco_digest: string | null
          top_events: Json
          year: number
        }
        Insert: {
          compliance_tracker?: Json
          executive_summary: string
          generated_at?: string
          id?: string
          month: number
          month_comparison?: Json | null
          morocco_digest?: string | null
          top_events?: Json
          year: number
        }
        Update: {
          compliance_tracker?: Json
          executive_summary?: string
          generated_at?: string
          id?: string
          month?: number
          month_comparison?: Json | null
          morocco_digest?: string | null
          top_events?: Json
          year?: number
        }
        Relationships: []
      }
      news_entries: {
        Row: {
          action_required: boolean
          category: Database["public"]["Enums"]["news_category"]
          fetched_date: string
          full_content: string | null
          headline: string
          id: string
          impact_assessment: string | null
          month: number
          priority: Database["public"]["Enums"]["news_priority"]
          published_date: string
          region: Database["public"]["Enums"]["news_region"]
          source_name: string
          source_url: string | null
          suggested_action: string | null
          summary: string
          week_number: number
          year: number
        }
        Insert: {
          action_required?: boolean
          category?: Database["public"]["Enums"]["news_category"]
          fetched_date?: string
          full_content?: string | null
          headline: string
          id?: string
          impact_assessment?: string | null
          month?: number
          priority?: Database["public"]["Enums"]["news_priority"]
          published_date?: string
          region?: Database["public"]["Enums"]["news_region"]
          source_name?: string
          source_url?: string | null
          suggested_action?: string | null
          summary: string
          week_number?: number
          year?: number
        }
        Update: {
          action_required?: boolean
          category?: Database["public"]["Enums"]["news_category"]
          fetched_date?: string
          full_content?: string | null
          headline?: string
          id?: string
          impact_assessment?: string | null
          month?: number
          priority?: Database["public"]["Enums"]["news_priority"]
          published_date?: string
          region?: Database["public"]["Enums"]["news_region"]
          source_name?: string
          source_url?: string | null
          suggested_action?: string | null
          summary?: string
          week_number?: number
          year?: number
        }
        Relationships: []
      }
      weekly_reports: {
        Row: {
          executive_summary: string
          generated_at: string
          id: string
          report_json: Json
          week_number: number
          year: number
        }
        Insert: {
          executive_summary: string
          generated_at?: string
          id?: string
          report_json?: Json
          week_number: number
          year: number
        }
        Update: {
          executive_summary?: string
          generated_at?: string
          id?: string
          report_json?: Json
          week_number?: number
          year?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_old_entries: { Args: never; Returns: undefined }
    }
    Enums: {
      news_category:
        | "regulation"
        | "weather"
        | "port"
        | "trade"
        | "compliance"
        | "market"
        | "general"
      news_priority: "critical" | "important" | "informational"
      news_region:
        | "morocco"
        | "europe"
        | "asia"
        | "americas"
        | "africa"
        | "middle_east"
        | "global"
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
      news_category: [
        "regulation",
        "weather",
        "port",
        "trade",
        "compliance",
        "market",
        "general",
      ],
      news_priority: ["critical", "important", "informational"],
      news_region: [
        "morocco",
        "europe",
        "asia",
        "americas",
        "africa",
        "middle_east",
        "global",
      ],
    },
  },
} as const
