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
      banners: {
        Row: {
          created_at: string
          id: string
          image_url: string
          link: string | null
          position: number
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          link?: string | null
          position?: number
          store_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          link?: string | null
          position?: number
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "banners_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          store_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          name_snapshot: string
          order_id: string
          price_snapshot: number
          product_id: string | null
          qty: number
        }
        Insert: {
          id?: string
          name_snapshot: string
          order_id: string
          price_snapshot: number
          product_id?: string | null
          qty?: number
        }
        Update: {
          id?: string
          name_snapshot?: string
          order_id?: string
          price_snapshot?: number
          product_id?: string | null
          qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: string
          area: string | null
          created_at: string
          customer_name: string
          id: string
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          phone: string
          status: Database["public"]["Enums"]["order_status"]
          store_id: string
          subtotal: number
          txn_id: string | null
          updated_at: string
        }
        Insert: {
          address: string
          area?: string | null
          created_at?: string
          customer_name: string
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          phone: string
          status?: Database["public"]["Enums"]["order_status"]
          store_id: string
          subtotal?: number
          txn_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          area?: string | null
          created_at?: string
          customer_name?: string
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          phone?: string
          status?: Database["public"]["Enums"]["order_status"]
          store_id?: string
          subtotal?: number
          txn_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: string | null
          package_id: string | null
          status: string
          store_id: string
          txn_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          method?: string | null
          package_id?: string | null
          status?: string
          store_id: string
          txn_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: string | null
          package_id?: string | null
          status?: string
          store_id?: string
          txn_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "subscription_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_notices: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_active: boolean
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          title?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          gallery: Json
          id: string
          name: string
          old_price: number | null
          price: number
          primary_image_url: string | null
          return_policy: string | null
          shipping_info: string | null
          slug: string
          status: Database["public"]["Enums"]["product_status"]
          stock: number
          store_id: string
          updated_at: string
          warranty: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          gallery?: Json
          id?: string
          name: string
          old_price?: number | null
          price?: number
          primary_image_url?: string | null
          return_policy?: string | null
          shipping_info?: string | null
          slug: string
          status?: Database["public"]["Enums"]["product_status"]
          stock?: number
          store_id: string
          updated_at?: string
          warranty?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          gallery?: Json
          id?: string
          name?: string
          old_price?: number | null
          price?: number
          primary_image_url?: string | null
          return_policy?: string | null
          shipping_info?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["product_status"]
          stock?: number
          store_id?: string
          updated_at?: string
          warranty?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string | null
          bkash_number: string | null
          button_color: string | null
          couriers: Json
          created_at: string
          delivery: Json
          description: string | null
          expires_at: string | null
          facebook: string | null
          footer_color: string | null
          header_color: string | null
          id: string
          logo_url: string | null
          marketing: Json
          nagad_number: string | null
          name: string
          notifications: Json
          owner_user_id: string
          package_id: string | null
          payments_config: Json
          phone: string | null
          primary_color: string
          product_defaults: Json
          seo: Json
          slug: string
          status: Database["public"]["Enums"]["store_status"]
          theme: Json
          title_bar_color: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          bkash_number?: string | null
          button_color?: string | null
          couriers?: Json
          created_at?: string
          delivery?: Json
          description?: string | null
          expires_at?: string | null
          facebook?: string | null
          footer_color?: string | null
          header_color?: string | null
          id?: string
          logo_url?: string | null
          marketing?: Json
          nagad_number?: string | null
          name: string
          notifications?: Json
          owner_user_id: string
          package_id?: string | null
          payments_config?: Json
          phone?: string | null
          primary_color?: string
          product_defaults?: Json
          seo?: Json
          slug: string
          status?: Database["public"]["Enums"]["store_status"]
          theme?: Json
          title_bar_color?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          bkash_number?: string | null
          button_color?: string | null
          couriers?: Json
          created_at?: string
          delivery?: Json
          description?: string | null
          expires_at?: string | null
          facebook?: string | null
          footer_color?: string | null
          header_color?: string | null
          id?: string
          logo_url?: string | null
          marketing?: Json
          nagad_number?: string | null
          name?: string
          notifications?: Json
          owner_user_id?: string
          package_id?: string | null
          payments_config?: Json
          phone?: string | null
          primary_color?: string
          product_defaults?: Json
          seo?: Json
          slug?: string
          status?: Database["public"]["Enums"]["store_status"]
          theme?: Json
          title_bar_color?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stores_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "subscription_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_packages: {
        Row: {
          created_at: string
          duration_days: number
          id: string
          is_active: boolean
          name: string
          price: number
          product_limit: number
        }
        Insert: {
          created_at?: string
          duration_days?: number
          id?: string
          is_active?: boolean
          name: string
          price?: number
          product_limit?: number
        }
        Update: {
          created_at?: string
          duration_days?: number
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          product_limit?: number
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "user"
      order_status:
        | "pending"
        | "confirmed"
        | "processing"
        | "delivered"
        | "cancelled"
      payment_method: "cod" | "bkash" | "nagad" | "rocket" | "bank"
      product_status: "active" | "draft" | "out_of_stock"
      store_status: "active" | "suspended"
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
      app_role: ["owner", "user"],
      order_status: [
        "pending",
        "confirmed",
        "processing",
        "delivered",
        "cancelled",
      ],
      payment_method: ["cod", "bkash", "nagad", "rocket", "bank"],
      product_status: ["active", "draft", "out_of_stock"],
      store_status: ["active", "suspended"],
    },
  },
} as const
