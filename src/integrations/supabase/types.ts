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
      ai_conversations: {
        Row: {
          address: string | null
          channel: string
          created_at: string
          customer_name: string | null
          external_id: string | null
          id: string
          phone: string | null
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          channel?: string
          created_at?: string
          customer_name?: string | null
          external_id?: string | null
          id?: string
          phone?: string | null
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          channel?: string
          created_at?: string
          customer_name?: string | null
          external_id?: string | null
          id?: string
          phone?: string | null
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_global_settings: {
        Row: {
          created_at: string
          default_model: string
          enabled: boolean
          id: number
          provider_api_key: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_model?: string
          enabled?: boolean
          id?: number
          provider_api_key?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_model?: string
          enabled?: boolean
          id?: number
          provider_api_key?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          completion_tokens: number
          cost_usd: number
          created_at: string
          id: string
          kind: string
          model: string
          prompt_tokens: number
          store_id: string | null
        }
        Insert: {
          completion_tokens?: number
          cost_usd?: number
          created_at?: string
          id?: string
          kind?: string
          model: string
          prompt_tokens?: number
          store_id?: string | null
        }
        Update: {
          completion_tokens?: number
          cost_usd?: number
          created_at?: string
          id?: string
          kind?: string
          model?: string
          prompt_tokens?: number
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
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
      coupon_redemptions: {
        Row: {
          coupon_id: string
          created_at: string
          customer_phone: string | null
          discount_amount: number
          id: string
          order_id: string | null
          store_id: string
        }
        Insert: {
          coupon_id: string
          created_at?: string
          customer_phone?: string | null
          discount_amount?: number
          id?: string
          order_id?: string | null
          store_id: string
        }
        Update: {
          coupon_id?: string
          created_at?: string
          customer_phone?: string | null
          discount_amount?: number
          id?: string
          order_id?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          expires_at: string | null
          id: string
          min_order: number
          starts_at: string | null
          store_id: string
          type: Database["public"]["Enums"]["coupon_type"]
          updated_at: string
          usage_limit: number | null
          used_count: number
          value: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          min_order?: number
          starts_at?: string | null
          store_id: string
          type: Database["public"]["Enums"]["coupon_type"]
          updated_at?: string
          usage_limit?: number | null
          used_count?: number
          value?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          min_order?: number
          starts_at?: string | null
          store_id?: string
          type?: Database["public"]["Enums"]["coupon_type"]
          updated_at?: string
          usage_limit?: number | null
          used_count?: number
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "coupons_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_notes: {
        Row: {
          created_at: string
          customer_phone: string
          id: string
          note: string | null
          store_id: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_phone: string
          id?: string
          note?: string | null
          store_id: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_phone?: string
          id?: string
          note?: string | null
          store_id?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_notes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          id: string
          note: string | null
          spent_on: string
          store_id: string
        }
        Insert: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          id?: string
          note?: string | null
          spent_on?: string
          store_id: string
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          id?: string
          note?: string | null
          spent_on?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      messenger_integrations: {
        Row: {
          connected_at: string | null
          created_at: string
          id: string
          page_access_token: string | null
          page_id: string | null
          status: string
          store_id: string
          updated_at: string
          verify_token: string | null
        }
        Insert: {
          connected_at?: string | null
          created_at?: string
          id?: string
          page_access_token?: string | null
          page_id?: string | null
          status?: string
          store_id: string
          updated_at?: string
          verify_token?: string | null
        }
        Update: {
          connected_at?: string | null
          created_at?: string
          id?: string
          page_access_token?: string | null
          page_id?: string | null
          status?: string
          store_id?: string
          updated_at?: string
          verify_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messenger_integrations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      order_internal_notes: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          order_id: string
          store_id: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          order_id: string
          store_id: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          order_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_internal_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_internal_notes_store_id_fkey"
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
      order_timeline: {
        Row: {
          created_at: string
          id: string
          note: string | null
          order_id: string
          stage: Database["public"]["Enums"]["order_stage"]
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          order_id: string
          stage: Database["public"]["Enums"]["order_stage"]
          store_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          order_id?: string
          stage?: Database["public"]["Enums"]["order_stage"]
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_timeline_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_timeline_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: string
          area: string | null
          coupon_id: string | null
          created_at: string
          customer_name: string
          delivery_amount: number | null
          discount_amount: number | null
          id: string
          invoice_no: string | null
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
          coupon_id?: string | null
          created_at?: string
          customer_name: string
          delivery_amount?: number | null
          discount_amount?: number | null
          id?: string
          invoice_no?: string | null
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
          coupon_id?: string | null
          created_at?: string
          customer_name?: string
          delivery_amount?: number | null
          discount_amount?: number | null
          id?: string
          invoice_no?: string | null
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
          cycle_end: string | null
          cycle_start: string | null
          id: string
          invoice_no: string | null
          method: string | null
          notes: string | null
          package_id: string | null
          sender_number: string | null
          status: string
          store_id: string
          txn_id: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          cycle_end?: string | null
          cycle_start?: string | null
          id?: string
          invoice_no?: string | null
          method?: string | null
          notes?: string | null
          package_id?: string | null
          sender_number?: string | null
          status?: string
          store_id: string
          txn_id?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          cycle_end?: string | null
          cycle_start?: string | null
          id?: string
          invoice_no?: string | null
          method?: string | null
          notes?: string | null
          package_id?: string | null
          sender_number?: string | null
          status?: string
          store_id?: string
          txn_id?: string | null
          verified_at?: string | null
          verified_by?: string | null
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
      platform_billing_settings: {
        Row: {
          discount_3m: number
          discount_6m: number
          discount_yearly: number
          id: string
          updated_at: string
        }
        Insert: {
          discount_3m?: number
          discount_6m?: number
          discount_yearly?: number
          id?: string
          updated_at?: string
        }
        Update: {
          discount_3m?: number
          discount_6m?: number
          discount_yearly?: number
          id?: string
          updated_at?: string
        }
        Relationships: []
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
      platform_payment_settings: {
        Row: {
          bkash: Json
          id: string
          nagad: Json
          rocket: Json
          sslcommerz: Json
          updated_at: string
        }
        Insert: {
          bkash?: Json
          id?: string
          nagad?: Json
          rocket?: Json
          sslcommerz?: Json
          updated_at?: string
        }
        Update: {
          bkash?: Json
          id?: string
          nagad?: Json
          rocket?: Json
          sslcommerz?: Json
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category_id: string | null
          cost_price: number | null
          created_at: string
          description: string | null
          gallery: Json
          id: string
          low_stock_threshold: number | null
          name: string
          old_price: number | null
          price: number
          primary_image_url: string | null
          return_policy: string | null
          shipping_info: string | null
          sku: string | null
          slug: string
          status: Database["public"]["Enums"]["product_status"]
          stock: number
          store_id: string
          updated_at: string
          warranty: string | null
        }
        Insert: {
          category_id?: string | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          gallery?: Json
          id?: string
          low_stock_threshold?: number | null
          name: string
          old_price?: number | null
          price?: number
          primary_image_url?: string | null
          return_policy?: string | null
          shipping_info?: string | null
          sku?: string | null
          slug: string
          status?: Database["public"]["Enums"]["product_status"]
          stock?: number
          store_id: string
          updated_at?: string
          warranty?: string | null
        }
        Update: {
          category_id?: string | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          gallery?: Json
          id?: string
          low_stock_threshold?: number | null
          name?: string
          old_price?: number | null
          price?: number
          primary_image_url?: string | null
          return_policy?: string | null
          shipping_info?: string | null
          sku?: string | null
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
      returns: {
        Row: {
          created_at: string
          id: string
          order_id: string
          reason: string | null
          refund_amount: number | null
          resolution_note: string | null
          status: Database["public"]["Enums"]["return_status"]
          store_id: string
          type: Database["public"]["Enums"]["return_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          reason?: string | null
          refund_amount?: number | null
          resolution_note?: string | null
          status?: Database["public"]["Enums"]["return_status"]
          store_id: string
          type?: Database["public"]["Enums"]["return_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          reason?: string | null
          refund_amount?: number | null
          resolution_note?: string | null
          status?: Database["public"]["Enums"]["return_status"]
          store_id?: string
          type?: Database["public"]["Enums"]["return_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "returns_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      role_audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_user_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          target_email: string | null
          target_user_id: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_user_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          target_email?: string | null
          target_user_id: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_user_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          target_email?: string | null
          target_user_id?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          delta: number
          id: string
          product_id: string
          reason: string | null
          ref_order_id: string | null
          store_id: string
          type: Database["public"]["Enums"]["stock_movement_type"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delta: number
          id?: string
          product_id: string
          reason?: string | null
          ref_order_id?: string | null
          store_id: string
          type: Database["public"]["Enums"]["stock_movement_type"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delta?: number
          id?: string
          product_id?: string
          reason?: string | null
          ref_order_id?: string | null
          store_id?: string
          type?: Database["public"]["Enums"]["stock_movement_type"]
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_ai_agents: {
        Row: {
          agent_name: string
          created_at: string
          enabled: boolean
          human_like: boolean
          id: string
          knowledge: Json
          language: string
          store_id: string
          style: string
          updated_at: string
          use_emoji: boolean
          welcome_message: string
        }
        Insert: {
          agent_name?: string
          created_at?: string
          enabled?: boolean
          human_like?: boolean
          id?: string
          knowledge?: Json
          language?: string
          store_id: string
          style?: string
          updated_at?: string
          use_emoji?: boolean
          welcome_message?: string
        }
        Update: {
          agent_name?: string
          created_at?: string
          enabled?: boolean
          human_like?: boolean
          id?: string
          knowledge?: Json
          language?: string
          store_id?: string
          style?: string
          updated_at?: string
          use_emoji?: boolean
          welcome_message?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_ai_agents_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
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
          last_renewed_at: string | null
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
          subscription_status: string
          theme: Json
          title_bar_color: string | null
          trial_ends_at: string | null
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
          last_renewed_at?: string | null
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
          subscription_status?: string
          theme?: Json
          title_bar_color?: string | null
          trial_ends_at?: string | null
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
          last_renewed_at?: string | null
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
          subscription_status?: string
          theme?: Json
          title_bar_color?: string | null
          trial_ends_at?: string | null
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
      subscription_notifications: {
        Row: {
          created_at: string
          id: string
          meta: Json
          read_at: string | null
          store_id: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          meta?: Json
          read_at?: string | null
          store_id: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          meta?: Json
          read_at?: string | null
          store_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_notifications_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_packages: {
        Row: {
          billing_cycle: string
          created_at: string
          customer_limit: number | null
          description: string | null
          duration_days: number
          feature_summary: string[] | null
          features: Json
          id: string
          is_active: boolean
          is_trial: boolean
          name: string
          order_limit: number | null
          plan_tier: string | null
          price: number
          product_limit: number
          sort_order: number
          staff_limit: number | null
          storage_mb: number | null
          trial_days: number
        }
        Insert: {
          billing_cycle?: string
          created_at?: string
          customer_limit?: number | null
          description?: string | null
          duration_days?: number
          feature_summary?: string[] | null
          features?: Json
          id?: string
          is_active?: boolean
          is_trial?: boolean
          name: string
          order_limit?: number | null
          plan_tier?: string | null
          price?: number
          product_limit?: number
          sort_order?: number
          staff_limit?: number | null
          storage_mb?: number | null
          trial_days?: number
        }
        Update: {
          billing_cycle?: string
          created_at?: string
          customer_limit?: number | null
          description?: string | null
          duration_days?: number
          feature_summary?: string[] | null
          features?: Json
          id?: string
          is_active?: boolean
          is_trial?: boolean
          name?: string
          order_limit?: number | null
          plan_tier?: string | null
          price?: number
          product_limit?: number
          sort_order?: number
          staff_limit?: number | null
          storage_mb?: number | null
          trial_days?: number
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
      expire_trials: { Args: never; Returns: undefined }
      generate_invoice_no: { Args: { _store_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_store_owner: { Args: { _store_id: string }; Returns: boolean }
      refresh_store_subscription_status: {
        Args: { _store_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "owner" | "user"
      coupon_type: "percent" | "fixed" | "free_shipping"
      expense_category: "fb_ads" | "courier" | "packaging" | "salary" | "misc"
      order_stage:
        | "placed"
        | "confirmed"
        | "packed"
        | "courier_assigned"
        | "shipped"
        | "delivered"
        | "returned"
        | "cancelled"
      order_status:
        | "pending"
        | "confirmed"
        | "processing"
        | "delivered"
        | "cancelled"
      payment_method: "cod" | "bkash" | "nagad" | "rocket" | "bank"
      product_status: "active" | "draft" | "out_of_stock"
      return_status:
        | "requested"
        | "approved"
        | "rejected"
        | "refunded"
        | "completed"
      return_type: "return" | "exchange"
      stock_movement_type:
        | "order"
        | "manual_in"
        | "manual_out"
        | "return"
        | "adjustment"
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
      coupon_type: ["percent", "fixed", "free_shipping"],
      expense_category: ["fb_ads", "courier", "packaging", "salary", "misc"],
      order_stage: [
        "placed",
        "confirmed",
        "packed",
        "courier_assigned",
        "shipped",
        "delivered",
        "returned",
        "cancelled",
      ],
      order_status: [
        "pending",
        "confirmed",
        "processing",
        "delivered",
        "cancelled",
      ],
      payment_method: ["cod", "bkash", "nagad", "rocket", "bank"],
      product_status: ["active", "draft", "out_of_stock"],
      return_status: [
        "requested",
        "approved",
        "rejected",
        "refunded",
        "completed",
      ],
      return_type: ["return", "exchange"],
      stock_movement_type: [
        "order",
        "manual_in",
        "manual_out",
        "return",
        "adjustment",
      ],
      store_status: ["active", "suspended"],
    },
  },
} as const
