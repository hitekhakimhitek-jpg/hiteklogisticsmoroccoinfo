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
      alert_settings: {
        Row: {
          critical_webhook_url: string | null
          id: string
          recipients_commercial: string | null
          recipients_compliance: string | null
          recipients_finance: string | null
          recipients_it: string | null
          recipients_operations: string | null
          updated_at: string
          weekly_digest_enabled: boolean
        }
        Insert: {
          critical_webhook_url?: string | null
          id?: string
          recipients_commercial?: string | null
          recipients_compliance?: string | null
          recipients_finance?: string | null
          recipients_it?: string | null
          recipients_operations?: string | null
          updated_at?: string
          weekly_digest_enabled?: boolean
        }
        Update: {
          critical_webhook_url?: string | null
          id?: string
          recipients_commercial?: string | null
          recipients_compliance?: string | null
          recipients_finance?: string | null
          recipients_it?: string | null
          recipients_operations?: string | null
          updated_at?: string
          weekly_digest_enabled?: boolean
        }
        Relationships: []
      }
      compliance_register: {
        Row: {
          created_at: string
          deadline: string | null
          department: Database["public"]["Enums"]["intel_department"] | null
          effective_date: string | null
          evidence_url: string | null
          id: string
          jurisdiction: string | null
          linked_intel_id: string | null
          notes: string | null
          owner_label: string | null
          regulation_ref: string | null
          source_url: string | null
          status: Database["public"]["Enums"]["compliance_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deadline?: string | null
          department?: Database["public"]["Enums"]["intel_department"] | null
          effective_date?: string | null
          evidence_url?: string | null
          id?: string
          jurisdiction?: string | null
          linked_intel_id?: string | null
          notes?: string | null
          owner_label?: string | null
          regulation_ref?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["compliance_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deadline?: string | null
          department?: Database["public"]["Enums"]["intel_department"] | null
          effective_date?: string | null
          evidence_url?: string | null
          id?: string
          jurisdiction?: string | null
          linked_intel_id?: string | null
          notes?: string | null
          owner_label?: string | null
          regulation_ref?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["compliance_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_register_linked_intel_id_fkey"
            columns: ["linked_intel_id"]
            isOneToOne: false
            referencedRelation: "intelligence_items"
            referencedColumns: ["id"]
          },
        ]
      }
      disruption_events: {
        Row: {
          country_code: string | null
          created_at: string
          description: string | null
          disruption_type: Database["public"]["Enums"]["disruption_type"]
          ended_at: string | null
          id: string
          is_active: boolean
          latitude: number
          linked_intel_id: string | null
          location_name: string
          longitude: number
          severity: Database["public"]["Enums"]["intel_severity"]
          source_url: string | null
          started_at: string
          title: string
          updated_at: string
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          description?: string | null
          disruption_type?: Database["public"]["Enums"]["disruption_type"]
          ended_at?: string | null
          id?: string
          is_active?: boolean
          latitude: number
          linked_intel_id?: string | null
          location_name: string
          longitude: number
          severity?: Database["public"]["Enums"]["intel_severity"]
          source_url?: string | null
          started_at?: string
          title: string
          updated_at?: string
        }
        Update: {
          country_code?: string | null
          created_at?: string
          description?: string | null
          disruption_type?: Database["public"]["Enums"]["disruption_type"]
          ended_at?: string | null
          id?: string
          is_active?: boolean
          latitude?: number
          linked_intel_id?: string | null
          location_name?: string
          longitude?: number
          severity?: Database["public"]["Enums"]["intel_severity"]
          source_url?: string | null
          started_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disruption_events_linked_intel_id_fkey"
            columns: ["linked_intel_id"]
            isOneToOne: false
            referencedRelation: "intelligence_items"
            referencedColumns: ["id"]
          },
        ]
      }
      disruptions: {
        Row: {
          category: string
          created_at: string
          event_date: string
          id: string
          latitude: number
          location_name: string | null
          longitude: number
          origin: string
          severity: string
          source_entry_id: string | null
          sources: Json
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          event_date?: string
          id?: string
          latitude: number
          location_name?: string | null
          longitude: number
          origin?: string
          severity?: string
          source_entry_id?: string | null
          sources?: Json
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          event_date?: string
          id?: string
          latitude?: number
          location_name?: string | null
          longitude?: number
          origin?: string
          severity?: string
          source_entry_id?: string | null
          sources?: Json
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      intelligence_items: {
        Row: {
          action_required: string
          affected_tags: string[]
          alerted_at: string | null
          created_at: string
          department: Database["public"]["Enums"]["intel_department"]
          headline: string
          id: string
          impact: string
          is_ai_draft: boolean
          language: string
          last_reviewed_at: string | null
          owner: string | null
          severity: Database["public"]["Enums"]["intel_severity"]
          source_entry_id: string | null
          source_name: string
          source_url: string | null
          status: Database["public"]["Enums"]["intel_status"]
          summary: string
          time_to_impact: Database["public"]["Enums"]["intel_horizon"]
          time_to_impact_date: string | null
          updated_at: string
        }
        Insert: {
          action_required?: string
          affected_tags?: string[]
          alerted_at?: string | null
          created_at?: string
          department?: Database["public"]["Enums"]["intel_department"]
          headline: string
          id?: string
          impact?: string
          is_ai_draft?: boolean
          language?: string
          last_reviewed_at?: string | null
          owner?: string | null
          severity?: Database["public"]["Enums"]["intel_severity"]
          source_entry_id?: string | null
          source_name?: string
          source_url?: string | null
          status?: Database["public"]["Enums"]["intel_status"]
          summary: string
          time_to_impact?: Database["public"]["Enums"]["intel_horizon"]
          time_to_impact_date?: string | null
          updated_at?: string
        }
        Update: {
          action_required?: string
          affected_tags?: string[]
          alerted_at?: string | null
          created_at?: string
          department?: Database["public"]["Enums"]["intel_department"]
          headline?: string
          id?: string
          impact?: string
          is_ai_draft?: boolean
          language?: string
          last_reviewed_at?: string | null
          owner?: string | null
          severity?: Database["public"]["Enums"]["intel_severity"]
          source_entry_id?: string | null
          source_name?: string
          source_url?: string | null
          status?: Database["public"]["Enums"]["intel_status"]
          summary?: string
          time_to_impact?: Database["public"]["Enums"]["intel_horizon"]
          time_to_impact_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "intelligence_items_source_entry_id_fkey"
            columns: ["source_entry_id"]
            isOneToOne: false
            referencedRelation: "news_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_summaries: {
        Row: {
          compliance_tracker: Json
          executive_summary: string
          forward_outlook: string | null
          generated_at: string
          id: string
          month: number
          month_comparison: Json | null
          morocco_digest: string | null
          risk_score: number | null
          top_events: Json
          trend_analysis: Json | null
          year: number
        }
        Insert: {
          compliance_tracker?: Json
          executive_summary: string
          forward_outlook?: string | null
          generated_at?: string
          id?: string
          month: number
          month_comparison?: Json | null
          morocco_digest?: string | null
          risk_score?: number | null
          top_events?: Json
          trend_analysis?: Json | null
          year: number
        }
        Update: {
          compliance_tracker?: Json
          executive_summary?: string
          forward_outlook?: string | null
          generated_at?: string
          id?: string
          month?: number
          month_comparison?: Json | null
          morocco_digest?: string | null
          risk_score?: number | null
          top_events?: Json
          trend_analysis?: Json | null
          year?: number
        }
        Relationships: []
      }
      news_entries: {
        Row: {
          action_required: boolean
          affected_countries: string[]
          category: Database["public"]["Enums"]["news_category"]
          classification_metadata: Json | null
          classification_notes: string | null
          content_type: string | null
          display_regions: string[]
          fetched_date: string
          finance_score: number | null
          full_content: string | null
          headline: string
          id: string
          impact_assessment: string | null
          impact_score: number
          it_score: number | null
          month: number
          priority: Database["public"]["Enums"]["news_priority"]
          published_date: string
          region: Database["public"]["Enums"]["news_region"]
          region_confidence: number | null
          source_name: string
          source_url: string | null
          suggested_action: string | null
          summary: string
          week_number: number
          year: number
        }
        Insert: {
          action_required?: boolean
          affected_countries?: string[]
          category?: Database["public"]["Enums"]["news_category"]
          classification_metadata?: Json | null
          classification_notes?: string | null
          content_type?: string | null
          display_regions?: string[]
          fetched_date?: string
          finance_score?: number | null
          full_content?: string | null
          headline: string
          id?: string
          impact_assessment?: string | null
          impact_score?: number
          it_score?: number | null
          month?: number
          priority?: Database["public"]["Enums"]["news_priority"]
          published_date?: string
          region?: Database["public"]["Enums"]["news_region"]
          region_confidence?: number | null
          source_name?: string
          source_url?: string | null
          suggested_action?: string | null
          summary: string
          week_number?: number
          year?: number
        }
        Update: {
          action_required?: boolean
          affected_countries?: string[]
          category?: Database["public"]["Enums"]["news_category"]
          classification_metadata?: Json | null
          classification_notes?: string | null
          content_type?: string | null
          display_regions?: string[]
          fetched_date?: string
          finance_score?: number | null
          full_content?: string | null
          headline?: string
          id?: string
          impact_assessment?: string | null
          impact_score?: number
          it_score?: number | null
          month?: number
          priority?: Database["public"]["Enums"]["news_priority"]
          published_date?: string
          region?: Database["public"]["Enums"]["news_region"]
          region_confidence?: number | null
          source_name?: string
          source_url?: string | null
          suggested_action?: string | null
          summary?: string
          week_number?: number
          year?: number
        }
        Relationships: []
      }
      weekly_digests: {
        Row: {
          act_now_count: number
          department: Database["public"]["Enums"]["intel_department"] | null
          generated_at: string
          id: string
          item_count: number
          summary_md: string
          this_week_count: number
          week_number: number
          year: number
        }
        Insert: {
          act_now_count?: number
          department?: Database["public"]["Enums"]["intel_department"] | null
          generated_at?: string
          id?: string
          item_count?: number
          summary_md: string
          this_week_count?: number
          week_number: number
          year: number
        }
        Update: {
          act_now_count?: number
          department?: Database["public"]["Enums"]["intel_department"] | null
          generated_at?: string
          id?: string
          item_count?: number
          summary_md?: string
          this_week_count?: number
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
          key_takeaways: Json | null
          outlook: string | null
          recommendations: Json | null
          report_json: Json
          risk_score: number | null
          week_number: number
          year: number
        }
        Insert: {
          executive_summary: string
          generated_at?: string
          id?: string
          key_takeaways?: Json | null
          outlook?: string | null
          recommendations?: Json | null
          report_json?: Json
          risk_score?: number | null
          week_number: number
          year: number
        }
        Update: {
          executive_summary?: string
          generated_at?: string
          id?: string
          key_takeaways?: Json | null
          outlook?: string | null
          recommendations?: Json | null
          report_json?: Json
          risk_score?: number | null
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
      compliance_status:
        | "monitoring"
        | "in_progress"
        | "compliant"
        | "non_compliant"
        | "not_applicable"
      disruption_type:
        | "port"
        | "strike"
        | "weather"
        | "geopolitical"
        | "customs"
        | "infrastructure"
        | "cyber"
        | "other"
      intel_department:
        | "operations"
        | "compliance"
        | "finance"
        | "commercial"
        | "it"
      intel_horizon: "today" | "this_week" | "this_month" | "horizon"
      intel_severity: "act_now" | "this_week" | "awareness"
      intel_status: "new" | "acknowledged" | "actioned" | "archived"
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
        | "north_america"
        | "south_america"
        | "oceania"
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
      compliance_status: [
        "monitoring",
        "in_progress",
        "compliant",
        "non_compliant",
        "not_applicable",
      ],
      disruption_type: [
        "port",
        "strike",
        "weather",
        "geopolitical",
        "customs",
        "infrastructure",
        "cyber",
        "other",
      ],
      intel_department: [
        "operations",
        "compliance",
        "finance",
        "commercial",
        "it",
      ],
      intel_horizon: ["today", "this_week", "this_month", "horizon"],
      intel_severity: ["act_now", "this_week", "awareness"],
      intel_status: ["new", "acknowledged", "actioned", "archived"],
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
        "north_america",
        "south_america",
        "oceania",
      ],
    },
  },
} as const
