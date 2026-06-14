export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      attendance: {
        Row: {
          check_in: string | null;
          check_out: string | null;
          created_at: string;
          id: string;
          notes: string | null;
          status: Database["public"]["Enums"]["attendance_status"];
          updated_at: string;
          verification_status: Database["public"]["Enums"]["verification_status"];
          verified_at: string | null;
          verified_by: string | null;
          work_date: string;
          worker_id: string;
        };
        Insert: {
          check_in?: string | null;
          check_out?: string | null;
          created_at?: string;
          id?: string;
          notes?: string | null;
          status?: Database["public"]["Enums"]["attendance_status"];
          updated_at?: string;
          verification_status?: Database["public"]["Enums"]["verification_status"];
          verified_at?: string | null;
          verified_by?: string | null;
          work_date?: string;
          worker_id: string;
        };
        Update: {
          check_in?: string | null;
          check_out?: string | null;
          created_at?: string;
          id?: string;
          notes?: string | null;
          status?: Database["public"]["Enums"]["attendance_status"];
          updated_at?: string;
          verification_status?: Database["public"]["Enums"]["verification_status"];
          verified_at?: string | null;
          verified_by?: string | null;
          work_date?: string;
          worker_id?: string;
        };
        Relationships: [];
      };
      customer_orders: {
        Row: {
          assigned_delivery_user_id: string | null;
          bill_number: string | null;
          created_at: string;
          created_by: string;
          customer_name: string;
          customer_phone: string | null;
          deleted_at: string | null;
          delivery_address: string | null;
          delivery_charge: number;
          delivery_destination: string | null;
          delivery_time_slot: string | null;
          grocery_subtotal: number;
          id: string;
          items_delivered_text: string | null;
          merchant_settlement_amount: number;
          notes: string | null;
          order_items: string;
          required_date: string | null;
          shop_id: string | null;
          status: Database["public"]["Enums"]["order_status"];
          total_amount: number;
          trade_margin_percent_applied: number;
          updated_at: string;
          work_from_shop_id: string | null;
        };
        Insert: {
          assigned_delivery_user_id?: string | null;
          bill_number?: string | null;
          created_at?: string;
          created_by: string;
          customer_name: string;
          customer_phone: string | null;
          deleted_at?: string | null;
          delivery_address?: string | null;
          delivery_charge?: number;
          delivery_destination?: string | null;
          delivery_time_slot?: string | null;
          grocery_subtotal?: number;
          id?: string;
          items_delivered_text?: string | null;
          merchant_settlement_amount?: number;
          notes?: string | null;
          order_items: string;
          required_date?: string | null;
          shop_id?: string | null;
          status?: Database["public"]["Enums"]["order_status"];
          total_amount?: number;
          trade_margin_percent_applied?: number;
          updated_at?: string;
          work_from_shop_id?: string | null;
        };
        Update: {
          assigned_delivery_user_id?: string | null;
          bill_number?: string | null;
          created_at?: string;
          created_by?: string;
          customer_name?: string;
          customer_phone?: string | null;
          deleted_at?: string | null;
          delivery_address?: string | null;
          delivery_charge?: number;
          delivery_destination?: string | null;
          delivery_time_slot?: string | null;
          grocery_subtotal?: number;
          id?: string;
          items_delivered_text?: string | null;
          merchant_settlement_amount?: number;
          notes?: string | null;
          order_items?: string;
          required_date?: string | null;
          shop_id?: string | null;
          status?: Database["public"]["Enums"]["order_status"];
          total_amount?: number;
          trade_margin_percent_applied?: number;
          updated_at?: string;
          work_from_shop_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "customer_orders_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_orders_work_from_shop_id_fkey";
            columns: ["work_from_shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          category: string;
          created_at: string;
          created_by: string | null;
          default_quantity: number;
          id: string;
          is_active: boolean;
          merchant_unit_price: number;
          name: string;
          price: number;
          unit: string;
          updated_at: string;
        };
        Insert: {
          category?: string;
          created_at?: string;
          created_by?: string | null;
          default_quantity?: number;
          id?: string;
          is_active?: boolean;
          merchant_unit_price?: number;
          name: string;
          price?: number;
          unit?: string;
          updated_at?: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          created_by?: string | null;
          default_quantity?: number;
          id?: string;
          is_active?: boolean;
          merchant_unit_price?: number;
          name?: string;
          price?: number;
          unit?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          default_address: string | null;
          display_name: string;
          email: string | null;
          groobey_code: string | null;
          id: string;
          is_active: boolean;
          phone: string | null;
          shop_slug: string | null;
          trade_margin_percent: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          default_address?: string | null;
          display_name?: string;
          email?: string | null;
          groobey_code?: string | null;
          id?: string;
          is_active?: boolean;
          phone?: string | null;
          shop_slug?: string | null;
          trade_margin_percent?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          default_address?: string | null;
          display_name?: string;
          email?: string | null;
          groobey_code?: string | null;
          id?: string;
          is_active?: boolean;
          phone?: string | null;
          shop_slug?: string | null;
          trade_margin_percent?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      sale_items: {
        Row: {
          created_at: string;
          id: string;
          merchant_unit_price: number;
          product_id: string | null;
          product_name: string;
          product_unit: string | null;
          quantity: number;
          sale_id: string;
          unit_price: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          merchant_unit_price?: number;
          product_id?: string | null;
          product_name: string;
          product_unit?: string | null;
          quantity?: number;
          sale_id: string;
          unit_price?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          merchant_unit_price?: number;
          product_id?: string | null;
          product_name?: string;
          product_unit?: string | null;
          quantity?: number;
          sale_id?: string;
          unit_price?: number;
        };
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey";
            columns: ["sale_id"];
            isOneToOne: false;
            referencedRelation: "sales";
            referencedColumns: ["id"];
          },
        ];
      };
      sales: {
        Row: {
          bill_number: string | null;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          destination_type: Database["public"]["Enums"]["sale_destination_type"];
          id: string;
          trade_margin_percent_applied: number;
          notes: string | null;
          other_shop_name: string | null;
          shop_id: string | null;
          sold_at: string;
          status: Database["public"]["Enums"]["verification_status"];
          updated_at: string;
          verified_at: string | null;
          verified_by: string | null;
        };
        Insert: {
          bill_number?: string | null;
          created_at?: string;
          created_by: string;
          deleted_at?: string | null;
          destination_type?: Database["public"]["Enums"]["sale_destination_type"];
          id?: string;
          trade_margin_percent_applied?: number;
          notes?: string | null;
          other_shop_name?: string | null;
          shop_id?: string | null;
          sold_at?: string;
          status?: Database["public"]["Enums"]["verification_status"];
          updated_at?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Update: {
          bill_number?: string | null;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          destination_type?: Database["public"]["Enums"]["sale_destination_type"];
          id?: string;
          trade_margin_percent_applied?: number;
          notes?: string | null;
          other_shop_name?: string | null;
          shop_id?: string | null;
          sold_at?: string;
          status?: Database["public"]["Enums"]["verification_status"];
          updated_at?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sales_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      shop_combos: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string;
          id: string;
          image_url: string | null;
          is_active: boolean;
          name: string;
          price: number;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          name: string;
          price?: number;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          name?: string;
          price?: number;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      shops: {
        Row: {
          address: string | null;
          contact_name: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          is_active: boolean;
          name: string;
          phone: string | null;
          trade_margin_percent: number;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          contact_name?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          phone?: string | null;
          trade_margin_percent?: number;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          contact_name?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          phone?: string | null;
          trade_margin_percent?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      archive_customer_order: {
        Args: { p_order_id: string };
        Returns: undefined;
      };
      archive_sale: {
        Args: { p_sale_id: string };
        Returns: undefined;
      };
      verify_shop_owner_sale: {
        Args: {
          p_sale_id: string;
          p_status: Database["public"]["Enums"]["verification_status"];
        };
        Returns: Database["public"]["Tables"]["sales"]["Row"];
      };
      next_groobey_bill_number: {
        Args: Record<string, never>;
        Returns: string;
      };
      next_groobey_sale_bill_number: {
        Args: Record<string, never>;
        Returns: string;
      };
      next_groobey_customer_order_bill_number: {
        Args: Record<string, never>;
        Returns: string;
      };
      backfill_my_customer_order_bill_ids: {
        Args: Record<string, never>;
        Returns: { order_id: string; new_bill_number: string }[];
      };
      backfill_my_sale_bill_ids: {
        Args: Record<string, never>;
        Returns: { sale_id: string; new_bill_number: string }[];
      };
      set_my_trade_margin_percent: {
        Args: { pct: number };
        Returns: undefined;
      };
      mark_assigned_order_status: {
        Args: { p_order_id: string; p_status: Database["public"]["Enums"]["order_status"] };
        Returns: undefined;
      };
      register_customer_self: {
        Args: {
          p_display_name: string;
          p_email: string;
          p_phone: string;
          p_default_address: string;
        };
        Returns: undefined;
      };
      purge_my_old_customer_orders: {
        Args: { p_days?: number };
        Returns: undefined;
      };
    };
    Enums: {
      app_role:
        | "main_admin"
        | "admin"
        | "merchant"
        | "employee"
        | "order_taker"
        | "customer";
      attendance_status: "present" | "absent" | "half_day";
      order_status:
        | "pending"
        | "confirmed"
        | "packed"
        | "out_for_delivery"
        | "delivered"
        | "cancelled";
      sale_destination_type: "shop" | "self" | "other";
      verification_status: "pending" | "verified" | "rejected";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["main_admin", "admin", "merchant", "employee", "order_taker", "customer"],
      attendance_status: ["present", "absent", "half_day"],
      order_status: [
        "pending",
        "confirmed",
        "packed",
        "out_for_delivery",
        "delivered",
        "cancelled",
      ],
      sale_destination_type: ["shop", "self", "other"],
      verification_status: ["pending", "verified", "rejected"],
    },
  },
} as const;
