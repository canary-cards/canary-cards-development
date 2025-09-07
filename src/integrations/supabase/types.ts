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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      customers: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          auth_user_id: string | null
          city: string | null
          country: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          parsed_via: string | null
          postal_code: string | null
          raw_address_text: string
          state: string | null
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          auth_user_id?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          parsed_via?: string | null
          postal_code?: string | null
          raw_address_text: string
          state?: string | null
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          auth_user_id?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          parsed_via?: string | null
          postal_code?: string | null
          raw_address_text?: string
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          ai_draft_id: string | null
          amount_paid: number
          amount_refunded: number
          created_at: string
          currency: string
          customer_id: string
          email_for_receipt: string
          id: string
          metadata_snapshot: Json | null
          paid_at: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          postcard_count: number
          send_option: Database["public"]["Enums"]["send_option"]
          stripe_customer_id: string | null
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
        }
        Insert: {
          ai_draft_id?: string | null
          amount_paid: number
          amount_refunded?: number
          created_at?: string
          currency?: string
          customer_id: string
          email_for_receipt: string
          id?: string
          metadata_snapshot?: Json | null
          paid_at?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          postcard_count?: number
          send_option: Database["public"]["Enums"]["send_option"]
          stripe_customer_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
        }
        Update: {
          ai_draft_id?: string | null
          amount_paid?: number
          amount_refunded?: number
          created_at?: string
          currency?: string
          customer_id?: string
          email_for_receipt?: string
          id?: string
          metadata_snapshot?: Json | null
          paid_at?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          postcard_count?: number
          send_option?: Database["public"]["Enums"]["send_option"]
          stripe_customer_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_ai_draft_id_fkey"
            columns: ["ai_draft_id"]
            isOneToOne: false
            referencedRelation: "postcard_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      postcard_draft_sources: {
        Row: {
          ai_draft_id: string
          data_point_count: number
          description: string
          id: string
          ordinal: number
          url: string
        }
        Insert: {
          ai_draft_id: string
          data_point_count?: number
          description: string
          id?: string
          ordinal: number
          url: string
        }
        Update: {
          ai_draft_id?: string
          data_point_count?: number
          description?: string
          id?: string
          ordinal?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_draft_sources_ai_draft_id_fkey"
            columns: ["ai_draft_id"]
            isOneToOne: false
            referencedRelation: "postcard_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      postcard_drafts: {
        Row: {
          ai_drafted_message: string | null
          api_status_code: number | null
          api_status_message: string | null
          concerns: string | null
          created_at: string
          generation_status:
            | Database["public"]["Enums"]["generation_status"]
            | null
          human_approved_message: string | null
          id: string
          invite_code: string | null
          personal_impact: string | null
          recipient_snapshot: Json
          recipient_type: Database["public"]["Enums"]["recipient_type"]
          sent_order_id: string | null
          sources_count: number
          zip_code: string
        }
        Insert: {
          ai_drafted_message?: string | null
          api_status_code?: number | null
          api_status_message?: string | null
          concerns?: string | null
          created_at?: string
          generation_status?:
            | Database["public"]["Enums"]["generation_status"]
            | null
          human_approved_message?: string | null
          id?: string
          invite_code?: string | null
          personal_impact?: string | null
          recipient_snapshot: Json
          recipient_type: Database["public"]["Enums"]["recipient_type"]
          sent_order_id?: string | null
          sources_count?: number
          zip_code: string
        }
        Update: {
          ai_drafted_message?: string | null
          api_status_code?: number | null
          api_status_message?: string | null
          concerns?: string | null
          created_at?: string
          generation_status?:
            | Database["public"]["Enums"]["generation_status"]
            | null
          human_approved_message?: string | null
          id?: string
          invite_code?: string | null
          personal_impact?: string | null
          recipient_snapshot?: Json
          recipient_type?: Database["public"]["Enums"]["recipient_type"]
          sent_order_id?: string | null
          sources_count?: number
          zip_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_ai_drafts_sent_order_id"
            columns: ["sent_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      postcards: {
        Row: {
          created_at: string
          delivery_metadata: Json | null
          delivery_status: Database["public"]["Enums"]["delivery_status"]
          id: string
          ignitepost_created_at: string | null
          ignitepost_error: string | null
          ignitepost_order_id: string | null
          ignitepost_send_on: string | null
          ignitepost_template_id: string | null
          mailed_at: string | null
          message_text: string
          order_id: string
          postcard_front_image: string | null
          recipient_district_info: string | null
          recipient_name: string
          recipient_office_address: string | null
          recipient_snapshot: Json
          recipient_title: string | null
          recipient_type: Database["public"]["Enums"]["recipient_type"]
          sender_snapshot: Json
          webhook_received_at: string | null
        }
        Insert: {
          created_at?: string
          delivery_metadata?: Json | null
          delivery_status?: Database["public"]["Enums"]["delivery_status"]
          id?: string
          ignitepost_created_at?: string | null
          ignitepost_error?: string | null
          ignitepost_order_id?: string | null
          ignitepost_send_on?: string | null
          ignitepost_template_id?: string | null
          mailed_at?: string | null
          message_text: string
          order_id: string
          postcard_front_image?: string | null
          recipient_district_info?: string | null
          recipient_name: string
          recipient_office_address?: string | null
          recipient_snapshot: Json
          recipient_title?: string | null
          recipient_type: Database["public"]["Enums"]["recipient_type"]
          sender_snapshot: Json
          webhook_received_at?: string | null
        }
        Update: {
          created_at?: string
          delivery_metadata?: Json | null
          delivery_status?: Database["public"]["Enums"]["delivery_status"]
          id?: string
          ignitepost_created_at?: string | null
          ignitepost_error?: string | null
          ignitepost_order_id?: string | null
          ignitepost_send_on?: string | null
          ignitepost_template_id?: string | null
          mailed_at?: string | null
          message_text?: string
          order_id?: string
          postcard_front_image?: string | null
          recipient_district_info?: string | null
          recipient_name?: string
          recipient_office_address?: string | null
          recipient_snapshot?: Json
          recipient_title?: string | null
          recipient_type?: Database["public"]["Enums"]["recipient_type"]
          sender_snapshot?: Json
          webhook_received_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "postcards_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      delivery_status: "submitted" | "mailed" | "failed"
      generation_status: "pending" | "success" | "error" | "approved"
      payment_status: "pending" | "paid" | "failed" | "refunded"
      recipient_type: "representative" | "senator"
      send_option: "single" | "double" | "triple"
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
      delivery_status: ["submitted", "mailed", "failed"],
      generation_status: ["pending", "success", "error", "approved"],
      payment_status: ["pending", "paid", "failed", "refunded"],
      recipient_type: ["representative", "senator"],
      send_option: ["single", "double", "triple"],
    },
  },
} as const
