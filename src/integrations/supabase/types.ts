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
      dimensions: {
        Row: {
          created_at: string
          field: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          field: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          field?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      pim_metadata: {
        Row: {
          attribute_order: string[]
          id: string
          updated_at: string
        }
        Insert: {
          attribute_order?: string[]
          id?: string
          updated_at?: string
        }
        Update: {
          attribute_order?: string[]
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      pim_records: {
        Row: {
          attributes: Json
          categoria_n1_comercial: string | null
          clasificacion_producto: string | null
          codigo_jaivana: string
          created_at: string
          estado_global: string | null
          id: string
          updated_at: string
          visibilidad_b2b: string | null
          visibilidad_b2c: string | null
        }
        Insert: {
          attributes?: Json
          categoria_n1_comercial?: string | null
          clasificacion_producto?: string | null
          codigo_jaivana: string
          created_at?: string
          estado_global?: string | null
          id?: string
          updated_at?: string
          visibilidad_b2b?: string | null
          visibilidad_b2c?: string | null
        }
        Update: {
          attributes?: Json
          categoria_n1_comercial?: string | null
          clasificacion_producto?: string | null
          codigo_jaivana?: string
          created_at?: string
          estado_global?: string | null
          id?: string
          updated_at?: string
          visibilidad_b2b?: string | null
          visibilidad_b2c?: string | null
        }
        Relationships: []
      }
      pim_records_staging: {
        Row: {
          attributes: Json
          categoria_n1_comercial: string | null
          clasificacion_producto: string | null
          codigo_jaivana: string
          created_at: string
          estado_global: string | null
          id: string
          updated_at: string
          visibilidad_b2b: string | null
          visibilidad_b2c: string | null
        }
        Insert: {
          attributes?: Json
          categoria_n1_comercial?: string | null
          clasificacion_producto?: string | null
          codigo_jaivana: string
          created_at?: string
          estado_global?: string | null
          id?: string
          updated_at?: string
          visibilidad_b2b?: string | null
          visibilidad_b2c?: string | null
        }
        Update: {
          attributes?: Json
          categoria_n1_comercial?: string | null
          clasificacion_producto?: string | null
          codigo_jaivana?: string
          created_at?: string
          estado_global?: string | null
          id?: string
          updated_at?: string
          visibilidad_b2b?: string | null
          visibilidad_b2c?: string | null
        }
        Relationships: []
      }
      pim_upload_history: {
        Row: {
          attribute_order: string[]
          errors: number
          file_name: string
          id: string
          inserted: number
          status: string
          total_rows: number
          unique_rows: number
          updated: number
          uploaded_at: string
        }
        Insert: {
          attribute_order?: string[]
          errors?: number
          file_name: string
          id?: string
          inserted?: number
          status?: string
          total_rows?: number
          unique_rows?: number
          updated?: number
          uploaded_at?: string
        }
        Update: {
          attribute_order?: string[]
          errors?: number
          file_name?: string
          id?: string
          inserted?: number
          status?: string
          total_rows?: number
          unique_rows?: number
          updated?: number
          uploaded_at?: string
        }
        Relationships: []
      }
      predefined_reports: {
        Row: {
          attributes: string[]
          created_at: string
          description: string
          id: string
          name: string
          universe: string
          universe_key: string
          updated_at: string
        }
        Insert: {
          attributes?: string[]
          created_at?: string
          description?: string
          id?: string
          name: string
          universe?: string
          universe_key?: string
          updated_at?: string
        }
        Update: {
          attributes?: string[]
          created_at?: string
          description?: string
          id?: string
          name?: string
          universe?: string
          universe_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string
          id: string
          name: string
          track_insights: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          id: string
          name: string
          track_insights?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          id?: string
          name?: string
          track_insights?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      usage_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          report_id: string | null
          report_name: string | null
          report_type: string | null
          source_type: string | null
          user_email: string
          user_id: string
          user_role: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          report_id?: string | null
          report_name?: string | null
          report_type?: string | null
          source_type?: string | null
          user_email?: string
          user_id: string
          user_role?: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          report_id?: string | null
          report_name?: string | null
          report_type?: string | null
          source_type?: string | null
          user_email?: string
          user_id?: string
          user_role?: string
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_pim_version: {
        Args: { p_upload_id: string }
        Returns: undefined
      }
      get_pim_kpis: { Args: never; Returns: Json }
      get_report_completeness: { Args: { p_report_id: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "pim_manager" | "usuario_pro"
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
      app_role: ["pim_manager", "usuario_pro"],
    },
  },
} as const
