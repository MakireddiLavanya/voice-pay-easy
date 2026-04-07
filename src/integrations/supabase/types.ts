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
      authentication_logs: {
        Row: {
          auth_method: string
          created_at: string
          details: string | null
          id: string
          ip_address: string | null
          success: boolean
          user_id: string
        }
        Insert: {
          auth_method: string
          created_at?: string
          details?: string | null
          id?: string
          ip_address?: string | null
          success: boolean
          user_id: string
        }
        Update: {
          auth_method?: string
          created_at?: string
          details?: string | null
          id?: string
          ip_address?: string | null
          success?: boolean
          user_id?: string
        }
        Relationships: []
      }
      face_references: {
        Row: {
          created_at: string
          id: string
          image_data: string
          is_active: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_data: string
          is_active?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_data?: string
          is_active?: boolean
          user_id?: string
        }
        Relationships: []
      }
      fraud_alerts: {
        Row: {
          alert_type: string
          created_at: string
          description: string
          id: string
          is_resolved: boolean
          severity: string
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          description: string
          id?: string
          is_resolved?: boolean
          severity?: string
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          description?: string
          id?: string
          is_resolved?: boolean
          severity?: string
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      otp_codes: {
        Row: {
          code_hash: string
          created_at: string
          expires_at: string
          id: string
          purpose: string
          used: boolean
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          expires_at: string
          id?: string
          purpose?: string
          used?: boolean
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          expires_at?: string
          id?: string
          purpose?: string
          used?: boolean
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          auth_mode: string
          created_at: string
          email: string
          face_enrolled: boolean
          failed_auth_attempts: number
          full_name: string
          id: string
          locked_until: string | null
          mobile_number: string
          transaction_pin: string | null
          updated_at: string
          user_id: string
          voice_enrolled: boolean | null
          voice_passphrase: string | null
          voice_tolerance: number
        }
        Insert: {
          auth_mode?: string
          created_at?: string
          email: string
          face_enrolled?: boolean
          failed_auth_attempts?: number
          full_name: string
          id?: string
          locked_until?: string | null
          mobile_number?: string
          transaction_pin?: string | null
          updated_at?: string
          user_id: string
          voice_enrolled?: boolean | null
          voice_passphrase?: string | null
          voice_tolerance?: number
        }
        Update: {
          auth_mode?: string
          created_at?: string
          email?: string
          face_enrolled?: boolean
          failed_auth_attempts?: number
          full_name?: string
          id?: string
          locked_until?: string | null
          mobile_number?: string
          transaction_pin?: string | null
          updated_at?: string
          user_id?: string
          voice_enrolled?: boolean | null
          voice_passphrase?: string | null
          voice_tolerance?: number
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          receiver_id: string
          sender_id: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          receiver_id: string
          sender_id: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          receiver_id?: string
          sender_id?: string
          status?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          bank_account_no: string
          created_at: string
          id: string
          ifsc_code: string
          is_active: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          bank_account_no: string
          created_at?: string
          id?: string
          ifsc_code?: string
          is_active?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          bank_account_no?: string
          created_at?: string
          id?: string
          ifsc_code?: string
          is_active?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      profiles_public: {
        Row: {
          email: string | null
          full_name: string | null
          mobile_number: string | null
          user_id: string | null
        }
        Insert: {
          email?: string | null
          full_name?: string | null
          mobile_number?: string | null
          user_id?: string | null
        }
        Update: {
          email?: string | null
          full_name?: string | null
          mobile_number?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_account_locked: { Args: never; Returns: Json }
      generate_otp: { Args: { p_purpose?: string }; Returns: Json }
      increment_failed_attempts: { Args: never; Returns: Json }
      reset_failed_attempts: { Args: never; Returns: undefined }
      set_transaction_pin: { Args: { p_pin: string }; Returns: Json }
      transfer_funds: {
        Args: {
          p_amount: number
          p_description?: string
          p_receiver_id: string
          p_sender_id: string
        }
        Returns: Json
      }
      verify_otp: {
        Args: { p_code: string; p_purpose?: string }
        Returns: Json
      }
      verify_transaction_pin: { Args: { p_pin: string }; Returns: Json }
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
