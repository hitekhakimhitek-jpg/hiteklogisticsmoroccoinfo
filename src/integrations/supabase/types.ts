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
      country_holidays: {
        Row: {
          affects_operations: boolean
          country_code: string
          country_name: string | null
          created_at: string
          global: boolean
          holiday_date: string
          id: string
          local_name: string
          name_en: string
          updated_at: string
        }
        Insert: {
          affects_operations?: boolean
          country_code: string
          country_name?: string | null
          created_at?: string
          global?: boolean
          holiday_date: string
          id?: string
          local_name: string
          name_en: string
          updated_at?: string
        }
        Update: {
          affects_operations?: boolean
          country_code?: string
          country_name?: string | null
          created_at?: string
          global?: boolean
          holiday_date?: string
          id?: string
          local_name?: string
          name_en?: string
          updated_at?: string
        }
        Relationships: []
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
      event_updates: {
        Row: {
          change_summary: string
          created_at: string
          event_id: string
          event_status: string | null
          global_logistics_impact_score: number | null
          id: string
          severity: string | null
          snapshot: Json
          source_name: string | null
        }
        Insert: {
          change_summary: string
          created_at?: string
          event_id: string
          event_status?: string | null
          global_logistics_impact_score?: number | null
          id?: string
          severity?: string | null
          snapshot?: Json
          source_name?: string | null
        }
        Update: {
          change_summary?: string
          created_at?: string
          event_id?: string
          event_status?: string | null
          global_logistics_impact_score?: number | null
          id?: string
          severity?: string | null
          snapshot?: Json
          source_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_updates_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "supply_chain_events"
            referencedColumns: ["id"]
          },
        ]
      }
      ingestion_runs: {
        Row: {
          archived_count: number
          candidates_accepted: number
          candidates_found: number
          created_at: string
          enriched_count: number
          error_message: string | null
          finished_at: string | null
          id: string
          inserted_count: number
          pipeline: string
          queries_failed: number
          queries_total: number
          rejection_counts: Json
          source_report: Json
          started_at: string
          status: string
        }
        Insert: {
          archived_count?: number
          candidates_accepted?: number
          candidates_found?: number
          created_at?: string
          enriched_count?: number
          error_message?: string | null
          finished_at?: string | null
          id?: string
          inserted_count?: number
          pipeline: string
          queries_failed?: number
          queries_total?: number
          rejection_counts?: Json
          source_report?: Json
          started_at?: string
          status: string
        }
        Update: {
          archived_count?: number
          candidates_accepted?: number
          candidates_found?: number
          created_at?: string
          enriched_count?: number
          error_message?: string | null
          finished_at?: string | null
          id?: string
          inserted_count?: number
          pipeline?: string
          queries_failed?: number
          queries_total?: number
          rejection_counts?: Json
          source_report?: Json
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      intel_feedback: {
        Row: {
          created_at: string
          id: string
          item_id: string
          updated_at: string
          vote: string
          voter: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          updated_at?: string
          vote: string
          voter: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          updated_at?: string
          vote?: string
          voter?: string
        }
        Relationships: [
          {
            foreignKeyName: "intel_feedback_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "intelligence_items"
            referencedColumns: ["id"]
          },
        ]
      }
      intelligence_items: {
        Row: {
          action_required: string
          action_required_bool: boolean | null
          affected_lanes_or_customers: string | null
          affected_tags: string[]
          airport_affected: string | null
          alerted_at: string | null
          canonical_url: string | null
          carrier_affected: string | null
          category: string | null
          classification_reason: string | null
          country: string | null
          created_at: string
          department: Database["public"]["Enums"]["intel_department"]
          department_confidence: number
          effective_date: string | null
          event_date: string | null
          headline: string
          id: string
          impact: string
          ingested_at: string
          is_ai_draft: boolean
          lane_affected: string | null
          language: string
          last_reviewed_at: string | null
          last_verification_attempt_at: string | null
          latitude: number | null
          longitude: number | null
          month: number | null
          og_image_url: string | null
          owner: string | null
          port_affected: string | null
          predicted_relevance: number
          processing_error: string | null
          processing_status: Database["public"]["Enums"]["intel_processing_status"]
          publication_date: string | null
          relevance_score: number
          severity: Database["public"]["Enums"]["intel_severity"]
          severity_score: number
          source_entry_id: string | null
          source_name: string
          source_tier: number
          source_url: string | null
          status: Database["public"]["Enums"]["intel_status"]
          suggested_action: string | null
          summary: string
          time_to_impact: Database["public"]["Enums"]["intel_horizon"]
          time_to_impact_date: string | null
          transport_modes: string[] | null
          updated_at: string
          updated_date: string | null
          verification_attempts: number
          verification_status: string
          week_number: number | null
          why_it_matters_to_hitek: string | null
        }
        Insert: {
          action_required?: string
          action_required_bool?: boolean | null
          affected_lanes_or_customers?: string | null
          affected_tags?: string[]
          airport_affected?: string | null
          alerted_at?: string | null
          canonical_url?: string | null
          carrier_affected?: string | null
          category?: string | null
          classification_reason?: string | null
          country?: string | null
          created_at?: string
          department?: Database["public"]["Enums"]["intel_department"]
          department_confidence?: number
          effective_date?: string | null
          event_date?: string | null
          headline: string
          id?: string
          impact?: string
          ingested_at?: string
          is_ai_draft?: boolean
          lane_affected?: string | null
          language?: string
          last_reviewed_at?: string | null
          last_verification_attempt_at?: string | null
          latitude?: number | null
          longitude?: number | null
          month?: number | null
          og_image_url?: string | null
          owner?: string | null
          port_affected?: string | null
          predicted_relevance?: number
          processing_error?: string | null
          processing_status?: Database["public"]["Enums"]["intel_processing_status"]
          publication_date?: string | null
          relevance_score?: number
          severity?: Database["public"]["Enums"]["intel_severity"]
          severity_score?: number
          source_entry_id?: string | null
          source_name?: string
          source_tier?: number
          source_url?: string | null
          status?: Database["public"]["Enums"]["intel_status"]
          suggested_action?: string | null
          summary: string
          time_to_impact?: Database["public"]["Enums"]["intel_horizon"]
          time_to_impact_date?: string | null
          transport_modes?: string[] | null
          updated_at?: string
          updated_date?: string | null
          verification_attempts?: number
          verification_status?: string
          week_number?: number | null
          why_it_matters_to_hitek?: string | null
        }
        Update: {
          action_required?: string
          action_required_bool?: boolean | null
          affected_lanes_or_customers?: string | null
          affected_tags?: string[]
          airport_affected?: string | null
          alerted_at?: string | null
          canonical_url?: string | null
          carrier_affected?: string | null
          category?: string | null
          classification_reason?: string | null
          country?: string | null
          created_at?: string
          department?: Database["public"]["Enums"]["intel_department"]
          department_confidence?: number
          effective_date?: string | null
          event_date?: string | null
          headline?: string
          id?: string
          impact?: string
          ingested_at?: string
          is_ai_draft?: boolean
          lane_affected?: string | null
          language?: string
          last_reviewed_at?: string | null
          last_verification_attempt_at?: string | null
          latitude?: number | null
          longitude?: number | null
          month?: number | null
          og_image_url?: string | null
          owner?: string | null
          port_affected?: string | null
          predicted_relevance?: number
          processing_error?: string | null
          processing_status?: Database["public"]["Enums"]["intel_processing_status"]
          publication_date?: string | null
          relevance_score?: number
          severity?: Database["public"]["Enums"]["intel_severity"]
          severity_score?: number
          source_entry_id?: string | null
          source_name?: string
          source_tier?: number
          source_url?: string | null
          status?: Database["public"]["Enums"]["intel_status"]
          suggested_action?: string | null
          summary?: string
          time_to_impact?: Database["public"]["Enums"]["intel_horizon"]
          time_to_impact_date?: string | null
          transport_modes?: string[] | null
          updated_at?: string
          updated_date?: string | null
          verification_attempts?: number
          verification_status?: string
          week_number?: number | null
          why_it_matters_to_hitek?: string | null
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
      learned_weights: {
        Row: {
          attribute_type: string
          attribute_value: string
          id: string
          not_useful_count: number
          updated_at: string
          useful_count: number
          weight: number
        }
        Insert: {
          attribute_type: string
          attribute_value: string
          id?: string
          not_useful_count?: number
          updated_at?: string
          useful_count?: number
          weight?: number
        }
        Update: {
          attribute_type?: string
          attribute_value?: string
          id?: string
          not_useful_count?: number
          updated_at?: string
          useful_count?: number
          weight?: number
        }
        Relationships: []
      }
      logistics_infrastructure: {
        Row: {
          aliases: string[]
          country: string | null
          country_code: string | null
          created_at: string
          hitek_relevance: number
          id: string
          importance: number
          kind: string
          latitude: number
          longitude: number
          name: string
          radius_km: number
          updated_at: string
        }
        Insert: {
          aliases?: string[]
          country?: string | null
          country_code?: string | null
          created_at?: string
          hitek_relevance?: number
          id?: string
          importance?: number
          kind: string
          latitude: number
          longitude: number
          name: string
          radius_km?: number
          updated_at?: string
        }
        Update: {
          aliases?: string[]
          country?: string | null
          country_code?: string | null
          created_at?: string
          hitek_relevance?: number
          id?: string
          importance?: number
          kind?: string
          latitude?: number
          longitude?: number
          name?: string
          radius_km?: number
          updated_at?: string
        }
        Relationships: []
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
          effective_date: string | null
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
          publication_date: string | null
          published_date: string
          region: Database["public"]["Enums"]["news_region"]
          region_confidence: number | null
          source_name: string
          source_url: string | null
          suggested_action: string | null
          summary: string
          updated_date: string | null
          verification_status: string
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
          effective_date?: string | null
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
          publication_date?: string | null
          published_date?: string
          region?: Database["public"]["Enums"]["news_region"]
          region_confidence?: number | null
          source_name?: string
          source_url?: string | null
          suggested_action?: string | null
          summary: string
          updated_date?: string | null
          verification_status?: string
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
          effective_date?: string | null
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
          publication_date?: string | null
          published_date?: string
          region?: Database["public"]["Enums"]["news_region"]
          region_confidence?: number | null
          source_name?: string
          source_url?: string | null
          suggested_action?: string | null
          summary?: string
          updated_date?: string | null
          verification_status?: string
          week_number?: number
          year?: number
        }
        Relationships: []
      }
      pipeline_control: {
        Row: {
          consecutive_rate_limits: number
          last_stage: string | null
          last_started_at: string | null
          last_success_at: string | null
          lease_expires_at: string | null
          lease_token: string | null
          paused_reason: string | null
          pipeline: string
          status: string
          updated_at: string
        }
        Insert: {
          consecutive_rate_limits?: number
          last_stage?: string | null
          last_started_at?: string | null
          last_success_at?: string | null
          lease_expires_at?: string | null
          lease_token?: string | null
          paused_reason?: string | null
          pipeline: string
          status?: string
          updated_at?: string
        }
        Update: {
          consecutive_rate_limits?: number
          last_stage?: string | null
          last_started_at?: string | null
          last_success_at?: string | null
          lease_expires_at?: string | null
          lease_token?: string | null
          paused_reason?: string | null
          pipeline?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      raw_items: {
        Row: {
          analysis_status: string
          body: string | null
          canonical_url: string | null
          classification_reason: string | null
          collected_at: string
          countries: string[]
          created_at: string
          department: string | null
          department_confidence: number | null
          duplicate_of: string | null
          event_id: string | null
          fetch_method: string | null
          id: string
          impact_score: number | null
          intel_item_id: string | null
          latitude: number | null
          longitude: number | null
          original_summary: string | null
          original_title: string
          payload: Json
          processing_error: string | null
          processing_status: Database["public"]["Enums"]["intel_processing_status"]
          published_at: string | null
          rejection_reason: string | null
          relevance_score: number | null
          severity_score: number | null
          source_language: string | null
          source_name: string
          source_type: string | null
          translated_summary: string | null
          translated_title: string | null
          updated_at: string
          updated_at_source: string | null
          url: string | null
          url_hash: string
        }
        Insert: {
          analysis_status?: string
          body?: string | null
          canonical_url?: string | null
          classification_reason?: string | null
          collected_at?: string
          countries?: string[]
          created_at?: string
          department?: string | null
          department_confidence?: number | null
          duplicate_of?: string | null
          event_id?: string | null
          fetch_method?: string | null
          id?: string
          impact_score?: number | null
          intel_item_id?: string | null
          latitude?: number | null
          longitude?: number | null
          original_summary?: string | null
          original_title: string
          payload?: Json
          processing_error?: string | null
          processing_status?: Database["public"]["Enums"]["intel_processing_status"]
          published_at?: string | null
          rejection_reason?: string | null
          relevance_score?: number | null
          severity_score?: number | null
          source_language?: string | null
          source_name: string
          source_type?: string | null
          translated_summary?: string | null
          translated_title?: string | null
          updated_at?: string
          updated_at_source?: string | null
          url?: string | null
          url_hash: string
        }
        Update: {
          analysis_status?: string
          body?: string | null
          canonical_url?: string | null
          classification_reason?: string | null
          collected_at?: string
          countries?: string[]
          created_at?: string
          department?: string | null
          department_confidence?: number | null
          duplicate_of?: string | null
          event_id?: string | null
          fetch_method?: string | null
          id?: string
          impact_score?: number | null
          intel_item_id?: string | null
          latitude?: number | null
          longitude?: number | null
          original_summary?: string | null
          original_title?: string
          payload?: Json
          processing_error?: string | null
          processing_status?: Database["public"]["Enums"]["intel_processing_status"]
          published_at?: string | null
          rejection_reason?: string | null
          relevance_score?: number | null
          severity_score?: number | null
          source_language?: string | null
          source_name?: string
          source_type?: string | null
          translated_summary?: string | null
          translated_title?: string | null
          updated_at?: string
          updated_at_source?: string | null
          url?: string | null
          url_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "raw_items_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "raw_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_items_event_fk"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "supply_chain_events"
            referencedColumns: ["id"]
          },
        ]
      }
      source_health: {
        Row: {
          consecutive_failures: number
          created_at: string
          http_status: number | null
          id: string
          items_found_last_run: number
          last_attempt_at: string | null
          last_error: string | null
          last_item_detected_at: string | null
          last_success_at: string | null
          latest_source_publication_at: string | null
          parse_status: string
          parser_method: string | null
          source_name: string
          source_type: string | null
          source_url: string | null
          stale: boolean
          status: string
          updated_at: string
        }
        Insert: {
          consecutive_failures?: number
          created_at?: string
          http_status?: number | null
          id?: string
          items_found_last_run?: number
          last_attempt_at?: string | null
          last_error?: string | null
          last_item_detected_at?: string | null
          last_success_at?: string | null
          latest_source_publication_at?: string | null
          parse_status?: string
          parser_method?: string | null
          source_name: string
          source_type?: string | null
          source_url?: string | null
          stale?: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          consecutive_failures?: number
          created_at?: string
          http_status?: number | null
          id?: string
          items_found_last_run?: number
          last_attempt_at?: string | null
          last_error?: string | null
          last_item_detected_at?: string | null
          last_success_at?: string | null
          latest_source_publication_at?: string | null
          parse_status?: string
          parser_method?: string | null
          source_name?: string
          source_type?: string | null
          source_url?: string | null
          stale?: boolean
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      source_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          duration_ms: number | null
          errors: string | null
          fetch_method: string | null
          http_status: number | null
          id: string
          items_discovered: number
          items_duplicates: number
          items_new: number
          items_rejected: number
          items_updated: number
          pages_requested: number
          run_id: string | null
          source_name: string
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          errors?: string | null
          fetch_method?: string | null
          http_status?: number | null
          id?: string
          items_discovered?: number
          items_duplicates?: number
          items_new?: number
          items_rejected?: number
          items_updated?: number
          pages_requested?: number
          run_id?: string | null
          source_name: string
          started_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          errors?: string | null
          fetch_method?: string | null
          http_status?: number | null
          id?: string
          items_discovered?: number
          items_duplicates?: number
          items_new?: number
          items_rejected?: number
          items_updated?: number
          pages_requested?: number
          run_id?: string | null
          source_name?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      sources: {
        Row: {
          category: string | null
          config: Json
          country: string | null
          created_at: string
          enabled: boolean
          feed_url: string | null
          fetch_method: string
          homepage: string | null
          id: string
          language: string
          name: string
          poll_interval_minutes: number
          source_type: string
          tier: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          config?: Json
          country?: string | null
          created_at?: string
          enabled?: boolean
          feed_url?: string | null
          fetch_method?: string
          homepage?: string | null
          id?: string
          language?: string
          name: string
          poll_interval_minutes?: number
          source_type?: string
          tier?: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          config?: Json
          country?: string | null
          created_at?: string
          enabled?: boolean
          feed_url?: string | null
          fetch_method?: string
          homepage?: string | null
          id?: string
          language?: string
          name?: string
          poll_interval_minutes?: number
          source_type?: string
          tier?: number
          updated_at?: string
        }
        Relationships: []
      }
      supply_chain_events: {
        Row: {
          affected_airports: string[]
          affected_industrial_regions: string[]
          affected_ports: string[]
          affected_shipping_lanes: string[]
          cluster_key: string
          confidence_score: number
          countries: string[]
          created_at: string
          departments: string[]
          event_name: string | null
          event_started_at: string | null
          event_status: string
          event_type: string
          first_detected_at: string
          forecast_time: string | null
          forecast_track: Json | null
          global_logistics_impact_score: number
          hazard_type: string | null
          hitek_relevance_score: number
          id: string
          is_active: boolean
          last_updated_at: string
          latitude: number | null
          logistics_impact: string | null
          longitude: number | null
          maximum_wind: number | null
          next_watchpoint: string | null
          primary_source_url: string | null
          resolved_at: string | null
          severity: string
          source_confidence: string
          source_count: number
          sources: Json
          summary: string
          title: string
          transport_modes: string[]
          updated_at: string
        }
        Insert: {
          affected_airports?: string[]
          affected_industrial_regions?: string[]
          affected_ports?: string[]
          affected_shipping_lanes?: string[]
          cluster_key: string
          confidence_score?: number
          countries?: string[]
          created_at?: string
          departments?: string[]
          event_name?: string | null
          event_started_at?: string | null
          event_status?: string
          event_type?: string
          first_detected_at?: string
          forecast_time?: string | null
          forecast_track?: Json | null
          global_logistics_impact_score?: number
          hazard_type?: string | null
          hitek_relevance_score?: number
          id?: string
          is_active?: boolean
          last_updated_at?: string
          latitude?: number | null
          logistics_impact?: string | null
          longitude?: number | null
          maximum_wind?: number | null
          next_watchpoint?: string | null
          primary_source_url?: string | null
          resolved_at?: string | null
          severity?: string
          source_confidence?: string
          source_count?: number
          sources?: Json
          summary?: string
          title: string
          transport_modes?: string[]
          updated_at?: string
        }
        Update: {
          affected_airports?: string[]
          affected_industrial_regions?: string[]
          affected_ports?: string[]
          affected_shipping_lanes?: string[]
          cluster_key?: string
          confidence_score?: number
          countries?: string[]
          created_at?: string
          departments?: string[]
          event_name?: string | null
          event_started_at?: string | null
          event_status?: string
          event_type?: string
          first_detected_at?: string
          forecast_time?: string | null
          forecast_track?: Json | null
          global_logistics_impact_score?: number
          hazard_type?: string | null
          hitek_relevance_score?: number
          id?: string
          is_active?: boolean
          last_updated_at?: string
          latitude?: number | null
          logistics_impact?: string | null
          longitude?: number | null
          maximum_wind?: number | null
          next_watchpoint?: string | null
          primary_source_url?: string | null
          resolved_at?: string | null
          severity?: string
          source_confidence?: string
          source_count?: number
          sources?: Json
          summary?: string
          title?: string
          transport_modes?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      weekly_digests: {
        Row: {
          act_now_count: number
          awareness_count: number
          category: string | null
          department: Database["public"]["Enums"]["intel_department"] | null
          generated_at: string
          id: string
          item_count: number
          period_end: string | null
          period_start: string | null
          summary_md: string
          this_week_count: number
          week_number: number
          year: number
        }
        Insert: {
          act_now_count?: number
          awareness_count?: number
          category?: string | null
          department?: Database["public"]["Enums"]["intel_department"] | null
          generated_at?: string
          id?: string
          item_count?: number
          period_end?: string | null
          period_start?: string | null
          summary_md: string
          this_week_count?: number
          week_number: number
          year: number
        }
        Update: {
          act_now_count?: number
          awareness_count?: number
          category?: string | null
          department?: Database["public"]["Enums"]["intel_department"] | null
          generated_at?: string
          id?: string
          item_count?: number
          period_end?: string | null
          period_start?: string | null
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
      acquire_pipeline_lease: {
        Args: { _lease_seconds?: number; _pipeline: string }
        Returns: string
      }
      canonical_intelligence: {
        Args: {
          _department?: Database["public"]["Enums"]["intel_department"]
          _end_date?: string
          _limit?: number
          _severity?: Database["public"]["Enums"]["intel_severity"]
          _start_date?: string
        }
        Returns: {
          action_required: string
          action_required_bool: boolean | null
          affected_lanes_or_customers: string | null
          affected_tags: string[]
          airport_affected: string | null
          alerted_at: string | null
          canonical_url: string | null
          carrier_affected: string | null
          category: string | null
          classification_reason: string | null
          country: string | null
          created_at: string
          department: Database["public"]["Enums"]["intel_department"]
          department_confidence: number
          effective_date: string | null
          event_date: string | null
          headline: string
          id: string
          impact: string
          ingested_at: string
          is_ai_draft: boolean
          lane_affected: string | null
          language: string
          last_reviewed_at: string | null
          last_verification_attempt_at: string | null
          latitude: number | null
          longitude: number | null
          month: number | null
          og_image_url: string | null
          owner: string | null
          port_affected: string | null
          predicted_relevance: number
          processing_error: string | null
          processing_status: Database["public"]["Enums"]["intel_processing_status"]
          publication_date: string | null
          relevance_score: number
          severity: Database["public"]["Enums"]["intel_severity"]
          severity_score: number
          source_entry_id: string | null
          source_name: string
          source_tier: number
          source_url: string | null
          status: Database["public"]["Enums"]["intel_status"]
          suggested_action: string | null
          summary: string
          time_to_impact: Database["public"]["Enums"]["intel_horizon"]
          time_to_impact_date: string | null
          transport_modes: string[] | null
          updated_at: string
          updated_date: string | null
          verification_attempts: number
          verification_status: string
          week_number: number | null
          why_it_matters_to_hitek: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "intelligence_items"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      canonical_intelligence_counts: {
        Args: {
          _department?: Database["public"]["Enums"]["intel_department"]
          _end_date?: string
          _severity?: Database["public"]["Enums"]["intel_severity"]
          _start_date?: string
        }
        Returns: Json
      }
      casablanca_week_bounds: {
        Args: { _anchor?: string }
        Returns: {
          iso_week: number
          iso_year: number
          period_end: string
          period_start: string
        }[]
      }
      cast_intel_vote: {
        Args: { _item_id: string; _vote: string; _voter: string }
        Returns: undefined
      }
      cleanup_old_entries: { Args: never; Returns: undefined }
      clear_intel_vote: {
        Args: { _item_id: string; _voter: string }
        Returns: undefined
      }
      intel_item_attributes: {
        Args: { _item_id: string }
        Returns: {
          attribute_type: string
          attribute_value: string
        }[]
      }
      is_hitek_admin: { Args: never; Returns: boolean }
      recompute_all_predicted_relevance: { Args: never; Returns: undefined }
      recompute_learned_weight: {
        Args: { _attr_type: string; _attr_value: string }
        Returns: undefined
      }
      recompute_predicted_relevance: {
        Args: { _item_id: string }
        Returns: undefined
      }
      release_pipeline_lease: {
        Args: {
          _error?: string
          _pipeline: string
          _stage?: string
          _succeeded: boolean
          _token: string
        }
        Returns: undefined
      }
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
      intel_processing_status:
        | "discovered"
        | "rejected_irrelevant"
        | "rejected_non_article"
        | "duplicate"
        | "processing"
        | "enriched"
        | "published"
        | "failed"
        | "review_required"
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
      intel_processing_status: [
        "discovered",
        "rejected_irrelevant",
        "rejected_non_article",
        "duplicate",
        "processing",
        "enriched",
        "published",
        "failed",
        "review_required",
      ],
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
