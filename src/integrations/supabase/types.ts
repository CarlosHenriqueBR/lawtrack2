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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          details: Json | null
          id: string
          target: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          target?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          target?: string | null
        }
        Relationships: []
      }
      checkout_leads: {
        Row: {
          access_email_sent_at: string | null
          created_at: string
          email: string
          id: string
          lead_key: string
          session_key: string | null
          transaction_email: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          access_email_sent_at?: string | null
          created_at?: string
          email: string
          id?: string
          lead_key: string
          session_key?: string | null
          transaction_email: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          access_email_sent_at?: string | null
          created_at?: string
          email?: string
          id?: string
          lead_key?: string
          session_key?: string | null
          transaction_email?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
      }
      checkout_links: {
        Row: {
          capture_appearance: Json
          created_at: string
          custom_script: string | null
          enabled: boolean
          funnel_id: string | null
          id: string
          orderform_id: string
          product_id: string
          slug: string
          tiktok_pixel_id: string | null
          title: string
        }
        Insert: {
          capture_appearance?: Json
          created_at?: string
          custom_script?: string | null
          enabled?: boolean
          funnel_id?: string | null
          id?: string
          orderform_id: string
          product_id: string
          slug: string
          tiktok_pixel_id?: string | null
          title: string
        }
        Update: {
          capture_appearance?: Json
          created_at?: string
          custom_script?: string | null
          enabled?: boolean
          funnel_id?: string | null
          id?: string
          orderform_id?: string
          product_id?: string
          slug?: string
          tiktok_pixel_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkout_links_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
        ]
      }
      event_queue: {
        Row: {
          attempts: number
          created_at: string
          destination: string
          event_id: string
          event_name: string
          funnel_id: string | null
          id: string
          last_error: string | null
          last_status_code: number | null
          next_attempt_at: string
          payload: Json
          session_id: string | null
          status: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          destination?: string
          event_id: string
          event_name: string
          funnel_id?: string | null
          id?: string
          last_error?: string | null
          last_status_code?: number | null
          next_attempt_at?: string
          payload: Json
          session_id?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          destination?: string
          event_id?: string
          event_name?: string
          funnel_id?: string | null
          id?: string
          last_error?: string | null
          last_status_code?: number | null
          next_attempt_at?: string
          payload?: Json
          session_id?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_queue_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_queue_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_queue_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          event_id: string
          funnel_id: string
          id: string
          session_id: string
          step_id: string | null
          type: string
          url: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          funnel_id: string
          id?: string
          session_id: string
          step_id?: string | null
          type: string
          url?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          funnel_id?: string
          id?: string
          session_id?: string
          step_id?: string | null
          type?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "funnel_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_steps: {
        Row: {
          created_at: string
          funnel_id: string
          id: string
          name: string
          step_order: number
          url_pattern: string
        }
        Insert: {
          created_at?: string
          funnel_id: string
          id?: string
          name: string
          step_order: number
          url_pattern: string
        }
        Update: {
          created_at?: string
          funnel_id?: string
          id?: string
          name?: string
          step_order?: number
          url_pattern?: string
        }
        Relationships: [
          {
            foreignKeyName: "funnel_steps_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
        ]
      }
      funnels: {
        Row: {
          base_url: string | null
          created_at: string
          description: string | null
          domain: string | null
          id: string
          name: string
          status: string
          tiktok_pixel_id: string | null
          tracking_params: Json
          updated_at: string
        }
        Insert: {
          base_url?: string | null
          created_at?: string
          description?: string | null
          domain?: string | null
          id?: string
          name: string
          status?: string
          tiktok_pixel_id?: string | null
          tracking_params?: Json
          updated_at?: string
        }
        Update: {
          base_url?: string | null
          created_at?: string
          description?: string | null
          domain?: string | null
          id?: string
          name?: string
          status?: string
          tiktok_pixel_id?: string | null
          tracking_params?: Json
          updated_at?: string
        }
        Relationships: []
      }
      hosted_files: {
        Row: {
          content_type: string | null
          id: string
          path: string
          site_id: string
          size: number
          updated_at: string
        }
        Insert: {
          content_type?: string | null
          id?: string
          path: string
          site_id: string
          size?: number
          updated_at?: string
        }
        Update: {
          content_type?: string | null
          id?: string
          path?: string
          site_id?: string
          size?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hosted_files_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "hosted_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      hosted_sites: {
        Row: {
          ab_page: string | null
          ab_param: string | null
          ab_value: string | null
          created_at: string
          default_page: string
          enabled: boolean
          funnel_id: string | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          ab_page?: string | null
          ab_param?: string | null
          ab_value?: string | null
          created_at?: string
          default_page?: string
          enabled?: boolean
          funnel_id?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          ab_page?: string | null
          ab_param?: string | null
          ab_value?: string | null
          created_at?: string
          default_page?: string
          enabled?: boolean
          funnel_id?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hosted_sites_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_secrets: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      integrations: {
        Row: {
          funnel_id: string
          id: string
          tiktok_advertiser_id: string | null
          tiktok_enabled: boolean
          tiktok_test_event_code: string | null
          tiktok_test_mode: boolean
          token_hint: string | null
          updated_at: string
        }
        Insert: {
          funnel_id: string
          id?: string
          tiktok_advertiser_id?: string | null
          tiktok_enabled?: boolean
          tiktok_test_event_code?: string | null
          tiktok_test_mode?: boolean
          token_hint?: string | null
          updated_at?: string
        }
        Update: {
          funnel_id?: string
          id?: string
          tiktok_advertiser_id?: string | null
          tiktok_enabled?: boolean
          tiktok_test_event_code?: string | null
          tiktok_test_mode?: boolean
          token_hint?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: true
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          bucket: string
          hits: number
          window_start: string
        }
        Insert: {
          bucket: string
          hits?: number
          window_start: string
        }
        Update: {
          bucket?: string
          hits?: number
          window_start?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          browser: string | null
          city: string | null
          converted: boolean
          country: string | null
          current_step_id: string | null
          current_url: string | null
          device: string | null
          funnel_id: string
          id: string
          is_returning: boolean
          landing_url: string | null
          language: string | null
          last_seen_at: string
          max_step_order: number
          os: string | null
          page_views: number
          previous_url: string | null
          referrer: string | null
          region: string | null
          screen: string | null
          session_key: string
          started_at: string
          tt_ad: string | null
          tt_adset: string | null
          tt_campaign: string | null
          ttclid: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          visitor_id: string
        }
        Insert: {
          browser?: string | null
          city?: string | null
          converted?: boolean
          country?: string | null
          current_step_id?: string | null
          current_url?: string | null
          device?: string | null
          funnel_id: string
          id?: string
          is_returning?: boolean
          landing_url?: string | null
          language?: string | null
          last_seen_at?: string
          max_step_order?: number
          os?: string | null
          page_views?: number
          previous_url?: string | null
          referrer?: string | null
          region?: string | null
          screen?: string | null
          session_key: string
          started_at?: string
          tt_ad?: string | null
          tt_adset?: string | null
          tt_campaign?: string | null
          ttclid?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id: string
        }
        Update: {
          browser?: string | null
          city?: string | null
          converted?: boolean
          country?: string | null
          current_step_id?: string | null
          current_url?: string | null
          device?: string | null
          funnel_id?: string
          id?: string
          is_returning?: boolean
          landing_url?: string | null
          language?: string | null
          last_seen_at?: string
          max_step_order?: number
          os?: string | null
          page_views?: number
          previous_url?: string | null
          referrer?: string | null
          region?: string | null
          screen?: string | null
          session_key?: string
          started_at?: string
          tt_ad?: string | null
          tt_adset?: string | null
          tt_campaign?: string | null
          ttclid?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_current_step_id_fkey"
            columns: ["current_step_id"]
            isOneToOne: false
            referencedRelation: "funnel_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
        ]
      }
      system_logs: {
        Row: {
          attempt: number | null
          created_at: string
          details: Json | null
          duration_ms: number | null
          endpoint: string | null
          event_name: string | null
          funnel_id: string | null
          id: string
          level: string
          message: string
          session_id: string | null
          source: string
          status_code: number | null
          visitor_id: string | null
        }
        Insert: {
          attempt?: number | null
          created_at?: string
          details?: Json | null
          duration_ms?: number | null
          endpoint?: string | null
          event_name?: string | null
          funnel_id?: string | null
          id?: string
          level: string
          message: string
          session_id?: string | null
          source: string
          status_code?: number | null
          visitor_id?: string | null
        }
        Update: {
          attempt?: number | null
          created_at?: string
          details?: Json | null
          duration_ms?: number | null
          endpoint?: string | null
          event_name?: string | null
          funnel_id?: string | null
          id?: string
          level?: string
          message?: string
          session_id?: string | null
          source?: string
          status_code?: number | null
          visitor_id?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number | null
          campaign: string | null
          created_at: string
          currency: string | null
          funnel_id: string | null
          id: string
          occurred_at: string
          order_id: string
          product: string | null
          provider: string
          session_id: string | null
          status: string
          transaction_id: string | null
          ttclid: string | null
          updated_at: string
          visitor_id: string | null
        }
        Insert: {
          amount?: number | null
          campaign?: string | null
          created_at?: string
          currency?: string | null
          funnel_id?: string | null
          id?: string
          occurred_at?: string
          order_id: string
          product?: string | null
          provider?: string
          session_id?: string | null
          status: string
          transaction_id?: string | null
          ttclid?: string | null
          updated_at?: string
          visitor_id?: string | null
        }
        Update: {
          amount?: number | null
          campaign?: string | null
          created_at?: string
          currency?: string | null
          funnel_id?: string | null
          id?: string
          occurred_at?: string
          order_id?: string
          product?: string | null
          provider?: string
          session_id?: string | null
          status?: string
          transaction_id?: string | null
          ttclid?: string | null
          updated_at?: string
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          created_at: string
          dedupe_key: string
          error: string | null
          event_type: string | null
          id: string
          payload: Json
          provider: string
          status: string
        }
        Insert: {
          created_at?: string
          dedupe_key: string
          error?: string | null
          event_type?: string | null
          id?: string
          payload: Json
          provider: string
          status?: string
        }
        Update: {
          created_at?: string
          dedupe_key?: string
          error?: string | null
          event_type?: string | null
          id?: string
          payload?: Json
          provider?: string
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_manage: { Args: { _uid: string }; Returns: boolean }
      can_view: { Args: { _uid: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hit_rate_limit: {
        Args: { _bucket: string; _max: number; _window_seconds: number }
        Returns: boolean
      }
      user_role_level: { Args: { _uid: string }; Returns: number }
    }
    Enums: {
      app_role: "admin" | "user" | "super_admin" | "analyst" | "viewer"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "user", "super_admin", "analyst", "viewer"],
    },
  },
} as const
