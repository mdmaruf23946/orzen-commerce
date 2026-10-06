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
      ad_settings: {
        Row: {
          enabled: boolean
          id: string
          provider: string
          show_on_plans: string[]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled?: boolean
          id?: string
          provider?: string
          show_on_plans?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled?: boolean
          id?: string
          provider?: string
          show_on_plans?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ad_slots: {
        Row: {
          code: string
          created_at: string
          description: string | null
          ends_at: string | null
          format: string
          id: string
          is_active: boolean
          name: string
          provider: string
          slot_key: string
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          code?: string
          created_at?: string
          description?: string | null
          ends_at?: string | null
          format?: string
          id?: string
          is_active?: boolean
          name: string
          provider?: string
          slot_key: string
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          ends_at?: string | null
          format?: string
          id?: string
          is_active?: boolean
          name?: string
          provider?: string
          slot_key?: string
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      admin_notifications: {
        Row: {
          action_label: string | null
          action_target: string | null
          action_type: string | null
          body: string | null
          campaign_id: string | null
          created_at: string
          id: string
          kind: string
          meta: Json
          priority: string | null
          read_at: string | null
          store_id: string | null
          title: string
          type: string | null
          user_id: string | null
        }
        Insert: {
          action_label?: string | null
          action_target?: string | null
          action_type?: string | null
          body?: string | null
          campaign_id?: string | null
          created_at?: string
          id?: string
          kind: string
          meta?: Json
          priority?: string | null
          read_at?: string | null
          store_id?: string | null
          title: string
          type?: string | null
          user_id?: string | null
        }
        Update: {
          action_label?: string | null
          action_target?: string | null
          action_type?: string | null
          body?: string | null
          campaign_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          meta?: Json
          priority?: string | null
          read_at?: string | null
          store_id?: string | null
          title?: string
          type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_notifications_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_read_cursors: {
        Row: {
          feature: string
          last_seen_at: string
          store_id: string
          user_id: string
        }
        Insert: {
          feature: string
          last_seen_at?: string
          store_id: string
          user_id: string
        }
        Update: {
          feature?: string
          last_seen_at?: string
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_read_cursors_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_admin_action_logs: {
        Row: {
          action_key: string
          actor: string | null
          args: Json
          channel: string
          command: string | null
          created_at: string
          id: string
          result: string
          result_detail: string | null
          risk: string
          target_label: string | null
        }
        Insert: {
          action_key: string
          actor?: string | null
          args?: Json
          channel?: string
          command?: string | null
          created_at?: string
          id?: string
          result?: string
          result_detail?: string | null
          risk?: string
          target_label?: string | null
        }
        Update: {
          action_key?: string
          actor?: string | null
          args?: Json
          channel?: string
          command?: string | null
          created_at?: string
          id?: string
          result?: string
          result_detail?: string | null
          risk?: string
          target_label?: string | null
        }
        Relationships: []
      }
      ai_admin_connections: {
        Row: {
          created_at: string
          credentials_enc: string | null
          credentials_hint: string | null
          display_number: string | null
          id: string
          last_error: string | null
          last_verified_at: string | null
          phone_number_id: string | null
          singleton: boolean
          status: string
          updated_at: string
          verify_token: string | null
          waba_id: string | null
        }
        Insert: {
          created_at?: string
          credentials_enc?: string | null
          credentials_hint?: string | null
          display_number?: string | null
          id?: string
          last_error?: string | null
          last_verified_at?: string | null
          phone_number_id?: string | null
          singleton?: boolean
          status?: string
          updated_at?: string
          verify_token?: string | null
          waba_id?: string | null
        }
        Update: {
          created_at?: string
          credentials_enc?: string | null
          credentials_hint?: string | null
          display_number?: string | null
          id?: string
          last_error?: string | null
          last_verified_at?: string | null
          phone_number_id?: string | null
          singleton?: boolean
          status?: string
          updated_at?: string
          verify_token?: string | null
          waba_id?: string | null
        }
        Relationships: []
      }
      ai_admin_customer_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          thread_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          role: string
          thread_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_admin_customer_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "ai_admin_customer_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_admin_customer_threads: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          last_message_at: string
          psid: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          last_message_at?: string
          psid: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          last_message_at?: string
          psid?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_admin_kb_entries: {
        Row: {
          body: string
          category: string
          created_at: string
          id: string
          published: boolean
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          published?: boolean
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          published?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_admin_messages: {
        Row: {
          actions: Json
          channel: string
          content: string
          created_at: string
          id: string
          role: string
          thread_id: string
        }
        Insert: {
          actions?: Json
          channel?: string
          content: string
          created_at?: string
          id?: string
          role: string
          thread_id: string
        }
        Update: {
          actions?: Json
          channel?: string
          content?: string
          created_at?: string
          id?: string
          role?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_admin_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "ai_admin_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_admin_messenger_connections: {
        Row: {
          admin_psids: string[]
          created_at: string
          credentials_enc: string | null
          credentials_hint: string | null
          id: string
          last_error: string | null
          last_verified_at: string | null
          page_id: string | null
          page_name: string | null
          singleton: boolean
          status: string
          updated_at: string
          verify_token: string | null
        }
        Insert: {
          admin_psids?: string[]
          created_at?: string
          credentials_enc?: string | null
          credentials_hint?: string | null
          id?: string
          last_error?: string | null
          last_verified_at?: string | null
          page_id?: string | null
          page_name?: string | null
          singleton?: boolean
          status?: string
          updated_at?: string
          verify_token?: string | null
        }
        Update: {
          admin_psids?: string[]
          created_at?: string
          credentials_enc?: string | null
          credentials_hint?: string | null
          id?: string
          last_error?: string | null
          last_verified_at?: string | null
          page_id?: string | null
          page_name?: string | null
          singleton?: boolean
          status?: string
          updated_at?: string
          verify_token?: string | null
        }
        Relationships: []
      }
      ai_admin_notification_rules: {
        Row: {
          created_at: string
          enabled: boolean
          event_key: string
          id: string
          recipient: string | null
          template: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          event_key: string
          id?: string
          recipient?: string | null
          template?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          event_key?: string
          id?: string
          recipient?: string | null
          template?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_admin_pending_actions: {
        Row: {
          action_key: string
          args: Json
          created_at: string
          expires_at: string
          id: string
          risk: string
          status: string
          summary: string
          thread_id: string | null
          updated_at: string
          wa_id: string | null
        }
        Insert: {
          action_key: string
          args?: Json
          created_at?: string
          expires_at?: string
          id?: string
          risk?: string
          status?: string
          summary: string
          thread_id?: string | null
          updated_at?: string
          wa_id?: string | null
        }
        Update: {
          action_key?: string
          args?: Json
          created_at?: string
          expires_at?: string
          id?: string
          risk?: string
          status?: string
          summary?: string
          thread_id?: string | null
          updated_at?: string
          wa_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_admin_pending_actions_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "ai_admin_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_admin_permissions: {
        Row: {
          action_key: string
          created_at: string
          enabled: boolean
          group_key: string
          id: string
          risk: string
          updated_at: string
        }
        Insert: {
          action_key: string
          created_at?: string
          enabled?: boolean
          group_key: string
          id?: string
          risk?: string
          updated_at?: string
        }
        Update: {
          action_key?: string
          created_at?: string
          enabled?: boolean
          group_key?: string
          id?: string
          risk?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_admin_settings: {
        Row: {
          admin_numbers: string[]
          agent_enabled: boolean
          confirm_high_risk: boolean
          confirm_medium_risk: boolean
          created_at: string
          customer_agent_enabled: boolean
          customer_agent_model: string | null
          daily_digest_enabled: boolean
          daily_digest_hour: number
          id: string
          model: string
          pending_alert_enabled: boolean
          rate_limit_per_minute: number
          reply_language: string
          singleton: boolean
          test_mode: boolean
          updated_at: string
        }
        Insert: {
          admin_numbers?: string[]
          agent_enabled?: boolean
          confirm_high_risk?: boolean
          confirm_medium_risk?: boolean
          created_at?: string
          customer_agent_enabled?: boolean
          customer_agent_model?: string | null
          daily_digest_enabled?: boolean
          daily_digest_hour?: number
          id?: string
          model?: string
          pending_alert_enabled?: boolean
          rate_limit_per_minute?: number
          reply_language?: string
          singleton?: boolean
          test_mode?: boolean
          updated_at?: string
        }
        Update: {
          admin_numbers?: string[]
          agent_enabled?: boolean
          confirm_high_risk?: boolean
          confirm_medium_risk?: boolean
          created_at?: string
          customer_agent_enabled?: boolean
          customer_agent_model?: string | null
          daily_digest_enabled?: boolean
          daily_digest_hour?: number
          id?: string
          model?: string
          pending_alert_enabled?: boolean
          rate_limit_per_minute?: number
          reply_language?: string
          singleton?: boolean
          test_mode?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      ai_admin_support_requests: {
        Row: {
          created_at: string
          customer_name: string | null
          id: string
          psid: string
          reason: string | null
          resolved_at: string | null
          status: string
          summary: string | null
          thread_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          id?: string
          psid: string
          reason?: string | null
          resolved_at?: string | null
          status?: string
          summary?: string | null
          thread_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          id?: string
          psid?: string
          reason?: string | null
          resolved_at?: string | null
          status?: string
          summary?: string | null
          thread_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_admin_support_requests_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "ai_admin_customer_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_admin_threads: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          last_message_at: string
          updated_at: string
          wa_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          last_message_at?: string
          updated_at?: string
          wa_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          last_message_at?: string
          updated_at?: string
          wa_id?: string
        }
        Relationships: []
      }
      ai_admin_webhook_events: {
        Row: {
          created_at: string
          error: string | null
          id: string
          message_id: string | null
          payload: Json
          processed: boolean
          wa_id: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          message_id?: string | null
          payload?: Json
          processed?: boolean
          wa_id?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          message_id?: string | null
          payload?: Json
          processed?: boolean
          wa_id?: string | null
        }
        Relationships: []
      }
      ai_call_agents: {
        Row: {
          created_at: string
          elevenlabs_agent_id: string | null
          gender: string
          id: string
          inbound_enabled: boolean
          instructions: string | null
          is_template: boolean
          knowledge: string | null
          language: string
          last_error: string | null
          name: string
          outbound_enabled: boolean
          personality: string | null
          status: string
          store_id: string | null
          tone_id: string | null
          tool_secret: string | null
          tools: Json
          updated_at: string
          voice_id: string | null
        }
        Insert: {
          created_at?: string
          elevenlabs_agent_id?: string | null
          gender?: string
          id?: string
          inbound_enabled?: boolean
          instructions?: string | null
          is_template?: boolean
          knowledge?: string | null
          language?: string
          last_error?: string | null
          name: string
          outbound_enabled?: boolean
          personality?: string | null
          status?: string
          store_id?: string | null
          tone_id?: string | null
          tool_secret?: string | null
          tools?: Json
          updated_at?: string
          voice_id?: string | null
        }
        Update: {
          created_at?: string
          elevenlabs_agent_id?: string | null
          gender?: string
          id?: string
          inbound_enabled?: boolean
          instructions?: string | null
          is_template?: boolean
          knowledge?: string | null
          language?: string
          last_error?: string | null
          name?: string
          outbound_enabled?: boolean
          personality?: string | null
          status?: string
          store_id?: string | null
          tone_id?: string | null
          tool_secret?: string | null
          tools?: Json
          updated_at?: string
          voice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_call_agents_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_call_agents_tone_id_fkey"
            columns: ["tone_id"]
            isOneToOne: false
            referencedRelation: "ai_call_tones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_call_agents_voice_id_fkey"
            columns: ["voice_id"]
            isOneToOne: false
            referencedRelation: "ai_call_voices"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_call_config: {
        Row: {
          behavior: Json
          business: Json
          calling_region: string
          created_at: string
          default_agent_id: string | null
          default_caller_id: string | null
          default_gender: string
          default_instructions: string | null
          default_language: string
          default_tone_id: string | null
          default_voice_id: string | null
          elevenlabs_credentials: string | null
          elevenlabs_last_error: string | null
          elevenlabs_preview: string | null
          elevenlabs_status: string
          id: string
          rules: Json
          tools: Json
          twilio_credentials: string | null
          twilio_last_error: string | null
          twilio_preview: string | null
          twilio_status: string
          updated_at: string
        }
        Insert: {
          behavior?: Json
          business?: Json
          calling_region?: string
          created_at?: string
          default_agent_id?: string | null
          default_caller_id?: string | null
          default_gender?: string
          default_instructions?: string | null
          default_language?: string
          default_tone_id?: string | null
          default_voice_id?: string | null
          elevenlabs_credentials?: string | null
          elevenlabs_last_error?: string | null
          elevenlabs_preview?: string | null
          elevenlabs_status?: string
          id?: string
          rules?: Json
          tools?: Json
          twilio_credentials?: string | null
          twilio_last_error?: string | null
          twilio_preview?: string | null
          twilio_status?: string
          updated_at?: string
        }
        Update: {
          behavior?: Json
          business?: Json
          calling_region?: string
          created_at?: string
          default_agent_id?: string | null
          default_caller_id?: string | null
          default_gender?: string
          default_instructions?: string | null
          default_language?: string
          default_tone_id?: string | null
          default_voice_id?: string | null
          elevenlabs_credentials?: string | null
          elevenlabs_last_error?: string | null
          elevenlabs_preview?: string | null
          elevenlabs_status?: string
          id?: string
          rules?: Json
          tools?: Json
          twilio_credentials?: string | null
          twilio_last_error?: string | null
          twilio_preview?: string | null
          twilio_status?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_call_queue: {
        Row: {
          attempts: number
          created_at: string
          customer_name: string | null
          id: string
          last_error: string | null
          order_id: string | null
          phone: string
          purpose: string
          run_after: string
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          customer_name?: string | null
          id?: string
          last_error?: string | null
          order_id?: string | null
          phone: string
          purpose?: string
          run_after?: string
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          customer_name?: string | null
          id?: string
          last_error?: string | null
          order_id?: string | null
          phone?: string
          purpose?: string
          run_after?: string
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_call_queue_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_call_queue_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_call_tones: {
        Row: {
          created_at: string
          description: string | null
          id: string
          instructions: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          instructions?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          instructions?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      ai_call_transcripts: {
        Row: {
          call_id: string
          created_at: string
          id: string
          message: string
          role: string
          seq: number
          store_id: string
        }
        Insert: {
          call_id: string
          created_at?: string
          id?: string
          message: string
          role: string
          seq?: number
          store_id: string
        }
        Update: {
          call_id?: string
          created_at?: string
          id?: string
          message?: string
          role?: string
          seq?: number
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_call_transcripts_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "ai_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_call_transcripts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_call_voices: {
        Row: {
          accent: string | null
          created_at: string
          description: string | null
          elevenlabs_voice_id: string
          gender: string
          id: string
          is_active: boolean
          language: string
          name: string
          preview_url: string | null
          sort_order: number
          speed: number
          tone: string | null
          updated_at: string
        }
        Insert: {
          accent?: string | null
          created_at?: string
          description?: string | null
          elevenlabs_voice_id: string
          gender?: string
          id?: string
          is_active?: boolean
          language?: string
          name: string
          preview_url?: string | null
          sort_order?: number
          speed?: number
          tone?: string | null
          updated_at?: string
        }
        Update: {
          accent?: string | null
          created_at?: string
          description?: string | null
          elevenlabs_voice_id?: string
          gender?: string
          id?: string
          is_active?: boolean
          language?: string
          name?: string
          preview_url?: string | null
          sort_order?: number
          speed?: number
          tone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ai_calls: {
        Row: {
          agent_id: string | null
          attempt: number
          conversation_id: string | null
          cost: number
          created_at: string
          customer_id: string | null
          customer_name: string | null
          direction: string
          duration_sec: number
          ended_at: string | null
          id: string
          order_id: string | null
          phone: string
          phone_number_id: string | null
          provider_call_sid: string | null
          recording_url: string | null
          result: string | null
          started_at: string | null
          status: string
          store_id: string
          summary: string | null
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          attempt?: number
          conversation_id?: string | null
          cost?: number
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          direction?: string
          duration_sec?: number
          ended_at?: string | null
          id?: string
          order_id?: string | null
          phone: string
          phone_number_id?: string | null
          provider_call_sid?: string | null
          recording_url?: string | null
          result?: string | null
          started_at?: string | null
          status?: string
          store_id: string
          summary?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          attempt?: number
          conversation_id?: string | null
          cost?: number
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          direction?: string
          duration_sec?: number
          ended_at?: string | null
          id?: string
          order_id?: string | null
          phone?: string
          phone_number_id?: string | null
          provider_call_sid?: string | null
          recording_url?: string | null
          result?: string | null
          started_at?: string | null
          status?: string
          store_id?: string
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_calls_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_call_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_calls_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_calls_phone_number_id_fkey"
            columns: ["phone_number_id"]
            isOneToOne: false
            referencedRelation: "ai_phone_numbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_calls_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          address: string | null
          channel: string
          created_at: string
          customer_name: string | null
          external_id: string | null
          first_contact_at: string
          handoff_at: string | null
          handoff_mode: string
          handoff_reason: string | null
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          last_read_at: string | null
          lead_status: string | null
          phone: string | null
          psid_profile: Json
          status: string
          store_id: string
          tags: string[]
          total_orders: number
          total_spent: number
          unread_count: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          channel?: string
          created_at?: string
          customer_name?: string | null
          external_id?: string | null
          first_contact_at?: string
          handoff_at?: string | null
          handoff_mode?: string
          handoff_reason?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          last_read_at?: string | null
          lead_status?: string | null
          phone?: string | null
          psid_profile?: Json
          status?: string
          store_id: string
          tags?: string[]
          total_orders?: number
          total_spent?: number
          unread_count?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          channel?: string
          created_at?: string
          customer_name?: string | null
          external_id?: string | null
          first_contact_at?: string
          handoff_at?: string | null
          handoff_mode?: string
          handoff_reason?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          last_read_at?: string | null
          lead_status?: string | null
          phone?: string | null
          psid_profile?: Json
          status?: string
          store_id?: string
          tags?: string[]
          total_orders?: number
          total_spent?: number
          unread_count?: number
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
          brand_voice: string | null
          created_at: string
          default_model: string
          enabled: boolean
          fallback_model: string | null
          gemini_api_key: string | null
          gemini_api_keys: Json
          global_system_prompt: string | null
          id: number
          max_tokens: number | null
          openai_api_key: string | null
          provider_api_key: string | null
          safety_rules: string | null
          supported_languages: string[] | null
          temperature: number | null
          updated_at: string
        }
        Insert: {
          brand_voice?: string | null
          created_at?: string
          default_model?: string
          enabled?: boolean
          fallback_model?: string | null
          gemini_api_key?: string | null
          gemini_api_keys?: Json
          global_system_prompt?: string | null
          id?: number
          max_tokens?: number | null
          openai_api_key?: string | null
          provider_api_key?: string | null
          safety_rules?: string | null
          supported_languages?: string[] | null
          temperature?: number | null
          updated_at?: string
        }
        Update: {
          brand_voice?: string | null
          created_at?: string
          default_model?: string
          enabled?: boolean
          fallback_model?: string | null
          gemini_api_key?: string | null
          gemini_api_keys?: Json
          global_system_prompt?: string | null
          id?: number
          max_tokens?: number | null
          openai_api_key?: string | null
          provider_api_key?: string | null
          safety_rules?: string | null
          supported_languages?: string[] | null
          temperature?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      ai_key_quota: {
        Row: {
          checked_at: string
          key_id: string
          limit_tokens: number | null
          remaining_tokens: number | null
          reset_at: string | null
          source: string
          unit: string
        }
        Insert: {
          checked_at?: string
          key_id: string
          limit_tokens?: number | null
          remaining_tokens?: number | null
          reset_at?: string | null
          source?: string
          unit?: string
        }
        Update: {
          checked_at?: string
          key_id?: string
          limit_tokens?: number | null
          remaining_tokens?: number | null
          reset_at?: string | null
          source?: string
          unit?: string
        }
        Relationships: []
      }
      ai_key_usage: {
        Row: {
          completion_tokens: number
          created_at: string
          id: string
          key_id: string
          model: string
          ok: boolean
          prompt_tokens: number
          provider: string
        }
        Insert: {
          completion_tokens?: number
          created_at?: string
          id?: string
          key_id: string
          model?: string
          ok?: boolean
          prompt_tokens?: number
          provider?: string
        }
        Update: {
          completion_tokens?: number
          created_at?: string
          id?: string
          key_id?: string
          model?: string
          ok?: boolean
          prompt_tokens?: number
          provider?: string
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          attachments: Json
          content: string
          conversation_id: string
          created_at: string
          delivery_status: string
          direction: string
          error: string | null
          id: string
          message_type: string
          mid: string | null
          role: string
          sent_by_user_id: string | null
        }
        Insert: {
          attachments?: Json
          content: string
          conversation_id: string
          created_at?: string
          delivery_status?: string
          direction?: string
          error?: string | null
          id?: string
          message_type?: string
          mid?: string | null
          role: string
          sent_by_user_id?: string | null
        }
        Update: {
          attachments?: Json
          content?: string
          conversation_id?: string
          created_at?: string
          delivery_status?: string
          direction?: string
          error?: string | null
          id?: string
          message_type?: string
          mid?: string | null
          role?: string
          sent_by_user_id?: string | null
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
      ai_phone_numbers: {
        Row: {
          agent_id: string | null
          available_to_store: boolean
          calls_count: number
          country: string
          created_at: string
          elevenlabs_phone_id: string | null
          id: string
          inbound_enabled: boolean
          label: string | null
          minutes_used: number
          outbound_enabled: boolean
          phone_number: string
          provider: string
          provider_sid: string | null
          status: string
          store_id: string | null
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          available_to_store?: boolean
          calls_count?: number
          country?: string
          created_at?: string
          elevenlabs_phone_id?: string | null
          id?: string
          inbound_enabled?: boolean
          label?: string | null
          minutes_used?: number
          outbound_enabled?: boolean
          phone_number: string
          provider?: string
          provider_sid?: string | null
          status?: string
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          available_to_store?: boolean
          calls_count?: number
          country?: string
          created_at?: string
          elevenlabs_phone_id?: string | null
          id?: string
          inbound_enabled?: boolean
          label?: string | null
          minutes_used?: number
          outbound_enabled?: boolean
          phone_number?: string
          provider?: string
          provider_sid?: string | null
          status?: string
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_phone_numbers_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_call_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_phone_numbers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_product_blacklist: {
        Row: {
          created_at: string
          id: string
          product_id: string
          reason: string | null
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          reason?: string | null
          store_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          reason?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_product_blacklist_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_product_blacklist_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "storefront_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_product_blacklist_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_product_catalog: {
        Row: {
          brand: string | null
          category_id: string | null
          created_at: string
          delivery_charge: number | null
          delivery_time_days: string | null
          description: string | null
          features: Json
          gallery: Json
          is_featured: boolean
          low_stock_threshold: number
          meta: Json
          name: string
          old_price: number | null
          price: number
          primary_image_url: string | null
          product_code: string | null
          product_id: string
          product_type: string
          rating: number | null
          related_product_ids: string[]
          return_policy: string | null
          search_text: string
          shipping_info: string | null
          short_description: string | null
          sku: string | null
          slug: string | null
          source_created_at: string
          source_updated_at: string
          specifications: Json
          status: Database["public"]["Enums"]["product_status"]
          stock: number
          store_id: string
          total_sold: number
          updated_at: string
          variants: Json
          video_url: string | null
          warranty: string | null
        }
        Insert: {
          brand?: string | null
          category_id?: string | null
          created_at?: string
          delivery_charge?: number | null
          delivery_time_days?: string | null
          description?: string | null
          features?: Json
          gallery?: Json
          is_featured?: boolean
          low_stock_threshold?: number
          meta?: Json
          name: string
          old_price?: number | null
          price?: number
          primary_image_url?: string | null
          product_code?: string | null
          product_id: string
          product_type?: string
          rating?: number | null
          related_product_ids?: string[]
          return_policy?: string | null
          search_text?: string
          shipping_info?: string | null
          short_description?: string | null
          sku?: string | null
          slug?: string | null
          source_created_at?: string
          source_updated_at: string
          specifications?: Json
          status: Database["public"]["Enums"]["product_status"]
          stock?: number
          store_id: string
          total_sold?: number
          updated_at?: string
          variants?: Json
          video_url?: string | null
          warranty?: string | null
        }
        Update: {
          brand?: string | null
          category_id?: string | null
          created_at?: string
          delivery_charge?: number | null
          delivery_time_days?: string | null
          description?: string | null
          features?: Json
          gallery?: Json
          is_featured?: boolean
          low_stock_threshold?: number
          meta?: Json
          name?: string
          old_price?: number | null
          price?: number
          primary_image_url?: string | null
          product_code?: string | null
          product_id?: string
          product_type?: string
          rating?: number | null
          related_product_ids?: string[]
          return_policy?: string | null
          search_text?: string
          shipping_info?: string | null
          short_description?: string | null
          sku?: string | null
          slug?: string | null
          source_created_at?: string
          source_updated_at?: string
          specifications?: Json
          status?: Database["public"]["Enums"]["product_status"]
          stock?: number
          store_id?: string
          total_sold?: number
          updated_at?: string
          variants?: Json
          video_url?: string | null
          warranty?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_product_catalog_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_product_catalog_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "storefront_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_product_catalog_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_product_recommendations: {
        Row: {
          context: string | null
          conversation_id: string | null
          created_at: string
          id: string
          product_id: string | null
          store_id: string
          tool_name: string
        }
        Insert: {
          context?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          product_id?: string | null
          store_id: string
          tool_name: string
        }
        Update: {
          context?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          product_id?: string | null
          store_id?: string
          tool_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_product_recommendations_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_product_recommendations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_product_recommendations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "storefront_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_product_recommendations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
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
      announcements: {
        Row: {
          audience: string
          body: string
          created_at: string
          created_by: string | null
          id: string
          published_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          audience?: string
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          key_hash: string
          last_used_at: string | null
          name: string
          prefix: string
          revoked_at: string | null
          scopes: string[]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash: string
          last_used_at?: string | null
          name: string
          prefix: string
          revoked_at?: string | null
          scopes?: string[]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash?: string
          last_used_at?: string | null
          name?: string
          prefix?: string
          revoked_at?: string | null
          scopes?: string[]
        }
        Relationships: []
      }
      banners: {
        Row: {
          campaign_type: string
          category_id: string | null
          created_at: string
          display_position: string
          id: string
          image_url: string
          is_active: boolean
          link: string | null
          position: number
          product_type: string
          sort_order: number
          store_id: string
          title: string
          updated_at: string
        }
        Insert: {
          campaign_type?: string
          category_id?: string | null
          created_at?: string
          display_position?: string
          id?: string
          image_url: string
          is_active?: boolean
          link?: string | null
          position?: number
          product_type?: string
          sort_order?: number
          store_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          campaign_type?: string
          category_id?: string | null
          created_at?: string
          display_position?: string
          id?: string
          image_url?: string
          is_active?: boolean
          link?: string | null
          position?: number
          product_type?: string
          sort_order?: number
          store_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "banners_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banners_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      call_provider_settings: {
        Row: {
          caller_id: string | null
          created_at: string
          credentials_encrypted: string | null
          credentials_preview: string | null
          id: string
          is_active: boolean
          last_error: string | null
          provider: string
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          caller_id?: string | null
          created_at?: string
          credentials_encrypted?: string | null
          credentials_preview?: string | null
          id?: string
          is_active?: boolean
          last_error?: string | null
          provider?: string
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          caller_id?: string | null
          created_at?: string
          credentials_encrypted?: string | null
          credentials_preview?: string | null
          id?: string
          is_active?: boolean
          last_error?: string | null
          provider?: string
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_provider_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          agent_email: string | null
          agent_id: string | null
          answered_at: string | null
          call_type: string
          connection_id: string | null
          created_at: string
          customer_id: string | null
          customer_name: string | null
          direction: string
          dtmf: string | null
          duration_sec: number
          ended_at: string | null
          id: string
          note: string | null
          order_id: string | null
          phone: string
          provider: string
          provider_call_sid: string | null
          recording_ref: string | null
          result: string | null
          retry_count: number
          started_at: string
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          agent_email?: string | null
          agent_id?: string | null
          answered_at?: string | null
          call_type?: string
          connection_id?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          direction?: string
          dtmf?: string | null
          duration_sec?: number
          ended_at?: string | null
          id?: string
          note?: string | null
          order_id?: string | null
          phone: string
          provider?: string
          provider_call_sid?: string | null
          recording_ref?: string | null
          result?: string | null
          retry_count?: number
          started_at?: string
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          agent_email?: string | null
          agent_id?: string | null
          answered_at?: string | null
          call_type?: string
          connection_id?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          direction?: string
          dtmf?: string | null
          duration_sec?: number
          ended_at?: string | null
          id?: string
          note?: string | null
          order_id?: string | null
          phone?: string
          provider?: string
          provider_call_sid?: string | null
          recording_ref?: string | null
          result?: string | null
          retry_count?: number
          started_at?: string
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calls_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "store_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_store_id_fkey"
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
          description: string | null
          icon_name: string | null
          icon_style: string
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          parent_id: string | null
          product_type: string
          sort_order: number
          store_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon_name?: string | null
          icon_style?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          parent_id?: string | null
          product_type?: string
          sort_order?: number
          store_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon_name?: string | null
          icon_style?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          parent_id?: string | null
          product_type?: string
          sort_order?: number
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_requests: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          phone: string | null
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          phone?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          phone?: string | null
          status?: string
        }
        Relationships: []
      }
      conversational_checkout_sessions: {
        Row: {
          channel: string
          conversation_id: string | null
          created_at: string
          expires_at: string
          external_customer_id: string
          id: string
          order_id: string | null
          product_id: string
          quantity: number
          store_id: string
          token_hash: string
          updated_at: string
          used_at: string | null
        }
        Insert: {
          channel: string
          conversation_id?: string | null
          created_at?: string
          expires_at: string
          external_customer_id: string
          id?: string
          order_id?: string | null
          product_id: string
          quantity?: number
          store_id: string
          token_hash: string
          updated_at?: string
          used_at?: string | null
        }
        Update: {
          channel?: string
          conversation_id?: string | null
          created_at?: string
          expires_at?: string
          external_customer_id?: string
          id?: string
          order_id?: string | null
          product_id?: string
          quantity?: number
          store_id?: string
          token_hash?: string
          updated_at?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversational_checkout_sessions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversational_checkout_sessions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversational_checkout_sessions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversational_checkout_sessions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "storefront_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversational_checkout_sessions_store_id_fkey"
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
          category_ids: string[]
          code: string
          created_at: string
          expires_at: string | null
          id: string
          max_discount: number | null
          min_order: number
          name: string | null
          per_customer_limit: number | null
          product_ids: string[]
          product_type: string
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
          category_ids?: string[]
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          max_discount?: number | null
          min_order?: number
          name?: string | null
          per_customer_limit?: number | null
          product_ids?: string[]
          product_type?: string
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
          category_ids?: string[]
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          max_discount?: number | null
          min_order?: number
          name?: string | null
          per_customer_limit?: number | null
          product_ids?: string[]
          product_type?: string
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
      courier_api_logs: {
        Row: {
          action: string
          courier_key: string
          created_at: string
          duration_ms: number | null
          endpoint: string | null
          error: string | null
          http_status: number | null
          id: string
          method: string | null
          ok: boolean
          parcel_id: string | null
          request: Json | null
          response: Json | null
          store_id: string
        }
        Insert: {
          action: string
          courier_key: string
          created_at?: string
          duration_ms?: number | null
          endpoint?: string | null
          error?: string | null
          http_status?: number | null
          id?: string
          method?: string | null
          ok?: boolean
          parcel_id?: string | null
          request?: Json | null
          response?: Json | null
          store_id: string
        }
        Update: {
          action?: string
          courier_key?: string
          created_at?: string
          duration_ms?: number | null
          endpoint?: string | null
          error?: string | null
          http_status?: number | null
          id?: string
          method?: string | null
          ok?: boolean
          parcel_id?: string | null
          request?: Json | null
          response?: Json | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "courier_api_logs_parcel_id_fkey"
            columns: ["parcel_id"]
            isOneToOne: false
            referencedRelation: "courier_parcels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_api_logs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_parcel_events: {
        Row: {
          created_at: string
          id: string
          message: string | null
          parcel_id: string
          raw: Json | null
          source: string
          status: string
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          parcel_id: string
          raw?: Json | null
          source?: string
          status: string
          store_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          parcel_id?: string
          raw?: Json | null
          source?: string
          status?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "courier_parcel_events_parcel_id_fkey"
            columns: ["parcel_id"]
            isOneToOne: false
            referencedRelation: "courier_parcels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_parcel_events_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_parcels: {
        Row: {
          cod_amount: number
          collection_status: string
          consignment_id: string | null
          courier_key: string
          created_at: string
          delivery_charge: number
          dimensions: string | null
          id: string
          item_count: number
          items: Json
          last_error: string | null
          last_synced_at: string | null
          note: string | null
          order_id: string | null
          recipient_address: string | null
          recipient_area: string | null
          recipient_city: string | null
          recipient_name: string | null
          recipient_phone: string | null
          recipient_zone: string | null
          request_payload: Json | null
          response_payload: Json | null
          return_charge: number
          status: string
          store_id: string
          tracking_code: string | null
          tracking_url: string | null
          updated_at: string
          weight: number | null
        }
        Insert: {
          cod_amount?: number
          collection_status?: string
          consignment_id?: string | null
          courier_key: string
          created_at?: string
          delivery_charge?: number
          dimensions?: string | null
          id?: string
          item_count?: number
          items?: Json
          last_error?: string | null
          last_synced_at?: string | null
          note?: string | null
          order_id?: string | null
          recipient_address?: string | null
          recipient_area?: string | null
          recipient_city?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          recipient_zone?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
          return_charge?: number
          status?: string
          store_id: string
          tracking_code?: string | null
          tracking_url?: string | null
          updated_at?: string
          weight?: number | null
        }
        Update: {
          cod_amount?: number
          collection_status?: string
          consignment_id?: string | null
          courier_key?: string
          created_at?: string
          delivery_charge?: number
          dimensions?: string | null
          id?: string
          item_count?: number
          items?: Json
          last_error?: string | null
          last_synced_at?: string | null
          note?: string | null
          order_id?: string | null
          recipient_address?: string | null
          recipient_area?: string | null
          recipient_city?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          recipient_zone?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
          return_charge?: number
          status?: string
          store_id?: string
          tracking_code?: string | null
          tracking_url?: string | null
          updated_at?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "courier_parcels_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_parcels_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_pickup_requests: {
        Row: {
          address: string | null
          contact_name: string | null
          courier_key: string
          created_at: string
          id: string
          note: string | null
          parcel_count: number
          phone: string | null
          pickup_date: string | null
          response: Json | null
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_name?: string | null
          courier_key: string
          created_at?: string
          id?: string
          note?: string | null
          parcel_count?: number
          phone?: string | null
          pickup_date?: string | null
          response?: Json | null
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_name?: string | null
          courier_key?: string
          created_at?: string
          id?: string
          note?: string | null
          parcel_count?: number
          phone?: string | null
          pickup_date?: string | null
          response?: Json | null
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courier_pickup_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_providers: {
        Row: {
          api_key: string | null
          base_url: string | null
          brand_color: string | null
          code: string
          config: Json
          created_at: string
          dark_logo_url: string | null
          description: string | null
          docs_url: string | null
          favicon_url: string | null
          icon_bg_color: string | null
          id: string
          is_active: boolean
          is_default: boolean
          logo_url: string | null
          name: string
          secondary_color: string | null
          sort_order: number
          support_url: string | null
          updated_at: string
          website_url: string | null
          wordmark_url: string | null
        }
        Insert: {
          api_key?: string | null
          base_url?: string | null
          brand_color?: string | null
          code: string
          config?: Json
          created_at?: string
          dark_logo_url?: string | null
          description?: string | null
          docs_url?: string | null
          favicon_url?: string | null
          icon_bg_color?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          logo_url?: string | null
          name: string
          secondary_color?: string | null
          sort_order?: number
          support_url?: string | null
          updated_at?: string
          website_url?: string | null
          wordmark_url?: string | null
        }
        Update: {
          api_key?: string | null
          base_url?: string | null
          brand_color?: string | null
          code?: string
          config?: Json
          created_at?: string
          dark_logo_url?: string | null
          description?: string | null
          docs_url?: string | null
          favicon_url?: string | null
          icon_bg_color?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          logo_url?: string | null
          name?: string
          secondary_color?: string | null
          sort_order?: number
          support_url?: string | null
          updated_at?: string
          website_url?: string | null
          wordmark_url?: string | null
        }
        Relationships: []
      }
      custom_payment_gateway_audit: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          gateway_id: string | null
          id: string
          meta: Json
          store_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          gateway_id?: string | null
          id?: string
          meta?: Json
          store_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          gateway_id?: string | null
          id?: string
          meta?: Json
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_payment_gateway_audit_gateway_id_fkey"
            columns: ["gateway_id"]
            isOneToOne: false
            referencedRelation: "custom_payment_gateways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_payment_gateway_audit_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_payment_gateway_events: {
        Row: {
          created_at: string
          error_message: string | null
          event_id: string | null
          event_type: string | null
          gateway_id: string
          headers: Json | null
          id: string
          normalized_status: string | null
          payload: Json | null
          processed_at: string | null
          processing_status: string
          provider_ref: string | null
          signature_valid: boolean | null
          store_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_id?: string | null
          event_type?: string | null
          gateway_id: string
          headers?: Json | null
          id?: string
          normalized_status?: string | null
          payload?: Json | null
          processed_at?: string | null
          processing_status?: string
          provider_ref?: string | null
          signature_valid?: boolean | null
          store_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_id?: string | null
          event_type?: string | null
          gateway_id?: string
          headers?: Json | null
          id?: string
          normalized_status?: string | null
          payload?: Json | null
          processed_at?: string | null
          processing_status?: string
          provider_ref?: string | null
          signature_valid?: boolean | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_payment_gateway_events_gateway_id_fkey"
            columns: ["gateway_id"]
            isOneToOne: false
            referencedRelation: "custom_payment_gateways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_payment_gateway_events_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_payment_gateways: {
        Row: {
          api_base_url: string | null
          auth_type: string
          config: Json
          created_at: string
          credentials_ciphertext: string | null
          credentials_preview: string | null
          currencies: string[]
          currency: string
          description: string | null
          docs_url: string | null
          environment: string
          id: string
          is_active: boolean
          is_default: boolean
          last_test_result: Json | null
          last_tested_at: string | null
          logo_url: string | null
          name: string
          sandbox_base_url: string | null
          slug: string
          status: string
          store_id: string
          support_email: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          api_base_url?: string | null
          auth_type?: string
          config?: Json
          created_at?: string
          credentials_ciphertext?: string | null
          credentials_preview?: string | null
          currencies?: string[]
          currency?: string
          description?: string | null
          docs_url?: string | null
          environment?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          last_test_result?: Json | null
          last_tested_at?: string | null
          logo_url?: string | null
          name: string
          sandbox_base_url?: string | null
          slug: string
          status?: string
          store_id: string
          support_email?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          api_base_url?: string | null
          auth_type?: string
          config?: Json
          created_at?: string
          credentials_ciphertext?: string | null
          credentials_preview?: string | null
          currencies?: string[]
          currency?: string
          description?: string | null
          docs_url?: string | null
          environment?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          last_test_result?: Json | null
          last_tested_at?: string | null
          logo_url?: string | null
          name?: string
          sandbox_base_url?: string | null
          slug?: string
          status?: string
          store_id?: string
          support_email?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_payment_gateways_store_id_fkey"
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
      delivery_zones: {
        Row: {
          charge: number
          courier_code: string | null
          courier_config: Json
          created_at: string
          eta: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          sort_order: number
          store_id: string
          updated_at: string
        }
        Insert: {
          charge?: number
          courier_code?: string | null
          courier_config?: Json
          created_at?: string
          eta?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          sort_order?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          charge?: number
          courier_code?: string | null
          courier_config?: Json
          created_at?: string
          eta?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          sort_order?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_zones_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      digital_access_events: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          detail: Json
          entitlement_id: string | null
          id: string
          order_id: string | null
          store_id: string
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          detail?: Json
          entitlement_id?: string | null
          id?: string
          order_id?: string | null
          store_id: string
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          detail?: Json
          entitlement_id?: string | null
          id?: string
          order_id?: string | null
          store_id?: string
        }
        Relationships: []
      }
      digital_downloads: {
        Row: {
          created_at: string
          device_id: string | null
          entitlement_id: string
          file_path: string | null
          id: string
          ip: string | null
          store_id: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          entitlement_id: string
          file_path?: string | null
          id?: string
          ip?: string | null
          store_id: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          device_id?: string | null
          entitlement_id?: string
          file_path?: string | null
          id?: string
          ip?: string | null
          store_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "digital_downloads_entitlement_id_fkey"
            columns: ["entitlement_id"]
            isOneToOne: false
            referencedRelation: "digital_entitlements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_downloads_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      digital_entitlements: {
        Row: {
          access_token: string
          created_at: string
          customer_email: string | null
          customer_id: string | null
          customer_phone: string | null
          download_count: number
          expires_at: string | null
          id: string
          license_id: string | null
          max_devices: number | null
          max_downloads: number | null
          max_ips: number | null
          order_id: string
          product_id: string
          status: string
          store_id: string
          updated_at: string
          version: string | null
        }
        Insert: {
          access_token?: string
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_phone?: string | null
          download_count?: number
          expires_at?: string | null
          id?: string
          license_id?: string | null
          max_devices?: number | null
          max_downloads?: number | null
          max_ips?: number | null
          order_id: string
          product_id: string
          status?: string
          store_id: string
          updated_at?: string
          version?: string | null
        }
        Update: {
          access_token?: string
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_phone?: string | null
          download_count?: number
          expires_at?: string | null
          id?: string
          license_id?: string | null
          max_devices?: number | null
          max_downloads?: number | null
          max_ips?: number | null
          order_id?: string
          product_id?: string
          status?: string
          store_id?: string
          updated_at?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "digital_entitlements_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "store_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_entitlements_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "digital_licenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_entitlements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_entitlements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_entitlements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "storefront_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_entitlements_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      digital_licenses: {
        Row: {
          activation_count: number
          created_at: string
          id: string
          license_key: string
          license_type: string
          max_activations: number | null
          order_id: string | null
          product_id: string
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          activation_count?: number
          created_at?: string
          id?: string
          license_key: string
          license_type?: string
          max_activations?: number | null
          order_id?: string | null
          product_id: string
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          activation_count?: number
          created_at?: string
          id?: string
          license_key?: string
          license_type?: string
          max_activations?: number | null
          order_id?: string | null
          product_id?: string
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "digital_licenses_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_licenses_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_licenses_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "storefront_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_licenses_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          attempts: number
          created_at: string
          html: string
          id: string
          last_error: string | null
          payload: Json
          related_payment_id: string | null
          sent_at: string | null
          status: string
          subject: string
          template: string
          to_email: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          html: string
          id?: string
          last_error?: string | null
          payload?: Json
          related_payment_id?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          template: string
          to_email: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          html?: string
          id?: string
          last_error?: string | null
          payload?: Json
          related_payment_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          template?: string
          to_email?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_related_payment_id_fkey"
            columns: ["related_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
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
      facebook_ai_settings: {
        Row: {
          allow_keywords: string[]
          auto_delete_abusive: boolean
          auto_hide_spam: boolean
          auto_reply_safe: boolean
          created_at: string
          custom_instructions: string | null
          deny_keywords: string[]
          enabled: boolean
          id: string
          language: string
          mode: string
          store_id: string
          suggest_messenger_handoff: boolean
          tone: string
          updated_at: string
        }
        Insert: {
          allow_keywords?: string[]
          auto_delete_abusive?: boolean
          auto_hide_spam?: boolean
          auto_reply_safe?: boolean
          created_at?: string
          custom_instructions?: string | null
          deny_keywords?: string[]
          enabled?: boolean
          id?: string
          language?: string
          mode?: string
          store_id: string
          suggest_messenger_handoff?: boolean
          tone?: string
          updated_at?: string
        }
        Update: {
          allow_keywords?: string[]
          auto_delete_abusive?: boolean
          auto_hide_spam?: boolean
          auto_reply_safe?: boolean
          created_at?: string
          custom_instructions?: string | null
          deny_keywords?: string[]
          enabled?: boolean
          id?: string
          language?: string
          mode?: string
          store_id?: string
          suggest_messenger_handoff?: boolean
          tone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facebook_ai_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      facebook_comments: {
        Row: {
          ai_category: string | null
          ai_status: string
          ai_suggestion: string | null
          author_id: string | null
          author_name: string | null
          comment_created_at: string | null
          comment_id: string
          created_at: string
          hidden: boolean
          id: string
          message: string | null
          post_excerpt: string | null
          post_id: string | null
          replied: boolean
          store_id: string
          updated_at: string
        }
        Insert: {
          ai_category?: string | null
          ai_status?: string
          ai_suggestion?: string | null
          author_id?: string | null
          author_name?: string | null
          comment_created_at?: string | null
          comment_id: string
          created_at?: string
          hidden?: boolean
          id?: string
          message?: string | null
          post_excerpt?: string | null
          post_id?: string | null
          replied?: boolean
          store_id: string
          updated_at?: string
        }
        Update: {
          ai_category?: string | null
          ai_status?: string
          ai_suggestion?: string | null
          author_id?: string | null
          author_name?: string | null
          comment_created_at?: string | null
          comment_id?: string
          created_at?: string
          hidden?: boolean
          id?: string
          message?: string | null
          post_excerpt?: string | null
          post_id?: string | null
          replied?: boolean
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facebook_comments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      facebook_moderation_queue: {
        Row: {
          action: string
          author_id: string | null
          author_name: string | null
          category: string | null
          comment_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          error: string | null
          id: string
          message: string | null
          reason: string | null
          status: string
          store_id: string
          suggestion: string | null
          updated_at: string
        }
        Insert: {
          action: string
          author_id?: string | null
          author_name?: string | null
          category?: string | null
          comment_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          error?: string | null
          id?: string
          message?: string | null
          reason?: string | null
          status?: string
          store_id: string
          suggestion?: string | null
          updated_at?: string
        }
        Update: {
          action?: string
          author_id?: string | null
          author_name?: string | null
          category?: string | null
          comment_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          error?: string | null
          id?: string
          message?: string | null
          reason?: string | null
          status?: string
          store_id?: string
          suggestion?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facebook_moderation_queue_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      facebook_page_integrations: {
        Row: {
          app_id: string | null
          app_secret_encrypted: string | null
          connected_at: string | null
          created_at: string
          id: string
          last_error: string | null
          last_verified_at: string | null
          last_webhook_at: string | null
          manual_token: boolean
          page_access_token_encrypted: string | null
          page_id: string | null
          page_name: string | null
          page_picture_url: string | null
          permissions: Json
          permissions_checked_at: string | null
          permissions_verified: Json
          status: string
          store_id: string
          token_expires_at: string | null
          updated_at: string
          verify_token: string | null
          webhook_enabled: boolean
        }
        Insert: {
          app_id?: string | null
          app_secret_encrypted?: string | null
          connected_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          last_verified_at?: string | null
          last_webhook_at?: string | null
          manual_token?: boolean
          page_access_token_encrypted?: string | null
          page_id?: string | null
          page_name?: string | null
          page_picture_url?: string | null
          permissions?: Json
          permissions_checked_at?: string | null
          permissions_verified?: Json
          status?: string
          store_id: string
          token_expires_at?: string | null
          updated_at?: string
          verify_token?: string | null
          webhook_enabled?: boolean
        }
        Update: {
          app_id?: string | null
          app_secret_encrypted?: string | null
          connected_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          last_verified_at?: string | null
          last_webhook_at?: string | null
          manual_token?: boolean
          page_access_token_encrypted?: string | null
          page_id?: string | null
          page_name?: string | null
          page_picture_url?: string | null
          permissions?: Json
          permissions_checked_at?: string | null
          permissions_verified?: Json
          status?: string
          store_id?: string
          token_expires_at?: string | null
          updated_at?: string
          verify_token?: string | null
          webhook_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "facebook_page_integrations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      facebook_posts: {
        Row: {
          created_at: string
          error: string | null
          fb_post_id: string | null
          id: string
          link_url: string | null
          media_type: string
          media_url: string | null
          message: string | null
          published_at: string | null
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          fb_post_id?: string | null
          id?: string
          link_url?: string | null
          media_type?: string
          media_url?: string | null
          message?: string | null
          published_at?: string | null
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          fb_post_id?: string | null
          id?: string
          link_url?: string | null
          media_type?: string
          media_url?: string | null
          message?: string | null
          published_at?: string | null
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facebook_posts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          created_at: string
          id: string
          message: string | null
          page_url: string | null
          rating: number | null
          store_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          page_url?: string | null
          rating?: number | null
          store_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          page_url?: string | null
          rating?: number | null
          store_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      fraud_checks: {
        Row: {
          cancelled: number
          check_count: number
          checked_at: string
          checked_by: string | null
          cod_success_rate: number | null
          courier_history: Json
          created_at: string
          first_checked_at: string | null
          id: string
          last_check_by: string | null
          last_check_source: string
          last_delivery: string | null
          order_id: string | null
          phone: string
          raw: Json | null
          returned: number
          risk: Database["public"]["Enums"]["fraud_risk"]
          score: number | null
          store_id: string
          successful: number
          total_orders: number
        }
        Insert: {
          cancelled?: number
          check_count?: number
          checked_at?: string
          checked_by?: string | null
          cod_success_rate?: number | null
          courier_history?: Json
          created_at?: string
          first_checked_at?: string | null
          id?: string
          last_check_by?: string | null
          last_check_source?: string
          last_delivery?: string | null
          order_id?: string | null
          phone: string
          raw?: Json | null
          returned?: number
          risk: Database["public"]["Enums"]["fraud_risk"]
          score?: number | null
          store_id: string
          successful?: number
          total_orders?: number
        }
        Update: {
          cancelled?: number
          check_count?: number
          checked_at?: string
          checked_by?: string | null
          cod_success_rate?: number | null
          courier_history?: Json
          created_at?: string
          first_checked_at?: string | null
          id?: string
          last_check_by?: string | null
          last_check_source?: string
          last_delivery?: string | null
          order_id?: string | null
          phone?: string
          raw?: Json | null
          returned?: number
          risk?: Database["public"]["Enums"]["fraud_risk"]
          score?: number | null
          store_id?: string
          successful?: number
          total_orders?: number
        }
        Relationships: [
          {
            foreignKeyName: "fraud_checks_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_checks_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      fraud_settings: {
        Row: {
          api_key: string | null
          api_keys: Json
          api_secret: string | null
          enable_analytics: boolean
          enable_auto_check_before_courier: boolean
          enable_manual_check: boolean
          enabled: boolean
          id: string
          last_test_at: string | null
          last_test_error: string | null
          last_test_ok: boolean | null
          last_test_sample: Json | null
          provider: string
          show_in_order_details: boolean
          thresholds: Json
          updated_at: string
        }
        Insert: {
          api_key?: string | null
          api_keys?: Json
          api_secret?: string | null
          enable_analytics?: boolean
          enable_auto_check_before_courier?: boolean
          enable_manual_check?: boolean
          enabled?: boolean
          id?: string
          last_test_at?: string | null
          last_test_error?: string | null
          last_test_ok?: boolean | null
          last_test_sample?: Json | null
          provider?: string
          show_in_order_details?: boolean
          thresholds?: Json
          updated_at?: string
        }
        Update: {
          api_key?: string | null
          api_keys?: Json
          api_secret?: string | null
          enable_analytics?: boolean
          enable_auto_check_before_courier?: boolean
          enable_manual_check?: boolean
          enabled?: boolean
          id?: string
          last_test_at?: string | null
          last_test_error?: string | null
          last_test_ok?: boolean | null
          last_test_sample?: Json | null
          provider?: string
          show_in_order_details?: boolean
          thresholds?: Json
          updated_at?: string
        }
        Relationships: []
      }
      invoice_template_versions: {
        Row: {
          brand: Json
          canvas: Json
          created_at: string
          created_by: string | null
          id: string
          label: string | null
          name: string | null
          template_id: string
        }
        Insert: {
          brand?: Json
          canvas?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          name?: string | null
          template_id: string
        }
        Update: {
          brand?: Json
          canvas?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          name?: string | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "invoice_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_templates: {
        Row: {
          brand: Json
          canvas: Json
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_default: boolean
          is_hidden: boolean
          name: string
          page_size: string
          scope: string
          sort_order: number
          source_template_id: string | null
          store_id: string | null
          sync_with_global: boolean
          updated_at: string
        }
        Insert: {
          brand?: Json
          canvas?: Json
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          is_hidden?: boolean
          name: string
          page_size?: string
          scope?: string
          sort_order?: number
          source_template_id?: string | null
          store_id?: string | null
          sync_with_global?: boolean
          updated_at?: string
        }
        Update: {
          brand?: Json
          canvas?: Json
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          is_hidden?: boolean
          name?: string
          page_size?: string
          scope?: string
          sort_order?: number
          source_template_id?: string | null
          store_id?: string | null
          sync_with_global?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_templates_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_page_connections: {
        Row: {
          created_at: string
          default_product_id: string | null
          description: string | null
          failed_count: number
          id: string
          landing_page_name: string | null
          last_error: string | null
          last_error_at: string | null
          last_order_at: string | null
          method: string
          name: string
          orders_received: number
          platform: string
          status: string
          store_id: string
          updated_at: string
          url: string | null
        }
        Insert: {
          created_at?: string
          default_product_id?: string | null
          description?: string | null
          failed_count?: number
          id?: string
          landing_page_name?: string | null
          last_error?: string | null
          last_error_at?: string | null
          last_order_at?: string | null
          method?: string
          name: string
          orders_received?: number
          platform?: string
          status?: string
          store_id: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          created_at?: string
          default_product_id?: string | null
          description?: string | null
          failed_count?: number
          id?: string
          landing_page_name?: string | null
          last_error?: string | null
          last_error_at?: string | null
          last_order_at?: string | null
          method?: string
          name?: string
          orders_received?: number
          platform?: string
          status?: string
          store_id?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "landing_page_connections_default_product_id_fkey"
            columns: ["default_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_page_connections_default_product_id_fkey"
            columns: ["default_product_id"]
            isOneToOne: false
            referencedRelation: "storefront_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_page_connections_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_page_credentials: {
        Row: {
          api_key_hash: string | null
          api_key_last4: string | null
          api_secret_enc: string | null
          connection_id: string
          rotated_at: string
          webhook_secret_enc: string | null
        }
        Insert: {
          api_key_hash?: string | null
          api_key_last4?: string | null
          api_secret_enc?: string | null
          connection_id: string
          rotated_at?: string
          webhook_secret_enc?: string | null
        }
        Update: {
          api_key_hash?: string | null
          api_key_last4?: string | null
          api_secret_enc?: string | null
          connection_id?: string
          rotated_at?: string
          webhook_secret_enc?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "landing_page_credentials_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: true
            referencedRelation: "landing_page_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_page_domains: {
        Row: {
          cf_hostname_id: string | null
          cf_ownership: Json | null
          cf_ssl_status: string | null
          cf_ssl_validation: Json | null
          cf_status: string | null
          created_at: string
          dns_target: string | null
          hostname: string
          id: string
          kind: string
          landing_page_id: string
          last_checked_at: string | null
          last_error: string | null
          release_reason: string | null
          released_at: string | null
          ssl_status: string
          status: string
          store_id: string
          updated_at: string
          verification_token: string
          verified_at: string | null
        }
        Insert: {
          cf_hostname_id?: string | null
          cf_ownership?: Json | null
          cf_ssl_status?: string | null
          cf_ssl_validation?: Json | null
          cf_status?: string | null
          created_at?: string
          dns_target?: string | null
          hostname: string
          id?: string
          kind?: string
          landing_page_id: string
          last_checked_at?: string | null
          last_error?: string | null
          release_reason?: string | null
          released_at?: string | null
          ssl_status?: string
          status?: string
          store_id: string
          updated_at?: string
          verification_token?: string
          verified_at?: string | null
        }
        Update: {
          cf_hostname_id?: string | null
          cf_ownership?: Json | null
          cf_ssl_status?: string | null
          cf_ssl_validation?: Json | null
          cf_status?: string | null
          created_at?: string
          dns_target?: string | null
          hostname?: string
          id?: string
          kind?: string
          landing_page_id?: string
          last_checked_at?: string | null
          last_error?: string | null
          release_reason?: string | null
          released_at?: string | null
          ssl_status?: string
          status?: string
          store_id?: string
          updated_at?: string
          verification_token?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "landing_page_domains_landing_page_id_fkey"
            columns: ["landing_page_id"]
            isOneToOne: false
            referencedRelation: "landing_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_page_domains_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_page_field_map: {
        Row: {
          connection_id: string
          mapping: Json
          updated_at: string
        }
        Insert: {
          connection_id: string
          mapping?: Json
          updated_at?: string
        }
        Update: {
          connection_id?: string
          mapping?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "landing_page_field_map_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: true
            referencedRelation: "landing_page_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_page_logs: {
        Row: {
          connection_id: string
          error: string | null
          external_order_id: string | null
          id: string
          ip: string | null
          order_id: string | null
          processing_ms: number | null
          received_at: string
          request_hash: string | null
          request_snippet: string | null
          response_snippet: string | null
          status: string
          store_id: string
          ua: string | null
        }
        Insert: {
          connection_id: string
          error?: string | null
          external_order_id?: string | null
          id?: string
          ip?: string | null
          order_id?: string | null
          processing_ms?: number | null
          received_at?: string
          request_hash?: string | null
          request_snippet?: string | null
          response_snippet?: string | null
          status: string
          store_id: string
          ua?: string | null
        }
        Update: {
          connection_id?: string
          error?: string | null
          external_order_id?: string | null
          id?: string
          ip?: string | null
          order_id?: string | null
          processing_ms?: number | null
          received_at?: string
          request_hash?: string | null
          request_snippet?: string | null
          response_snippet?: string | null
          status?: string
          store_id?: string
          ua?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "landing_page_logs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "landing_page_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_page_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_page_logs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_page_product_map: {
        Row: {
          connection_id: string
          created_at: string
          external_id: string | null
          external_sku: string | null
          id: string
          qty_multiplier: number
          store_product_id: string | null
          variant_map: Json | null
        }
        Insert: {
          connection_id: string
          created_at?: string
          external_id?: string | null
          external_sku?: string | null
          id?: string
          qty_multiplier?: number
          store_product_id?: string | null
          variant_map?: Json | null
        }
        Update: {
          connection_id?: string
          created_at?: string
          external_id?: string | null
          external_sku?: string | null
          id?: string
          qty_multiplier?: number
          store_product_id?: string | null
          variant_map?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "landing_page_product_map_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "landing_page_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_page_product_map_store_product_id_fkey"
            columns: ["store_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_page_product_map_store_product_id_fkey"
            columns: ["store_product_id"]
            isOneToOne: false
            referencedRelation: "storefront_products"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_pages: {
        Row: {
          content: Json
          content_lang: string
          created_at: string
          design_code: string | null
          design_code_at: string | null
          form_config: Json
          hosts_released_at: string | null
          id: string
          idle_warned_at: string | null
          last_activity_at: string
          last_visit_at: string | null
          offer: Json
          orders_count: number
          product_id: string | null
          published_at: string | null
          seo: Json
          slug: string
          status: string
          store_id: string
          synced_at: string | null
          theme: Json
          title: string
          updated_at: string
          views: number
        }
        Insert: {
          content?: Json
          content_lang?: string
          created_at?: string
          design_code?: string | null
          design_code_at?: string | null
          form_config?: Json
          hosts_released_at?: string | null
          id?: string
          idle_warned_at?: string | null
          last_activity_at?: string
          last_visit_at?: string | null
          offer?: Json
          orders_count?: number
          product_id?: string | null
          published_at?: string | null
          seo?: Json
          slug: string
          status?: string
          store_id: string
          synced_at?: string | null
          theme?: Json
          title?: string
          updated_at?: string
          views?: number
        }
        Update: {
          content?: Json
          content_lang?: string
          created_at?: string
          design_code?: string | null
          design_code_at?: string | null
          form_config?: Json
          hosts_released_at?: string | null
          id?: string
          idle_warned_at?: string | null
          last_activity_at?: string
          last_visit_at?: string | null
          offer?: Json
          orders_count?: number
          product_id?: string | null
          published_at?: string | null
          seo?: Json
          slug?: string
          status?: string
          store_id?: string
          synced_at?: string | null
          theme?: Json
          title?: string
          updated_at?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "landing_pages_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_pages_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "storefront_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_pages_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      low_stock_alerts: {
        Row: {
          created_at: string
          current_stock: number
          id: string
          product_id: string
          resolved_at: string | null
          store_id: string
          threshold: number
        }
        Insert: {
          created_at?: string
          current_stock: number
          id?: string
          product_id: string
          resolved_at?: string | null
          store_id: string
          threshold: number
        }
        Update: {
          created_at?: string
          current_stock?: number
          id?: string
          product_id?: string
          resolved_at?: string | null
          store_id?: string
          threshold?: number
        }
        Relationships: [
          {
            foreignKeyName: "low_stock_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "low_stock_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "storefront_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "low_stock_alerts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          order_id: string | null
          path: string | null
          platform: string
          session_id: string
          store_id: string
          value: number | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          order_id?: string | null
          path?: string | null
          platform: string
          session_id: string
          store_id: string
          value?: number | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          order_id?: string | null
          path?: string | null
          platform?: string
          session_id?: string
          store_id?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_events_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_pixel_defaults: {
        Row: {
          capi_token: string | null
          extra: Json
          fb_pixel_id: string | null
          ga4_id: string | null
          gtm_id: string | null
          id: number
          tiktok_id: string | null
          updated_at: string
        }
        Insert: {
          capi_token?: string | null
          extra?: Json
          fb_pixel_id?: string | null
          ga4_id?: string | null
          gtm_id?: string | null
          id?: number
          tiktok_id?: string | null
          updated_at?: string
        }
        Update: {
          capi_token?: string | null
          extra?: Json
          fb_pixel_id?: string | null
          ga4_id?: string | null
          gtm_id?: string | null
          id?: number
          tiktok_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      marketing_visits: {
        Row: {
          campaign: string | null
          click_id: string | null
          created_at: string
          id: string
          landing_path: string | null
          last_seen_at: string
          platform: string
          referrer: string | null
          session_id: string
          store_id: string
          visitor_id: string
        }
        Insert: {
          campaign?: string | null
          click_id?: string | null
          created_at?: string
          id?: string
          landing_path?: string | null
          last_seen_at?: string
          platform: string
          referrer?: string | null
          session_id: string
          store_id: string
          visitor_id: string
        }
        Update: {
          campaign?: string | null
          click_id?: string | null
          created_at?: string
          id?: string
          landing_path?: string | null
          last_seen_at?: string
          platform?: string
          referrer?: string | null
          session_id?: string
          store_id?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_visits_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_auth_codes: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          purpose: string
          user_id: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          purpose: string
          user_id: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          purpose?: string
          user_id?: string
        }
        Relationships: []
      }
      merchant_security: {
        Row: {
          backup_code_hashes: string[]
          created_at: string
          email_verified_at: string | null
          totp_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          backup_code_hashes?: string[]
          created_at?: string
          email_verified_at?: string | null
          totp_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          backup_code_hashes?: string[]
          created_at?: string
          email_verified_at?: string | null
          totp_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      merchant_wallets: {
        Row: {
          auto_renew: boolean
          auto_renew_cycle: string
          balance: number
          created_at: string
          currency: string
          id: string
          store_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_renew?: boolean
          auto_renew_cycle?: string
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          store_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_renew?: boolean
          auto_renew_cycle?: string
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          store_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_wallets_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      messenger_integrations: {
        Row: {
          ai_auto_reply: boolean
          app_id: string | null
          app_secret_encrypted: string | null
          compact_memory: boolean
          connected_at: string | null
          conversation_history: boolean
          created_at: string
          delivery_failures: number
          faq_reply: boolean
          human_takeover: boolean
          id: string
          last_error: string | null
          last_verified_at: string | null
          order_detection: boolean
          page_access_token: string | null
          page_access_token_encrypted: string | null
          page_id: string | null
          page_name: string | null
          page_picture_url: string | null
          permissions: Json
          privacy_policy_url: string | null
          product_recommendation: boolean
          reply_delay_seconds: number
          reply_speed: string
          status: string
          store_id: string
          terms_of_service_url: string | null
          token_expires_at: string | null
          updated_at: string
          verify_token: string | null
        }
        Insert: {
          ai_auto_reply?: boolean
          app_id?: string | null
          app_secret_encrypted?: string | null
          compact_memory?: boolean
          connected_at?: string | null
          conversation_history?: boolean
          created_at?: string
          delivery_failures?: number
          faq_reply?: boolean
          human_takeover?: boolean
          id?: string
          last_error?: string | null
          last_verified_at?: string | null
          order_detection?: boolean
          page_access_token?: string | null
          page_access_token_encrypted?: string | null
          page_id?: string | null
          page_name?: string | null
          page_picture_url?: string | null
          permissions?: Json
          privacy_policy_url?: string | null
          product_recommendation?: boolean
          reply_delay_seconds?: number
          reply_speed?: string
          status?: string
          store_id: string
          terms_of_service_url?: string | null
          token_expires_at?: string | null
          updated_at?: string
          verify_token?: string | null
        }
        Update: {
          ai_auto_reply?: boolean
          app_id?: string | null
          app_secret_encrypted?: string | null
          compact_memory?: boolean
          connected_at?: string | null
          conversation_history?: boolean
          created_at?: string
          delivery_failures?: number
          faq_reply?: boolean
          human_takeover?: boolean
          id?: string
          last_error?: string | null
          last_verified_at?: string | null
          order_detection?: boolean
          page_access_token?: string | null
          page_access_token_encrypted?: string | null
          page_id?: string | null
          page_name?: string | null
          page_picture_url?: string | null
          permissions?: Json
          privacy_policy_url?: string | null
          product_recommendation?: boolean
          reply_delay_seconds?: number
          reply_speed?: string
          status?: string
          store_id?: string
          terms_of_service_url?: string | null
          token_expires_at?: string | null
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
      messenger_jobs: {
        Row: {
          attempts: number
          available_at: string
          completed_at: string | null
          created_at: string
          event_payload: Json
          id: string
          integration_id: string
          last_error: string | null
          message_id: string
          outbound_message_id: string | null
          page_id: string
          processing_ms: number | null
          received_at: string | null
          reply_text: string | null
          sender_id: string
          started_at: string | null
          status: string
          store_id: string
          timings: Json | null
          trace_id: string | null
          updated_at: string
          wake_token: string
        }
        Insert: {
          attempts?: number
          available_at?: string
          completed_at?: string | null
          created_at?: string
          event_payload: Json
          id?: string
          integration_id: string
          last_error?: string | null
          message_id: string
          outbound_message_id?: string | null
          page_id: string
          processing_ms?: number | null
          received_at?: string | null
          reply_text?: string | null
          sender_id: string
          started_at?: string | null
          status?: string
          store_id: string
          timings?: Json | null
          trace_id?: string | null
          updated_at?: string
          wake_token?: string
        }
        Update: {
          attempts?: number
          available_at?: string
          completed_at?: string | null
          created_at?: string
          event_payload?: Json
          id?: string
          integration_id?: string
          last_error?: string | null
          message_id?: string
          outbound_message_id?: string | null
          page_id?: string
          processing_ms?: number | null
          received_at?: string | null
          reply_text?: string | null
          sender_id?: string
          started_at?: string | null
          status?: string
          store_id?: string
          timings?: Json | null
          trace_id?: string | null
          updated_at?: string
          wake_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "messenger_jobs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "messenger_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messenger_jobs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      messenger_notes: {
        Row: {
          author_user_id: string | null
          body: string
          conversation_id: string
          created_at: string
          id: string
          store_id: string
          updated_at: string
        }
        Insert: {
          author_user_id?: string | null
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          author_user_id?: string | null
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messenger_notes_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messenger_notes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_oauth_sessions: {
        Row: {
          access_token_encrypted: string | null
          channel: string
          created_at: string
          error: string | null
          expires_at: string
          id: string
          state: string
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          access_token_encrypted?: string | null
          channel: string
          created_at?: string
          error?: string | null
          expires_at?: string
          id?: string
          state: string
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          access_token_encrypted?: string | null
          channel?: string
          created_at?: string
          error?: string | null
          expires_at?: string
          id?: string
          state?: string
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_oauth_sessions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_campaigns: {
        Row: {
          action_label: string | null
          action_target: string | null
          action_type: string | null
          audience_filter: Json
          audience_ids: string[]
          audience_kind: string
          body_html: string
          channels: string[]
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          idempotency_key: string | null
          notification_body: string | null
          priority: string
          scheduled_at: string | null
          scheduled_tz: string | null
          sender_email: string | null
          sent_at: string | null
          status: string
          subject: string | null
          title: string
          totals: Json
          type: string
          updated_at: string
        }
        Insert: {
          action_label?: string | null
          action_target?: string | null
          action_type?: string | null
          audience_filter?: Json
          audience_ids?: string[]
          audience_kind?: string
          body_html?: string
          channels?: string[]
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          idempotency_key?: string | null
          notification_body?: string | null
          priority?: string
          scheduled_at?: string | null
          scheduled_tz?: string | null
          sender_email?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          title: string
          totals?: Json
          type?: string
          updated_at?: string
        }
        Update: {
          action_label?: string | null
          action_target?: string | null
          action_type?: string | null
          audience_filter?: Json
          audience_ids?: string[]
          audience_kind?: string
          body_html?: string
          channels?: string[]
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          idempotency_key?: string | null
          notification_body?: string | null
          priority?: string
          scheduled_at?: string | null
          scheduled_tz?: string | null
          sender_email?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          title?: string
          totals?: Json
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_recipients: {
        Row: {
          campaign_id: string
          created_at: string
          email: string | null
          email_attempts: number
          email_last_error: string | null
          email_message_id: string | null
          email_sent_at: string | null
          email_status: string
          id: string
          inapp_notification_id: string | null
          inapp_status: string
          read_at: string | null
          sent_via: string | null
          store_id: string | null
          updated_at: string
          user_id: string
          variables: Json
        }
        Insert: {
          campaign_id: string
          created_at?: string
          email?: string | null
          email_attempts?: number
          email_last_error?: string | null
          email_message_id?: string | null
          email_sent_at?: string | null
          email_status?: string
          id?: string
          inapp_notification_id?: string | null
          inapp_status?: string
          read_at?: string | null
          sent_via?: string | null
          store_id?: string | null
          updated_at?: string
          user_id: string
          variables?: Json
        }
        Update: {
          campaign_id?: string
          created_at?: string
          email?: string | null
          email_attempts?: number
          email_last_error?: string | null
          email_message_id?: string | null
          email_sent_at?: string | null
          email_status?: string
          id?: string
          inapp_notification_id?: string | null
          inapp_status?: string
          read_at?: string | null
          sent_via?: string | null
          store_id?: string | null
          updated_at?: string
          user_id?: string
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "notification_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "notification_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_templates: {
        Row: {
          action_label: string | null
          action_target: string | null
          action_type: string | null
          body_html: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          priority: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          action_label?: string | null
          action_target?: string | null
          action_type?: string | null
          body_html?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          priority?: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          action_label?: string | null
          action_target?: string | null
          action_type?: string | null
          body_html?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          priority?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
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
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "storefront_products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_notifications_outbox: {
        Row: {
          attempt_count: number
          channel: string
          created_at: string
          error: string | null
          id: string
          order_id: string
          payload: Json
          sent_at: string | null
          stage: string
          store_id: string
        }
        Insert: {
          attempt_count?: number
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          order_id: string
          payload?: Json
          sent_at?: string | null
          stage: string
          store_id: string
        }
        Update: {
          attempt_count?: number
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          order_id?: string
          payload?: Json
          sent_at?: string | null
          stage?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_notifications_outbox_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_notifications_outbox_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
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
          allow_duplicate: boolean
          area: string | null
          attribution_campaign: string | null
          attribution_platform: string | null
          attribution_session_id: string | null
          company: string | null
          confirmation_status: string
          confirmed_at: string | null
          country: string | null
          coupon_id: string | null
          courier_code: string | null
          courier_last_synced_at: string | null
          courier_name: string | null
          courier_status: string | null
          courier_tracking_id: string | null
          created_at: string
          customer_id: string | null
          customer_name: string
          delivery_amount: number | null
          delivery_zone_id: string | null
          device_id: string | null
          discount_amount: number | null
          due_amount: number
          email: string | null
          external_order_id: string | null
          fingerprint: string | null
          fulfillment_meta: Json
          id: string
          idempotency_key: string | null
          invoice_no: string | null
          is_test: boolean
          landing_page_connection_id: string | null
          landing_page_url: string | null
          notes: string | null
          order_type: string
          paid_amount: number
          payment_gateway_id: string | null
          payment_gateway_name: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_ref: string | null
          payment_status: string
          phone: string
          source: string
          status: Database["public"]["Enums"]["order_status"]
          store_id: string
          subtotal: number
          txn_id: string | null
          updated_at: string
          utm: Json | null
          voice_verification: string | null
        }
        Insert: {
          address: string
          allow_duplicate?: boolean
          area?: string | null
          attribution_campaign?: string | null
          attribution_platform?: string | null
          attribution_session_id?: string | null
          company?: string | null
          confirmation_status?: string
          confirmed_at?: string | null
          country?: string | null
          coupon_id?: string | null
          courier_code?: string | null
          courier_last_synced_at?: string | null
          courier_name?: string | null
          courier_status?: string | null
          courier_tracking_id?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name: string
          delivery_amount?: number | null
          delivery_zone_id?: string | null
          device_id?: string | null
          discount_amount?: number | null
          due_amount?: number
          email?: string | null
          external_order_id?: string | null
          fingerprint?: string | null
          fulfillment_meta?: Json
          id?: string
          idempotency_key?: string | null
          invoice_no?: string | null
          is_test?: boolean
          landing_page_connection_id?: string | null
          landing_page_url?: string | null
          notes?: string | null
          order_type?: string
          paid_amount?: number
          payment_gateway_id?: string | null
          payment_gateway_name?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_ref?: string | null
          payment_status?: string
          phone: string
          source?: string
          status?: Database["public"]["Enums"]["order_status"]
          store_id: string
          subtotal?: number
          txn_id?: string | null
          updated_at?: string
          utm?: Json | null
          voice_verification?: string | null
        }
        Update: {
          address?: string
          allow_duplicate?: boolean
          area?: string | null
          attribution_campaign?: string | null
          attribution_platform?: string | null
          attribution_session_id?: string | null
          company?: string | null
          confirmation_status?: string
          confirmed_at?: string | null
          country?: string | null
          coupon_id?: string | null
          courier_code?: string | null
          courier_last_synced_at?: string | null
          courier_name?: string | null
          courier_status?: string | null
          courier_tracking_id?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          delivery_amount?: number | null
          delivery_zone_id?: string | null
          device_id?: string | null
          discount_amount?: number | null
          due_amount?: number
          email?: string | null
          external_order_id?: string | null
          fingerprint?: string | null
          fulfillment_meta?: Json
          id?: string
          idempotency_key?: string | null
          invoice_no?: string | null
          is_test?: boolean
          landing_page_connection_id?: string | null
          landing_page_url?: string | null
          notes?: string | null
          order_type?: string
          paid_amount?: number
          payment_gateway_id?: string | null
          payment_gateway_name?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_ref?: string | null
          payment_status?: string
          phone?: string
          source?: string
          status?: Database["public"]["Enums"]["order_status"]
          store_id?: string
          subtotal?: number
          txn_id?: string | null
          updated_at?: string
          utm?: Json | null
          voice_verification?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "store_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_zone_id_fkey"
            columns: ["delivery_zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_gmail_state: {
        Row: {
          connected_at: string | null
          connected_email: string | null
          google_account_name: string | null
          last_test_error: string | null
          last_test_ok: boolean | null
          last_tested_at: string | null
          owner_id: string
          updated_at: string
        }
        Insert: {
          connected_at?: string | null
          connected_email?: string | null
          google_account_name?: string | null
          last_test_error?: string | null
          last_test_ok?: boolean | null
          last_tested_at?: string | null
          owner_id: string
          updated_at?: string
        }
        Update: {
          connected_at?: string | null
          connected_email?: string | null
          google_account_name?: string | null
          last_test_error?: string | null
          last_test_ok?: boolean | null
          last_tested_at?: string | null
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      owner_message_templates: {
        Row: {
          body_html: string
          created_at: string
          id: string
          name: string
          notification_body: string | null
          notification_title: string | null
          owner_id: string
          subject: string
          updated_at: string
        }
        Insert: {
          body_html?: string
          created_at?: string
          id?: string
          name: string
          notification_body?: string | null
          notification_title?: string | null
          owner_id: string
          subject: string
          updated_at?: string
        }
        Update: {
          body_html?: string
          created_at?: string
          id?: string
          name?: string
          notification_body?: string | null
          notification_title?: string | null
          owner_id?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_webhook_events: {
        Row: {
          amount: number | null
          currency: string | null
          error_message: string | null
          headers: Json | null
          id: string
          method: string | null
          payload_summary: Json | null
          provider_id: string
          provider_ref: string | null
          received_at: string
          signature_valid: boolean | null
          source: string
          status_code: number | null
          store_id: string
          verified_status: string | null
        }
        Insert: {
          amount?: number | null
          currency?: string | null
          error_message?: string | null
          headers?: Json | null
          id?: string
          method?: string | null
          payload_summary?: Json | null
          provider_id: string
          provider_ref?: string | null
          received_at?: string
          signature_valid?: boolean | null
          source?: string
          status_code?: number | null
          store_id: string
          verified_status?: string | null
        }
        Update: {
          amount?: number | null
          currency?: string | null
          error_message?: string | null
          headers?: Json | null
          id?: string
          method?: string | null
          payload_summary?: Json | null
          provider_id?: string
          provider_ref?: string | null
          received_at?: string
          signature_valid?: boolean | null
          source?: string
          status_code?: number | null
          store_id?: string
          verified_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_webhook_events_store_id_fkey"
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
          customer_email: string | null
          customer_note: string | null
          cycle_end: string | null
          cycle_start: string | null
          id: string
          invoice_no: string | null
          method: string | null
          notes: string | null
          package_id: string | null
          purpose: string
          rejection_reason: string | null
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
          customer_email?: string | null
          customer_note?: string | null
          cycle_end?: string | null
          cycle_start?: string | null
          id?: string
          invoice_no?: string | null
          method?: string | null
          notes?: string | null
          package_id?: string | null
          purpose?: string
          rejection_reason?: string | null
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
          customer_email?: string | null
          customer_note?: string | null
          cycle_end?: string | null
          cycle_start?: string | null
          id?: string
          invoice_no?: string | null
          method?: string | null
          notes?: string | null
          package_id?: string | null
          purpose?: string
          rejection_reason?: string | null
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
      platform_branding: {
        Row: {
          assets: Json
          combo: Json
          id: string
          placements: Json
          published_at: string | null
          updated_at: string
        }
        Insert: {
          assets?: Json
          combo?: Json
          id?: string
          placements?: Json
          published_at?: string | null
          updated_at?: string
        }
        Update: {
          assets?: Json
          combo?: Json
          id?: string
          placements?: Json
          published_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      platform_consent_records: {
        Row: {
          choice: string
          country: string | null
          created_at: string
          id: string
          notice_version: string
          user_agent: string | null
          visitor_id: string
        }
        Insert: {
          choice: string
          country?: string | null
          created_at?: string
          id?: string
          notice_version: string
          user_agent?: string | null
          visitor_id: string
        }
        Update: {
          choice?: string
          country?: string | null
          created_at?: string
          id?: string
          notice_version?: string
          user_agent?: string | null
          visitor_id?: string
        }
        Relationships: []
      }
      platform_email_automations: {
        Row: {
          description: string
          enabled: boolean
          key: string
          label: string
          updated_at: string
        }
        Insert: {
          description?: string
          enabled?: boolean
          key: string
          label: string
          updated_at?: string
        }
        Update: {
          description?: string
          enabled?: boolean
          key?: string
          label?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_feature_flags: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          enabled: boolean
          flag_key: string
          label: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          enabled?: boolean
          flag_key: string
          label?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          enabled?: boolean
          flag_key?: string
          label?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      platform_footer: {
        Row: {
          bottom_note: string | null
          columns: Json
          contact: Json
          description: string | null
          id: string
          socials: Json
          updated_at: string
        }
        Insert: {
          bottom_note?: string | null
          columns?: Json
          contact?: Json
          description?: string | null
          id?: string
          socials?: Json
          updated_at?: string
        }
        Update: {
          bottom_note?: string | null
          columns?: Json
          contact?: Json
          description?: string | null
          id?: string
          socials?: Json
          updated_at?: string
        }
        Relationships: []
      }
      platform_global_banner: {
        Row: {
          alt: string | null
          enabled: boolean
          id: number
          image_url: string | null
          link_url: string | null
          updated_at: string
        }
        Insert: {
          alt?: string | null
          enabled?: boolean
          id?: number
          image_url?: string | null
          link_url?: string | null
          updated_at?: string
        }
        Update: {
          alt?: string | null
          enabled?: boolean
          id?: number
          image_url?: string | null
          link_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      platform_meta_app: {
        Row: {
          app_id: string | null
          app_secret_encrypted: string | null
          created_at: string
          id: number
          updated_at: string
        }
        Insert: {
          app_id?: string | null
          app_secret_encrypted?: string | null
          created_at?: string
          id?: number
          updated_at?: string
        }
        Update: {
          app_id?: string | null
          app_secret_encrypted?: string | null
          created_at?: string
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      platform_meta_events: {
        Row: {
          attempts: number
          created_at: string
          error: string | null
          event_id: string
          event_name: string
          id: string
          response: Json | null
          source: string
          status: string
          test_mode: boolean
          updated_at: string
          user_id: string | null
          value: number | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          error?: string | null
          event_id: string
          event_name: string
          id?: string
          response?: Json | null
          source?: string
          status?: string
          test_mode?: boolean
          updated_at?: string
          user_id?: string | null
          value?: number | null
        }
        Update: {
          attempts?: number
          created_at?: string
          error?: string | null
          event_id?: string
          event_name?: string
          id?: string
          response?: Json | null
          source?: string
          status?: string
          test_mode?: boolean
          updated_at?: string
          user_id?: string | null
          value?: number | null
        }
        Relationships: []
      }
      platform_meta_tracking: {
        Row: {
          capi_enabled: boolean
          capi_token_enc: string | null
          enabled: boolean
          events: Json
          id: number
          pixel_enabled: boolean
          pixel_id: string | null
          send_user_data: boolean
          test_event_code: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          capi_enabled?: boolean
          capi_token_enc?: string | null
          enabled?: boolean
          events?: Json
          id?: number
          pixel_enabled?: boolean
          pixel_id?: string | null
          send_user_data?: boolean
          test_event_code?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          capi_enabled?: boolean
          capi_token_enc?: string | null
          enabled?: boolean
          events?: Json
          id?: number
          pixel_enabled?: boolean
          pixel_id?: string | null
          send_user_data?: boolean
          test_event_code?: string | null
          updated_at?: string
          updated_by?: string | null
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
      platform_payment_gateways: {
        Row: {
          brand_color: string | null
          created_at: string
          description: string | null
          docs_url: string | null
          enabled: boolean
          icon_bg_color: string | null
          id: string
          label: string
          logo_url: string | null
          notes: string | null
          secondary_color: string | null
          sort_order: number
          updated_at: string
          website_url: string | null
          wordmark_url: string | null
        }
        Insert: {
          brand_color?: string | null
          created_at?: string
          description?: string | null
          docs_url?: string | null
          enabled?: boolean
          icon_bg_color?: string | null
          id: string
          label: string
          logo_url?: string | null
          notes?: string | null
          secondary_color?: string | null
          sort_order?: number
          updated_at?: string
          website_url?: string | null
          wordmark_url?: string | null
        }
        Update: {
          brand_color?: string | null
          created_at?: string
          description?: string | null
          docs_url?: string | null
          enabled?: boolean
          icon_bg_color?: string | null
          id?: string
          label?: string
          logo_url?: string | null
          notes?: string | null
          secondary_color?: string | null
          sort_order?: number
          updated_at?: string
          website_url?: string | null
          wordmark_url?: string | null
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
      platform_reviews: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          is_visible: boolean
          name: string
          rating: number
          review: string
          sort_order: number
          store_name: string
          tone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          is_visible?: boolean
          name: string
          rating?: number
          review?: string
          sort_order?: number
          store_name?: string
          tone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          is_visible?: boolean
          name?: string
          rating?: number
          review?: string
          sort_order?: number
          store_name?: string
          tone?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          id: number
          settings: Json
          updated_at: string
        }
        Insert: {
          id?: number
          settings?: Json
          updated_at?: string
        }
        Update: {
          id?: number
          settings?: Json
          updated_at?: string
        }
        Relationships: []
      }
      platform_showcase: {
        Row: {
          created_at: string
          desktop_url: string | null
          key: string
          mobile_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          desktop_url?: string | null
          key: string
          mobile_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          desktop_url?: string | null
          key?: string
          mobile_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      product_image_embeddings: {
        Row: {
          created_at: string
          embedded_url: string | null
          embedding: string | null
          image_url: string
          last_error: string | null
          model: string
          phash: string | null
          product_id: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          embedded_url?: string | null
          embedding?: string | null
          image_url: string
          last_error?: string | null
          model?: string
          phash?: string | null
          product_id: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          embedded_url?: string | null
          embedding?: string | null
          image_url?: string
          last_error?: string | null
          model?: string
          phash?: string | null
          product_id?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_image_embeddings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_image_embeddings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "storefront_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_image_embeddings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      product_import_export_history: {
        Row: {
          created_at: string
          failed: number
          file_name: string | null
          filters: Json | null
          format: string | null
          id: string
          imported: number
          kind: string
          skipped: number
          store_id: string
          total: number
          updated: number
          user_id: string
        }
        Insert: {
          created_at?: string
          failed?: number
          file_name?: string | null
          filters?: Json | null
          format?: string | null
          id?: string
          imported?: number
          kind: string
          skipped?: number
          store_id: string
          total?: number
          updated?: number
          user_id: string
        }
        Update: {
          created_at?: string
          failed?: number
          file_name?: string | null
          filters?: Json | null
          format?: string | null
          id?: string
          imported?: number
          kind?: string
          skipped?: number
          store_id?: string
          total?: number
          updated?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_import_export_history_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reviews: {
        Row: {
          comment: string
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          product_id: string
          rating: number
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          comment: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          product_id: string
          rating: number
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          comment?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          product_id?: string
          rating?: number
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "storefront_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand: string | null
          category_id: string | null
          cost_price: number | null
          created_at: string
          delivery_charge: number | null
          delivery_time_days: string | null
          description: string | null
          features: Json
          gallery: Json
          id: string
          is_featured: boolean
          low_stock_threshold: number | null
          meta: Json
          name: string
          old_price: number | null
          price: number
          primary_image_url: string | null
          product_code: string | null
          product_type: string
          rating: number | null
          related_product_ids: string[]
          return_policy: string | null
          shipping_info: string | null
          short_description: string | null
          sku: string | null
          slug: string
          specifications: Json
          status: Database["public"]["Enums"]["product_status"]
          stock: number
          store_id: string
          total_sold: number
          updated_at: string
          variants: Json
          video_url: string | null
          warranty: string | null
        }
        Insert: {
          brand?: string | null
          category_id?: string | null
          cost_price?: number | null
          created_at?: string
          delivery_charge?: number | null
          delivery_time_days?: string | null
          description?: string | null
          features?: Json
          gallery?: Json
          id?: string
          is_featured?: boolean
          low_stock_threshold?: number | null
          meta?: Json
          name: string
          old_price?: number | null
          price?: number
          primary_image_url?: string | null
          product_code?: string | null
          product_type?: string
          rating?: number | null
          related_product_ids?: string[]
          return_policy?: string | null
          shipping_info?: string | null
          short_description?: string | null
          sku?: string | null
          slug: string
          specifications?: Json
          status?: Database["public"]["Enums"]["product_status"]
          stock?: number
          store_id: string
          total_sold?: number
          updated_at?: string
          variants?: Json
          video_url?: string | null
          warranty?: string | null
        }
        Update: {
          brand?: string | null
          category_id?: string | null
          cost_price?: number | null
          created_at?: string
          delivery_charge?: number | null
          delivery_time_days?: string | null
          description?: string | null
          features?: Json
          gallery?: Json
          id?: string
          is_featured?: boolean
          low_stock_threshold?: number | null
          meta?: Json
          name?: string
          old_price?: number | null
          price?: number
          primary_image_url?: string | null
          product_code?: string | null
          product_type?: string
          rating?: number | null
          related_product_ids?: string[]
          return_policy?: string | null
          shipping_info?: string | null
          short_description?: string | null
          sku?: string | null
          slug?: string
          specifications?: Json
          status?: Database["public"]["Enums"]["product_status"]
          stock?: number
          store_id?: string
          total_sold?: number
          updated_at?: string
          variants?: Json
          video_url?: string | null
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
      rate_limit_hits: {
        Row: {
          bucket_key: string
          hits: number
          updated_at: string
          window_start: string
        }
        Insert: {
          bucket_key: string
          hits?: number
          updated_at?: string
          window_start: string
        }
        Update: {
          bucket_key?: string
          hits?: number
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      return_items: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          inspection_result: string | null
          name: string
          order_item_id: string | null
          product_id: string | null
          qty: number
          restocked_qty: number
          return_id: string
          store_id: string
          unit_price: number
          variant: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          inspection_result?: string | null
          name: string
          order_item_id?: string | null
          product_id?: string | null
          qty?: number
          restocked_qty?: number
          return_id: string
          store_id: string
          unit_price?: number
          variant?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          inspection_result?: string | null
          name?: string
          order_item_id?: string | null
          product_id?: string | null
          qty?: number
          restocked_qty?: number
          return_id?: string
          store_id?: string
          unit_price?: number
          variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "return_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "storefront_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "returns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      return_timeline: {
        Row: {
          actor: string
          created_at: string
          id: string
          note: string | null
          return_id: string
          status: string
          store_id: string
        }
        Insert: {
          actor?: string
          created_at?: string
          id?: string
          note?: string | null
          return_id: string
          status: string
          store_id: string
        }
        Update: {
          actor?: string
          created_at?: string
          id?: string
          note?: string | null
          return_id?: string
          status?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_timeline_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "returns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_timeline_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      returns: {
        Row: {
          courier_name: string | null
          courier_parcel_id: string | null
          courier_tracking_id: string | null
          created_at: string
          created_by: string
          customer_id: string | null
          customer_name: string | null
          customer_note: string | null
          extra_payment_due: number
          id: string
          images: string[]
          inspected_at: string | null
          inspection_note: string | null
          internal_note: string | null
          items: Json
          items_value: number
          manual_adjustment: number
          order_id: string
          phone: string | null
          reason: string | null
          received_at: string | null
          refund_amount: number | null
          refund_method: string | null
          refund_processed_at: string | null
          refund_status: string
          replacement_items: Json
          replacement_note: string | null
          replacement_order_id: string | null
          replacement_product_id: string | null
          replacement_shipping_charge: number
          replacement_value: number
          request_kind: string
          resolution_note: string | null
          restocking_fee: number
          return_shipping_charge: number
          status: Database["public"]["Enums"]["return_status"]
          store_id: string
          type: Database["public"]["Enums"]["return_type"]
          updated_at: string
          use_global_settings: boolean
        }
        Insert: {
          courier_name?: string | null
          courier_parcel_id?: string | null
          courier_tracking_id?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_note?: string | null
          extra_payment_due?: number
          id?: string
          images?: string[]
          inspected_at?: string | null
          inspection_note?: string | null
          internal_note?: string | null
          items?: Json
          items_value?: number
          manual_adjustment?: number
          order_id: string
          phone?: string | null
          reason?: string | null
          received_at?: string | null
          refund_amount?: number | null
          refund_method?: string | null
          refund_processed_at?: string | null
          refund_status?: string
          replacement_items?: Json
          replacement_note?: string | null
          replacement_order_id?: string | null
          replacement_product_id?: string | null
          replacement_shipping_charge?: number
          replacement_value?: number
          request_kind?: string
          resolution_note?: string | null
          restocking_fee?: number
          return_shipping_charge?: number
          status?: Database["public"]["Enums"]["return_status"]
          store_id: string
          type?: Database["public"]["Enums"]["return_type"]
          updated_at?: string
          use_global_settings?: boolean
        }
        Update: {
          courier_name?: string | null
          courier_parcel_id?: string | null
          courier_tracking_id?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_note?: string | null
          extra_payment_due?: number
          id?: string
          images?: string[]
          inspected_at?: string | null
          inspection_note?: string | null
          internal_note?: string | null
          items?: Json
          items_value?: number
          manual_adjustment?: number
          order_id?: string
          phone?: string | null
          reason?: string | null
          received_at?: string | null
          refund_amount?: number | null
          refund_method?: string | null
          refund_processed_at?: string | null
          refund_status?: string
          replacement_items?: Json
          replacement_note?: string | null
          replacement_order_id?: string | null
          replacement_product_id?: string | null
          replacement_shipping_charge?: number
          replacement_value?: number
          request_kind?: string
          resolution_note?: string | null
          restocking_fee?: number
          return_shipping_charge?: number
          status?: Database["public"]["Enums"]["return_status"]
          store_id?: string
          type?: Database["public"]["Enums"]["return_type"]
          updated_at?: string
          use_global_settings?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "returns_courier_parcel_id_fkey"
            columns: ["courier_parcel_id"]
            isOneToOne: false
            referencedRelation: "courier_parcels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "store_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_replacement_order_id_fkey"
            columns: ["replacement_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_replacement_product_id_fkey"
            columns: ["replacement_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_replacement_product_id_fkey"
            columns: ["replacement_product_id"]
            isOneToOne: false
            referencedRelation: "storefront_products"
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
      saved_replies: {
        Row: {
          body: string
          created_at: string
          id: string
          sort: number
          store_id: string
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          sort?: number
          store_id: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          sort?: number
          store_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_replies_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      service_checkout_settings: {
        Row: {
          auto_confirm: boolean
          auto_invoice: boolean
          communication_enabled: boolean
          created_at: string
          customer_fields: Json
          default_payment_method: string | null
          min_advance_percent: number
          notify_email: boolean
          notify_sms: boolean
          notify_whatsapp: boolean
          order_tags: string[]
          payment_methods: Json
          payment_mode: string
          staff_notes: string | null
          store_id: string
          terms: Json
          thank_you_message: string | null
          updated_at: string
          upload_allowed_types: string[]
          upload_max_files: number
          upload_max_mb: number
        }
        Insert: {
          auto_confirm?: boolean
          auto_invoice?: boolean
          communication_enabled?: boolean
          created_at?: string
          customer_fields?: Json
          default_payment_method?: string | null
          min_advance_percent?: number
          notify_email?: boolean
          notify_sms?: boolean
          notify_whatsapp?: boolean
          order_tags?: string[]
          payment_methods?: Json
          payment_mode?: string
          staff_notes?: string | null
          store_id: string
          terms?: Json
          thank_you_message?: string | null
          updated_at?: string
          upload_allowed_types?: string[]
          upload_max_files?: number
          upload_max_mb?: number
        }
        Update: {
          auto_confirm?: boolean
          auto_invoice?: boolean
          communication_enabled?: boolean
          created_at?: string
          customer_fields?: Json
          default_payment_method?: string | null
          min_advance_percent?: number
          notify_email?: boolean
          notify_sms?: boolean
          notify_whatsapp?: boolean
          order_tags?: string[]
          payment_methods?: Json
          payment_mode?: string
          staff_notes?: string | null
          store_id?: string
          terms?: Json
          thank_you_message?: string | null
          updated_at?: string
          upload_allowed_types?: string[]
          upload_max_files?: number
          upload_max_mb?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_checkout_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      service_intake_fields: {
        Row: {
          created_at: string
          field_key: string
          field_type: string
          help_text: string | null
          id: string
          is_required: boolean
          is_visible: boolean
          label: string
          options: string[]
          placeholder: string | null
          sort_order: number
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          field_key: string
          field_type?: string
          help_text?: string | null
          id?: string
          is_required?: boolean
          is_visible?: boolean
          label: string
          options?: string[]
          placeholder?: string | null
          sort_order?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          field_key?: string
          field_type?: string
          help_text?: string | null
          id?: string
          is_required?: boolean
          is_visible?: boolean
          label?: string
          options?: string[]
          placeholder?: string | null
          sort_order?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_intake_fields_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_assignments: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          last_reply_at: string | null
          messenger: string | null
          name: string
          order_id: string
          phone: string | null
          response_time: string | null
          role: string
          store_id: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          last_reply_at?: string | null
          messenger?: string | null
          name: string
          order_id: string
          phone?: string | null
          response_time?: string | null
          role?: string
          store_id: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          last_reply_at?: string | null
          messenger?: string | null
          name?: string
          order_id?: string
          phone?: string | null
          response_time?: string | null
          role?: string
          store_id?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_order_assignments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_assignments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_deliverables: {
        Row: {
          created_at: string
          download_count: number
          download_limit: number | null
          expires_at: string | null
          external_url: string | null
          file_name: string | null
          id: string
          kind: string
          mime_type: string | null
          order_id: string
          path: string | null
          secret_value: string | null
          size_bytes: number | null
          store_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          download_count?: number
          download_limit?: number | null
          expires_at?: string | null
          external_url?: string | null
          file_name?: string | null
          id?: string
          kind?: string
          mime_type?: string | null
          order_id: string
          path?: string | null
          secret_value?: string | null
          size_bytes?: number | null
          store_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          download_count?: number
          download_limit?: number | null
          expires_at?: string | null
          external_url?: string | null
          file_name?: string | null
          id?: string
          kind?: string
          mime_type?: string | null
          order_id?: string
          path?: string | null
          secret_value?: string | null
          size_bytes?: number | null
          store_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_order_deliverables_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_deliverables_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_files: {
        Row: {
          created_at: string
          file_name: string
          id: string
          mime_type: string | null
          order_id: string | null
          path: string
          size_bytes: number
          store_id: string
          upload_token: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string | null
          order_id?: string | null
          path: string
          size_bytes?: number
          store_id: string
          upload_token?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          order_id?: string | null
          path?: string
          size_bytes?: number
          store_id?: string
          upload_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_order_files_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_files_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_meetings: {
        Row: {
          created_at: string
          duration_minutes: number | null
          id: string
          meeting_link: string | null
          notes: string | null
          office_address: string | null
          order_id: string
          passcode: string | null
          platform: string
          starts_at: string
          status: string
          store_id: string
          timezone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number | null
          id?: string
          meeting_link?: string | null
          notes?: string | null
          office_address?: string | null
          order_id: string
          passcode?: string | null
          platform?: string
          starts_at: string
          status?: string
          store_id: string
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number | null
          id?: string
          meeting_link?: string | null
          notes?: string | null
          office_address?: string | null
          order_id?: string
          passcode?: string | null
          platform?: string
          starts_at?: string
          status?: string
          store_id?: string
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_order_meetings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_meetings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_progress: {
        Row: {
          created_at: string
          id: string
          note: string | null
          order_id: string
          stage: string
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          order_id: string
          stage: string
          store_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          order_id?: string
          stage?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_order_progress_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_progress_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_reviews: {
        Row: {
          created_at: string
          order_id: string
          rating: number
          recommend: boolean
          review_text: string | null
          screenshot_path: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          order_id: string
          rating: number
          recommend?: boolean
          review_text?: string | null
          screenshot_path?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          order_id?: string
          rating?: number
          recommend?: boolean
          review_text?: string | null
          screenshot_path?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_order_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_reviews_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_revisions: {
        Row: {
          admin_response: string | null
          created_at: string
          deadline_at: string | null
          id: string
          order_id: string
          request_text: string
          responded_at: string | null
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          admin_response?: string | null
          created_at?: string
          deadline_at?: string | null
          id?: string
          order_id: string
          request_text: string
          responded_at?: string | null
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          admin_response?: string | null
          created_at?: string
          deadline_at?: string | null
          id?: string
          order_id?: string
          request_text?: string
          responded_at?: string | null
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_order_revisions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_revisions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_updates: {
        Row: {
          created_at: string
          id: string
          note: string | null
          order_id: string
          status_label: string
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          order_id: string
          status_label: string
          store_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          order_id?: string
          status_label?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_order_updates_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_updates_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      service_workflow_settings: {
        Row: {
          allow_cancel: boolean
          allow_reviews: boolean
          cancel_window_hours: number
          created_at: string
          default_revisions: number
          enabled_stages: string[]
          response_time: string | null
          store_id: string
          support_channels: Json
          support_email: string | null
          support_messenger: string | null
          support_phone: string | null
          support_whatsapp: string | null
          updated_at: string
        }
        Insert: {
          allow_cancel?: boolean
          allow_reviews?: boolean
          cancel_window_hours?: number
          created_at?: string
          default_revisions?: number
          enabled_stages?: string[]
          response_time?: string | null
          store_id: string
          support_channels?: Json
          support_email?: string | null
          support_messenger?: string | null
          support_phone?: string | null
          support_whatsapp?: string | null
          updated_at?: string
        }
        Update: {
          allow_cancel?: boolean
          allow_reviews?: boolean
          cancel_window_hours?: number
          created_at?: string
          default_revisions?: number
          enabled_stages?: string[]
          response_time?: string | null
          store_id?: string
          support_channels?: Json
          support_email?: string | null
          support_messenger?: string | null
          support_phone?: string | null
          support_whatsapp?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_workflow_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_activity_log: {
        Row: {
          action: string
          actor_kind: string
          actor_name: string
          actor_staff_id: string | null
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          meta: Json
          section: string
          store_id: string
          summary: string
        }
        Insert: {
          action: string
          actor_kind?: string
          actor_name?: string
          actor_staff_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          meta?: Json
          section?: string
          store_id: string
          summary: string
        }
        Update: {
          action?: string
          actor_kind?: string
          actor_name?: string
          actor_staff_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          meta?: Json
          section?: string
          store_id?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_activity_log_actor_staff_id_fkey"
            columns: ["actor_staff_id"]
            isOneToOne: false
            referencedRelation: "store_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_activity_log_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          delta: number
          id: string
          product_id: string
          qty_after: number | null
          qty_before: number | null
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
          qty_after?: number | null
          qty_before?: number | null
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
          qty_after?: number | null
          qty_before?: number | null
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
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "storefront_products"
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
      store_ai_activity_logs: {
        Row: {
          action_key: string | null
          agent_key: string | null
          created_at: string
          id: string
          level: string
          message: string
          meta: Json
          store_id: string
          thread_id: string | null
        }
        Insert: {
          action_key?: string | null
          agent_key?: string | null
          created_at?: string
          id?: string
          level?: string
          message: string
          meta?: Json
          store_id: string
          thread_id?: string | null
        }
        Update: {
          action_key?: string | null
          agent_key?: string | null
          created_at?: string
          id?: string
          level?: string
          message?: string
          meta?: Json
          store_id?: string
          thread_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_ai_activity_logs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_ai_agent_state: {
        Row: {
          agent_key: string
          config: Json
          created_at: string
          enabled: boolean
          id: string
          last_activity_at: string | null
          last_error: string | null
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          agent_key: string
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          last_activity_at?: string | null
          last_error?: string | null
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          agent_key?: string
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          last_activity_at?: string | null
          last_error?: string | null
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_ai_agent_state_store_id_fkey"
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
          ask_for_info: boolean
          created_at: string
          description: string
          enabled: boolean
          escalate_to_human: boolean
          fallback_message: string
          human_like: boolean
          id: string
          knowledge: Json
          language: string
          order_assistance: boolean
          order_flow: Json
          product_recommendations: boolean
          recommend_related: boolean
          sales_focused: boolean
          sources: Json
          store_id: string
          style: string
          updated_at: string
          use_emoji: boolean
          welcome_message: string
        }
        Insert: {
          agent_name?: string
          ask_for_info?: boolean
          created_at?: string
          description?: string
          enabled?: boolean
          escalate_to_human?: boolean
          fallback_message?: string
          human_like?: boolean
          id?: string
          knowledge?: Json
          language?: string
          order_assistance?: boolean
          order_flow?: Json
          product_recommendations?: boolean
          recommend_related?: boolean
          sales_focused?: boolean
          sources?: Json
          store_id: string
          style?: string
          updated_at?: string
          use_emoji?: boolean
          welcome_message?: string
        }
        Update: {
          agent_name?: string
          ask_for_info?: boolean
          created_at?: string
          description?: string
          enabled?: boolean
          escalate_to_human?: boolean
          fallback_message?: string
          human_like?: boolean
          id?: string
          knowledge?: Json
          language?: string
          order_assistance?: boolean
          order_flow?: Json
          product_recommendations?: boolean
          recommend_related?: boolean
          sales_focused?: boolean
          sources?: Json
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
      store_ai_call_settings: {
        Row: {
          activated_at: string | null
          agent_id: string | null
          auto_confirm_orders: boolean
          created_at: string
          feature_enabled: boolean
          gender: string
          inbound_enabled: boolean
          is_active: boolean
          last_error: string | null
          outbound_enabled: boolean
          phone_number_id: string | null
          store_id: string
          tone_id: string | null
          updated_at: string
          voice_id: string | null
        }
        Insert: {
          activated_at?: string | null
          agent_id?: string | null
          auto_confirm_orders?: boolean
          created_at?: string
          feature_enabled?: boolean
          gender?: string
          inbound_enabled?: boolean
          is_active?: boolean
          last_error?: string | null
          outbound_enabled?: boolean
          phone_number_id?: string | null
          store_id: string
          tone_id?: string | null
          updated_at?: string
          voice_id?: string | null
        }
        Update: {
          activated_at?: string | null
          agent_id?: string | null
          auto_confirm_orders?: boolean
          created_at?: string
          feature_enabled?: boolean
          gender?: string
          inbound_enabled?: boolean
          is_active?: boolean
          last_error?: string | null
          outbound_enabled?: boolean
          phone_number_id?: string | null
          store_id?: string
          tone_id?: string | null
          updated_at?: string
          voice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_ai_call_settings_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_call_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_ai_call_settings_phone_number_id_fkey"
            columns: ["phone_number_id"]
            isOneToOne: false
            referencedRelation: "ai_phone_numbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_ai_call_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_ai_call_settings_tone_id_fkey"
            columns: ["tone_id"]
            isOneToOne: false
            referencedRelation: "ai_call_tones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_ai_call_settings_voice_id_fkey"
            columns: ["voice_id"]
            isOneToOne: false
            referencedRelation: "ai_call_voices"
            referencedColumns: ["id"]
          },
        ]
      }
      store_ai_config: {
        Row: {
          created_at: string
          enabled: boolean
          gemini_api_key: string | null
          id: string
          model: string | null
          monthly_token_limit: number | null
          notes: string | null
          openai_api_key: string | null
          provider: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          gemini_api_key?: string | null
          id?: string
          model?: string | null
          monthly_token_limit?: number | null
          notes?: string | null
          openai_api_key?: string | null
          provider?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          gemini_api_key?: string | null
          id?: string
          model?: string | null
          monthly_token_limit?: number | null
          notes?: string | null
          openai_api_key?: string | null
          provider?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_ai_config_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_ai_identities: {
        Row: {
          channel: string
          created_at: string
          id: string
          identifier: string
          label: string | null
          last_seen_at: string | null
          store_id: string
          updated_at: string
          verified: boolean
          verify_code: string | null
          verify_expires_at: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          id?: string
          identifier: string
          label?: string | null
          last_seen_at?: string | null
          store_id: string
          updated_at?: string
          verified?: boolean
          verify_code?: string | null
          verify_expires_at?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          identifier?: string
          label?: string | null
          last_seen_at?: string | null
          store_id?: string
          updated_at?: string
          verified?: boolean
          verify_code?: string | null
          verify_expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_ai_identities_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_ai_notification_rules: {
        Row: {
          channels: string[]
          created_at: string
          enabled: boolean
          event_key: string
          id: string
          store_id: string
          updated_at: string
        }
        Insert: {
          channels?: string[]
          created_at?: string
          enabled?: boolean
          event_key: string
          id?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          channels?: string[]
          created_at?: string
          enabled?: boolean
          event_key?: string
          id?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_ai_notification_rules_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_ai_pending_actions: {
        Row: {
          action_key: string
          agent_key: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          error: string | null
          expires_at: string
          id: string
          payload: Json
          requested_by: string | null
          requested_via: string
          result: Json | null
          status: string
          store_id: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          action_key: string
          agent_key: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          error?: string | null
          expires_at?: string
          id?: string
          payload?: Json
          requested_by?: string | null
          requested_via?: string
          result?: Json | null
          status?: string
          store_id: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          action_key?: string
          agent_key?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          error?: string | null
          expires_at?: string
          id?: string
          payload?: Json
          requested_by?: string | null
          requested_via?: string
          result?: Json | null
          status?: string
          store_id?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_ai_pending_actions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_ai_permissions: {
        Row: {
          action_key: string
          created_at: string
          id: string
          level: string
          store_id: string
          updated_at: string
        }
        Insert: {
          action_key: string
          created_at?: string
          id?: string
          level?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          action_key?: string
          created_at?: string
          id?: string
          level?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_ai_permissions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_ai_thread_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          meta: Json
          role: string
          store_id: string
          thread_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          meta?: Json
          role: string
          store_id: string
          thread_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          meta?: Json
          role?: string
          store_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_ai_thread_messages_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_ai_thread_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "store_ai_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      store_ai_threads: {
        Row: {
          channel: string
          created_at: string
          id: string
          identity_ref: string | null
          last_message_at: string
          store_id: string
          title: string | null
        }
        Insert: {
          channel?: string
          created_at?: string
          id?: string
          identity_ref?: string | null
          last_message_at?: string
          store_id: string
          title?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          identity_ref?: string | null
          last_message_at?: string
          store_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_ai_threads_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_auth_attempts: {
        Row: {
          created_at: string
          id: string
          identifier: string
          ip: string | null
          ok: boolean
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          identifier: string
          ip?: string | null
          ok?: boolean
          store_id: string
        }
        Update: {
          created_at?: string
          id?: string
          identifier?: string
          ip?: string | null
          ok?: boolean
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_auth_attempts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_customer_addresses: {
        Row: {
          address: string
          area: string | null
          created_at: string
          customer_id: string
          id: string
          is_default: boolean
          label: string | null
          name: string | null
          phone: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          address: string
          area?: string | null
          created_at?: string
          customer_id: string
          id?: string
          is_default?: boolean
          label?: string | null
          name?: string | null
          phone?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          address?: string
          area?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          is_default?: boolean
          label?: string | null
          name?: string | null
          phone?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "store_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_customer_addresses_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_customer_counters: {
        Row: {
          created_at: string
          next_no: number
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          next_no?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          next_no?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_customer_counters_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_customer_credentials: {
        Row: {
          created_at: string
          customer_id: string
          password_hash: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          password_hash: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          password_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_customer_credentials_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "store_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      store_customer_reset_tokens: {
        Row: {
          created_at: string
          customer_id: string
          expires_at: string
          id: string
          store_id: string
          token_hash: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          expires_at: string
          id?: string
          store_id: string
          token_hash: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          expires_at?: string
          id?: string
          store_id?: string
          token_hash?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_customer_reset_tokens_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "store_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_customer_reset_tokens_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_customer_sessions: {
        Row: {
          created_at: string
          customer_id: string
          expires_at: string
          ip: string | null
          store_id: string
          token_hash: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          expires_at: string
          ip?: string | null
          store_id: string
          token_hash: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          expires_at?: string
          ip?: string | null
          store_id?: string
          token_hash?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_customer_sessions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "store_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_customer_sessions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_customers: {
        Row: {
          ai_memory: Json
          created_at: string
          customer_code: string | null
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          last_login_at: string | null
          phone: string | null
          preferred_language: string | null
          store_credit: number
          store_id: string
          updated_at: string
        }
        Insert: {
          ai_memory?: Json
          created_at?: string
          customer_code?: string | null
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          phone?: string | null
          preferred_language?: string | null
          store_credit?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          ai_memory?: Json
          created_at?: string
          customer_code?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          phone?: string | null
          preferred_language?: string | null
          store_credit?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_customers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_domains: {
        Row: {
          cf_hostname_id: string | null
          cf_ownership: Json | null
          cf_ssl_status: string | null
          cf_ssl_validation: Json | null
          cf_status: string | null
          created_at: string
          disconnect_reason: string | null
          disconnected_at: string | null
          dns_target: string | null
          hostname: string
          id: string
          is_primary: boolean
          kind: string
          landing_page_id: string | null
          last_checked_at: string | null
          last_error: string | null
          previous_state: Json | null
          release_reason: string | null
          released_at: string | null
          ssl_status: string
          status: string
          store_id: string
          updated_at: string
          verification_method: string | null
          verification_token: string
          verified_at: string | null
        }
        Insert: {
          cf_hostname_id?: string | null
          cf_ownership?: Json | null
          cf_ssl_status?: string | null
          cf_ssl_validation?: Json | null
          cf_status?: string | null
          created_at?: string
          disconnect_reason?: string | null
          disconnected_at?: string | null
          dns_target?: string | null
          hostname: string
          id?: string
          is_primary?: boolean
          kind?: string
          landing_page_id?: string | null
          last_checked_at?: string | null
          last_error?: string | null
          previous_state?: Json | null
          release_reason?: string | null
          released_at?: string | null
          ssl_status?: string
          status?: string
          store_id: string
          updated_at?: string
          verification_method?: string | null
          verification_token?: string
          verified_at?: string | null
        }
        Update: {
          cf_hostname_id?: string | null
          cf_ownership?: Json | null
          cf_ssl_status?: string | null
          cf_ssl_validation?: Json | null
          cf_status?: string | null
          created_at?: string
          disconnect_reason?: string | null
          disconnected_at?: string | null
          dns_target?: string | null
          hostname?: string
          id?: string
          is_primary?: boolean
          kind?: string
          landing_page_id?: string | null
          last_checked_at?: string | null
          last_error?: string | null
          previous_state?: Json | null
          release_reason?: string | null
          released_at?: string | null
          ssl_status?: string
          status?: string
          store_id?: string
          updated_at?: string
          verification_method?: string | null
          verification_token?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_domains_landing_page_id_fkey"
            columns: ["landing_page_id"]
            isOneToOne: false
            referencedRelation: "landing_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_domains_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_duplicate_blocks: {
        Row: {
          created_at: string
          created_order_id: string | null
          customer_id: string | null
          device_id: string | null
          fingerprint: string | null
          id: string
          matched_order_id: string | null
          matched_rules: string[]
          payload: Json
          phone: string | null
          product_ids: string[]
          psid: string | null
          resolved_at: string | null
          resolved_by: string | null
          source: string
          status: string
          store_id: string
        }
        Insert: {
          created_at?: string
          created_order_id?: string | null
          customer_id?: string | null
          device_id?: string | null
          fingerprint?: string | null
          id?: string
          matched_order_id?: string | null
          matched_rules?: string[]
          payload: Json
          phone?: string | null
          product_ids?: string[]
          psid?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source?: string
          status?: string
          store_id: string
        }
        Update: {
          created_at?: string
          created_order_id?: string | null
          customer_id?: string | null
          device_id?: string | null
          fingerprint?: string | null
          id?: string
          matched_order_id?: string | null
          matched_rules?: string[]
          payload?: Json
          phone?: string | null
          product_ids?: string[]
          psid?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source?: string
          status?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_duplicate_blocks_created_order_id_fkey"
            columns: ["created_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_duplicate_blocks_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "store_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_duplicate_blocks_matched_order_id_fkey"
            columns: ["matched_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_duplicate_blocks_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_duplicate_excluded_products: {
        Row: {
          created_at: string
          id: string
          product_id: string
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          store_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_duplicate_excluded_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_duplicate_excluded_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "storefront_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_duplicate_excluded_products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_duplicate_protection: {
        Row: {
          created_at: string
          enabled: boolean
          match_logic: string
          messenger_custom_reply: string | null
          messenger_enabled: boolean
          mode: string
          period_days: number
          rule_customer: boolean
          rule_device: boolean
          rule_fingerprint: boolean
          rule_phone: boolean
          rule_product: boolean
          rule_psid: boolean
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          match_logic?: string
          messenger_custom_reply?: string | null
          messenger_enabled?: boolean
          mode?: string
          period_days?: number
          rule_customer?: boolean
          rule_device?: boolean
          rule_fingerprint?: boolean
          rule_phone?: boolean
          rule_product?: boolean
          rule_psid?: boolean
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          match_logic?: string
          messenger_custom_reply?: string | null
          messenger_enabled?: boolean
          mode?: string
          period_days?: number
          rule_customer?: boolean
          rule_device?: boolean
          rule_fingerprint?: boolean
          rule_phone?: boolean
          rule_product?: boolean
          rule_psid?: boolean
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_duplicate_protection_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_duplicate_whitelist_customers: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          note: string | null
          phone: string | null
          store_id: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id?: string
          note?: string | null
          phone?: string | null
          store_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          note?: string | null
          phone?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_duplicate_whitelist_customers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "store_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_duplicate_whitelist_customers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_invoice_profile: {
        Row: {
          bin_vat: string | null
          business_address: string | null
          business_name: string | null
          created_at: string
          email: string | null
          logo_url: string | null
          owner_name: string | null
          phone: string | null
          refund_policy: string | null
          seal_url: string | null
          show_logo: boolean
          show_seal: boolean
          show_signature: boolean
          show_terms: boolean
          signature_url: string | null
          store_id: string
          terms: string | null
          thank_you_message: string | null
          trade_license: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          bin_vat?: string | null
          business_address?: string | null
          business_name?: string | null
          created_at?: string
          email?: string | null
          logo_url?: string | null
          owner_name?: string | null
          phone?: string | null
          refund_policy?: string | null
          seal_url?: string | null
          show_logo?: boolean
          show_seal?: boolean
          show_signature?: boolean
          show_terms?: boolean
          signature_url?: string | null
          store_id: string
          terms?: string | null
          thank_you_message?: string | null
          trade_license?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          bin_vat?: string | null
          business_address?: string | null
          business_name?: string | null
          created_at?: string
          email?: string | null
          logo_url?: string | null
          owner_name?: string | null
          phone?: string | null
          refund_policy?: string | null
          seal_url?: string | null
          show_logo?: boolean
          show_seal?: boolean
          show_signature?: boolean
          show_terms?: boolean
          signature_url?: string | null
          store_id?: string
          terms?: string | null
          thank_you_message?: string | null
          trade_license?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_invoice_profile_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_invoice_settings: {
        Row: {
          created_at: string
          include_month: boolean
          include_year: boolean
          next_number: number
          order_type: string
          padding: number
          prefix: string
          separator: string
          start_number: number
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          include_month?: boolean
          include_year?: boolean
          next_number?: number
          order_type?: string
          padding?: number
          prefix?: string
          separator?: string
          start_number?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          include_month?: boolean
          include_year?: boolean
          next_number?: number
          order_type?: string
          padding?: number
          prefix?: string
          separator?: string
          start_number?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_invoice_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_legal_info: {
        Row: {
          business_address: string
          contact_phone: string
          country: string
          created_at: string
          currency: string
          generated_at: string | null
          id: string
          owner_name: string
          pages: Json
          pages_version: number
          store_id: string
          store_name: string
          support_email: string
          updated_at: string
          website_domain: string
        }
        Insert: {
          business_address: string
          contact_phone: string
          country: string
          created_at?: string
          currency: string
          generated_at?: string | null
          id?: string
          owner_name: string
          pages?: Json
          pages_version?: number
          store_id: string
          store_name: string
          support_email: string
          updated_at?: string
          website_domain: string
        }
        Update: {
          business_address?: string
          contact_phone?: string
          country?: string
          created_at?: string
          currency?: string
          generated_at?: string | null
          id?: string
          owner_name?: string
          pages?: Json
          pages_version?: number
          store_id?: string
          store_name?: string
          support_email?: string
          updated_at?: string
          website_domain?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_legal_info_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_newsletter_subscribers: {
        Row: {
          email: string
          id: string
          store_id: string
          subscribed_at: string
        }
        Insert: {
          email: string
          id?: string
          store_id: string
          subscribed_at?: string
        }
        Update: {
          email?: string
          id?: string
          store_id?: string
          subscribed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_newsletter_subscribers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_pages: {
        Row: {
          content_html: string
          created_at: string
          id: string
          is_published: boolean
          page_key: string
          seo_description: string | null
          store_id: string
          title: string
          updated_at: string
        }
        Insert: {
          content_html?: string
          created_at?: string
          id?: string
          is_published?: boolean
          page_key: string
          seo_description?: string | null
          store_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          content_html?: string
          created_at?: string
          id?: string
          is_published?: boolean
          page_key?: string
          seo_description?: string | null
          store_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_pages_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_payment_gateways: {
        Row: {
          connected_at: string | null
          created_at: string
          credentials_ciphertext: string | null
          credentials_preview: string | null
          enabled: boolean
          id: string
          is_active: boolean
          last_test_result: Json | null
          last_tested_at: string | null
          provider_id: string
          sandbox: boolean
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          connected_at?: string | null
          created_at?: string
          credentials_ciphertext?: string | null
          credentials_preview?: string | null
          enabled?: boolean
          id?: string
          is_active?: boolean
          last_test_result?: Json | null
          last_tested_at?: string | null
          provider_id: string
          sandbox?: boolean
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          connected_at?: string | null
          created_at?: string
          credentials_ciphertext?: string | null
          credentials_preview?: string | null
          enabled?: boolean
          id?: string
          is_active?: boolean
          last_test_result?: Json | null
          last_tested_at?: string | null
          provider_id?: string
          sandbox?: boolean
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_payment_gateways_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "platform_payment_gateways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_payment_gateways_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_return_settings: {
        Row: {
          allow_exchange_other: boolean
          allow_exchange_same: boolean
          allow_return: boolean
          auto_approve_under: number | null
          auto_workflow: Json
          created_at: string
          customer_pays_difference: boolean
          eligibility_days: number
          enabled: boolean
          exchange_rules: Json
          exchange_window_days: number
          policy_note: string | null
          refund_direction: string
          refund_methods: string[]
          replacement_shipping_charge: number
          replacement_shipping_mode: string
          replacement_shipping_payer: string
          replacement_source: string
          replacement_split_customer: number
          replacement_split_store: number
          require_admin_approval: boolean
          require_courier_tracking: boolean
          require_inspection: boolean
          require_photo: boolean
          restocking_fee_type: string
          restocking_fee_value: number
          return_shipping_charge: number
          return_shipping_mode: string
          return_shipping_payer: string
          return_split_customer: number
          return_split_store: number
          store_id: string
          updated_at: string
        }
        Insert: {
          allow_exchange_other?: boolean
          allow_exchange_same?: boolean
          allow_return?: boolean
          auto_approve_under?: number | null
          auto_workflow?: Json
          created_at?: string
          customer_pays_difference?: boolean
          eligibility_days?: number
          enabled?: boolean
          exchange_rules?: Json
          exchange_window_days?: number
          policy_note?: string | null
          refund_direction?: string
          refund_methods?: string[]
          replacement_shipping_charge?: number
          replacement_shipping_mode?: string
          replacement_shipping_payer?: string
          replacement_source?: string
          replacement_split_customer?: number
          replacement_split_store?: number
          require_admin_approval?: boolean
          require_courier_tracking?: boolean
          require_inspection?: boolean
          require_photo?: boolean
          restocking_fee_type?: string
          restocking_fee_value?: number
          return_shipping_charge?: number
          return_shipping_mode?: string
          return_shipping_payer?: string
          return_split_customer?: number
          return_split_store?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          allow_exchange_other?: boolean
          allow_exchange_same?: boolean
          allow_return?: boolean
          auto_approve_under?: number | null
          auto_workflow?: Json
          created_at?: string
          customer_pays_difference?: boolean
          eligibility_days?: number
          enabled?: boolean
          exchange_rules?: Json
          exchange_window_days?: number
          policy_note?: string | null
          refund_direction?: string
          refund_methods?: string[]
          replacement_shipping_charge?: number
          replacement_shipping_mode?: string
          replacement_shipping_payer?: string
          replacement_source?: string
          replacement_split_customer?: number
          replacement_split_store?: number
          require_admin_approval?: boolean
          require_courier_tracking?: boolean
          require_inspection?: boolean
          require_photo?: boolean
          restocking_fee_type?: string
          restocking_fee_value?: number
          return_shipping_charge?: number
          return_shipping_mode?: string
          return_shipping_payer?: string
          return_split_customer?: number
          return_split_store?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_return_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_staff: {
        Row: {
          created_at: string
          created_by: string | null
          email: string | null
          employee_code: string | null
          id: string
          invited_at: string
          joined_at: string | null
          last_login_at: string | null
          must_change_password: boolean
          name: string
          notes: string | null
          permissions: Json
          phone: string | null
          role: string
          status: string
          store_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          employee_code?: string | null
          id?: string
          invited_at?: string
          joined_at?: string | null
          last_login_at?: string | null
          must_change_password?: boolean
          name: string
          notes?: string | null
          permissions?: Json
          phone?: string | null
          role?: string
          status?: string
          store_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          employee_code?: string | null
          id?: string
          invited_at?: string
          joined_at?: string | null
          last_login_at?: string | null
          must_change_password?: boolean
          name?: string
          notes?: string | null
          permissions?: Json
          phone?: string | null
          role?: string
          status?: string
          store_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_staff_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_subscription_events: {
        Row: {
          actor: string
          created_at: string
          event_type: string
          id: string
          message: string | null
          meta: Json
          store_id: string
          subscription_id: string
        }
        Insert: {
          actor?: string
          created_at?: string
          event_type: string
          id?: string
          message?: string | null
          meta?: Json
          store_id: string
          subscription_id: string
        }
        Update: {
          actor?: string
          created_at?: string
          event_type?: string
          id?: string
          message?: string | null
          meta?: Json
          store_id?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_subscription_events_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_subscription_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "store_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      store_subscription_invoices: {
        Row: {
          attempts: number
          created_at: string
          currency: string
          discount_amount: number
          due_at: string | null
          id: string
          invoice_no: string
          is_renewal: boolean
          order_id: string | null
          paid_at: string | null
          pay_token: string
          payment_method: string | null
          period_end: string | null
          period_start: string | null
          plan_amount: number
          setup_fee: number
          status: string
          store_id: string
          subscription_id: string
          tax_amount: number
          total: number
          txn_id: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          currency?: string
          discount_amount?: number
          due_at?: string | null
          id?: string
          invoice_no: string
          is_renewal?: boolean
          order_id?: string | null
          paid_at?: string | null
          pay_token?: string
          payment_method?: string | null
          period_end?: string | null
          period_start?: string | null
          plan_amount?: number
          setup_fee?: number
          status?: string
          store_id: string
          subscription_id: string
          tax_amount?: number
          total?: number
          txn_id?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          currency?: string
          discount_amount?: number
          due_at?: string | null
          id?: string
          invoice_no?: string
          is_renewal?: boolean
          order_id?: string | null
          paid_at?: string | null
          pay_token?: string
          payment_method?: string | null
          period_end?: string | null
          period_start?: string | null
          plan_amount?: number
          setup_fee?: number
          status?: string
          store_id?: string
          subscription_id?: string
          tax_amount?: number
          total?: number
          txn_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_subscription_invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_subscription_invoices_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_subscription_invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "store_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      store_subscription_notifications: {
        Row: {
          channel: string
          created_at: string
          error: string | null
          id: string
          kind: string
          payload: Json
          recipient: string | null
          sent_at: string | null
          store_id: string
          subscription_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          kind: string
          payload?: Json
          recipient?: string | null
          sent_at?: string | null
          store_id: string
          subscription_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          payload?: Json
          recipient?: string | null
          sent_at?: string | null
          store_id?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_subscription_notifications_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_subscription_notifications_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "store_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      store_subscription_settings: {
        Row: {
          allow_free_trial: boolean
          auto_renew_default: boolean
          cancellation_policy: string | null
          cod_enabled: boolean
          created_at: string
          default_billing_cycle: string
          failed_payment_retry: number
          grace_period_days: number
          invoice_prefix: string
          invoice_template_id: string | null
          notify_email: boolean
          notify_sms: boolean
          notify_whatsapp: boolean
          payment_methods: string[]
          refund_policy: string | null
          renewal_reminder_days: number
          setup_fee: number
          store_id: string
          subscription_terms: string | null
          success_redirect_url: string | null
          tax_percent: number
          trial_days: number
          updated_at: string
        }
        Insert: {
          allow_free_trial?: boolean
          auto_renew_default?: boolean
          cancellation_policy?: string | null
          cod_enabled?: boolean
          created_at?: string
          default_billing_cycle?: string
          failed_payment_retry?: number
          grace_period_days?: number
          invoice_prefix?: string
          invoice_template_id?: string | null
          notify_email?: boolean
          notify_sms?: boolean
          notify_whatsapp?: boolean
          payment_methods?: string[]
          refund_policy?: string | null
          renewal_reminder_days?: number
          setup_fee?: number
          store_id: string
          subscription_terms?: string | null
          success_redirect_url?: string | null
          tax_percent?: number
          trial_days?: number
          updated_at?: string
        }
        Update: {
          allow_free_trial?: boolean
          auto_renew_default?: boolean
          cancellation_policy?: string | null
          cod_enabled?: boolean
          created_at?: string
          default_billing_cycle?: string
          failed_payment_retry?: number
          grace_period_days?: number
          invoice_prefix?: string
          invoice_template_id?: string | null
          notify_email?: boolean
          notify_sms?: boolean
          notify_whatsapp?: boolean
          payment_methods?: string[]
          refund_policy?: string | null
          renewal_reminder_days?: number
          setup_fee?: number
          store_id?: string
          subscription_terms?: string | null
          success_redirect_url?: string | null
          tax_percent?: number
          trial_days?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_subscription_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_subscriptions: {
        Row: {
          activated_at: string | null
          admin_note: string | null
          auto_renew: boolean
          billing_cycle: string
          cancel_at_period_end: boolean
          cancelled_at: string | null
          created_at: string
          currency: string
          current_period_end: string | null
          current_period_start: string | null
          custom_cycle_days: number | null
          customer_company: string | null
          customer_country: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          customer_notes: string | null
          customer_phone: string | null
          customer_vat: string | null
          device_limit: number | null
          discount_amount: number
          expires_at: string | null
          id: string
          license_qty: number | null
          next_billing_date: string | null
          order_id: string | null
          payment_method: string | null
          plan_name: string
          plan_snapshot: Json
          price: number
          product_id: string | null
          reminders_opt_in: boolean
          renewal_price: number
          setup_fee: number
          started_at: string | null
          status: string
          store_id: string
          subscription_no: string
          tax_amount: number
          trial_ends_at: string | null
          updated_at: string
          user_limit: number | null
        }
        Insert: {
          activated_at?: string | null
          admin_note?: string | null
          auto_renew?: boolean
          billing_cycle?: string
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          created_at?: string
          currency?: string
          current_period_end?: string | null
          current_period_start?: string | null
          custom_cycle_days?: number | null
          customer_company?: string | null
          customer_country?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_notes?: string | null
          customer_phone?: string | null
          customer_vat?: string | null
          device_limit?: number | null
          discount_amount?: number
          expires_at?: string | null
          id?: string
          license_qty?: number | null
          next_billing_date?: string | null
          order_id?: string | null
          payment_method?: string | null
          plan_name: string
          plan_snapshot?: Json
          price?: number
          product_id?: string | null
          reminders_opt_in?: boolean
          renewal_price?: number
          setup_fee?: number
          started_at?: string | null
          status?: string
          store_id: string
          subscription_no: string
          tax_amount?: number
          trial_ends_at?: string | null
          updated_at?: string
          user_limit?: number | null
        }
        Update: {
          activated_at?: string | null
          admin_note?: string | null
          auto_renew?: boolean
          billing_cycle?: string
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          created_at?: string
          currency?: string
          current_period_end?: string | null
          current_period_start?: string | null
          custom_cycle_days?: number | null
          customer_company?: string | null
          customer_country?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_notes?: string | null
          customer_phone?: string | null
          customer_vat?: string | null
          device_limit?: number | null
          discount_amount?: number
          expires_at?: string | null
          id?: string
          license_qty?: number | null
          next_billing_date?: string | null
          order_id?: string | null
          payment_method?: string | null
          plan_name?: string
          plan_snapshot?: Json
          price?: number
          product_id?: string | null
          reminders_opt_in?: boolean
          renewal_price?: number
          setup_fee?: number
          started_at?: string | null
          status?: string
          store_id?: string
          subscription_no?: string
          tax_amount?: number
          trial_ends_at?: string | null
          updated_at?: string
          user_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "store_subscriptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "store_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_subscriptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_subscriptions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_subscriptions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "storefront_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_subscriptions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_template: {
        Row: {
          all_category_image_url: string | null
          banners: Json
          button_color: string | null
          categories: Json
          created_at: string
          delivery: Json
          description: string | null
          footer_color: string | null
          header_color: string | null
          id: string
          marketing: Json
          order_confirmation: Json
          pages: Json
          payments_config: Json
          primary_color: string | null
          product_defaults: Json
          products: Json
          seo: Json
          storefront_default_lang: string
          storefront_lang_switcher: boolean
          theme: Json
          title_bar_color: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          all_category_image_url?: string | null
          banners?: Json
          button_color?: string | null
          categories?: Json
          created_at?: string
          delivery?: Json
          description?: string | null
          footer_color?: string | null
          header_color?: string | null
          id: string
          marketing?: Json
          order_confirmation?: Json
          pages?: Json
          payments_config?: Json
          primary_color?: string | null
          product_defaults?: Json
          products?: Json
          seo?: Json
          storefront_default_lang?: string
          storefront_lang_switcher?: boolean
          theme?: Json
          title_bar_color?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          all_category_image_url?: string | null
          banners?: Json
          button_color?: string | null
          categories?: Json
          created_at?: string
          delivery?: Json
          description?: string | null
          footer_color?: string | null
          header_color?: string | null
          id?: string
          marketing?: Json
          order_confirmation?: Json
          pages?: Json
          payments_config?: Json
          primary_color?: string | null
          product_defaults?: Json
          products?: Json
          seo?: Json
          storefront_default_lang?: string
          storefront_lang_switcher?: boolean
          theme?: Json
          title_bar_color?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      store_themes: {
        Row: {
          category: string
          created_at: string
          definition: Json
          description: string | null
          id: string
          is_default: boolean
          locked: Json
          name: string
          preview_url: string | null
          slug: string
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          definition?: Json
          description?: string | null
          id?: string
          is_default?: boolean
          locked?: Json
          name: string
          preview_url?: string | null
          slug: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          definition?: Json
          description?: string | null
          id?: string
          is_default?: boolean
          locked?: Json
          name?: string
          preview_url?: string | null
          slug?: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      stores: {
        Row: {
          address: string | null
          all_category_image_url: string | null
          allow_guest_checkout: boolean
          bkash_number: string | null
          branding: Json
          business_hours: string | null
          business_name: string | null
          button_color: string | null
          couriers: Json
          created_at: string
          currency: string
          custom_favicon_url: string | null
          delivery: Json
          description: string | null
          email: string | null
          expires_at: string | null
          facebook: string | null
          favicon_url: string | null
          footer_color: string | null
          header_color: string | null
          icon_url: string | null
          id: string
          instagram: string | null
          language: string
          last_renewed_at: string | null
          linkedin: string | null
          logo_url: string | null
          marketing: Json
          merchant_code: string
          messenger: string | null
          nagad_number: string | null
          name: string
          name_logo_url: string | null
          notifications: Json
          order_confirmation: Json
          owner_name: string | null
          owner_user_id: string
          package_id: string | null
          payments_config: Json
          phone: string | null
          pinterest: string | null
          primary_color: string
          primary_domain_id: string | null
          product_defaults: Json
          require_customer_login: boolean
          seo: Json
          slug: string
          snapchat: string | null
          status: Database["public"]["Enums"]["store_status"]
          store_mode_changed_at: string | null
          storefront_default_lang: string
          storefront_lang_switcher: boolean
          subdomain_release_reason: string | null
          subdomain_released_at: string | null
          subscription_status: string
          tax_number: string | null
          telegram: string | null
          template_version: string | null
          theme: Json
          theme_draft: Json
          theme_id: string | null
          theme_overrides: Json
          threads: string | null
          tiktok: string | null
          timezone: string
          title_bar_color: string | null
          trade_license: string | null
          trial_ends_at: string | null
          twitter: string | null
          updated_at: string
          use_icon_as_favicon: boolean
          website: string | null
          whatsapp: string | null
          youtube: string | null
        }
        Insert: {
          address?: string | null
          all_category_image_url?: string | null
          allow_guest_checkout?: boolean
          bkash_number?: string | null
          branding?: Json
          business_hours?: string | null
          business_name?: string | null
          button_color?: string | null
          couriers?: Json
          created_at?: string
          currency?: string
          custom_favicon_url?: string | null
          delivery?: Json
          description?: string | null
          email?: string | null
          expires_at?: string | null
          facebook?: string | null
          favicon_url?: string | null
          footer_color?: string | null
          header_color?: string | null
          icon_url?: string | null
          id?: string
          instagram?: string | null
          language?: string
          last_renewed_at?: string | null
          linkedin?: string | null
          logo_url?: string | null
          marketing?: Json
          merchant_code?: string
          messenger?: string | null
          nagad_number?: string | null
          name: string
          name_logo_url?: string | null
          notifications?: Json
          order_confirmation?: Json
          owner_name?: string | null
          owner_user_id: string
          package_id?: string | null
          payments_config?: Json
          phone?: string | null
          pinterest?: string | null
          primary_color?: string
          primary_domain_id?: string | null
          product_defaults?: Json
          require_customer_login?: boolean
          seo?: Json
          slug: string
          snapchat?: string | null
          status?: Database["public"]["Enums"]["store_status"]
          store_mode_changed_at?: string | null
          storefront_default_lang?: string
          storefront_lang_switcher?: boolean
          subdomain_release_reason?: string | null
          subdomain_released_at?: string | null
          subscription_status?: string
          tax_number?: string | null
          telegram?: string | null
          template_version?: string | null
          theme?: Json
          theme_draft?: Json
          theme_id?: string | null
          theme_overrides?: Json
          threads?: string | null
          tiktok?: string | null
          timezone?: string
          title_bar_color?: string | null
          trade_license?: string | null
          trial_ends_at?: string | null
          twitter?: string | null
          updated_at?: string
          use_icon_as_favicon?: boolean
          website?: string | null
          whatsapp?: string | null
          youtube?: string | null
        }
        Update: {
          address?: string | null
          all_category_image_url?: string | null
          allow_guest_checkout?: boolean
          bkash_number?: string | null
          branding?: Json
          business_hours?: string | null
          business_name?: string | null
          button_color?: string | null
          couriers?: Json
          created_at?: string
          currency?: string
          custom_favicon_url?: string | null
          delivery?: Json
          description?: string | null
          email?: string | null
          expires_at?: string | null
          facebook?: string | null
          favicon_url?: string | null
          footer_color?: string | null
          header_color?: string | null
          icon_url?: string | null
          id?: string
          instagram?: string | null
          language?: string
          last_renewed_at?: string | null
          linkedin?: string | null
          logo_url?: string | null
          marketing?: Json
          merchant_code?: string
          messenger?: string | null
          nagad_number?: string | null
          name?: string
          name_logo_url?: string | null
          notifications?: Json
          order_confirmation?: Json
          owner_name?: string | null
          owner_user_id?: string
          package_id?: string | null
          payments_config?: Json
          phone?: string | null
          pinterest?: string | null
          primary_color?: string
          primary_domain_id?: string | null
          product_defaults?: Json
          require_customer_login?: boolean
          seo?: Json
          slug?: string
          snapchat?: string | null
          status?: Database["public"]["Enums"]["store_status"]
          store_mode_changed_at?: string | null
          storefront_default_lang?: string
          storefront_lang_switcher?: boolean
          subdomain_release_reason?: string | null
          subdomain_released_at?: string | null
          subscription_status?: string
          tax_number?: string | null
          telegram?: string | null
          template_version?: string | null
          theme?: Json
          theme_draft?: Json
          theme_id?: string | null
          theme_overrides?: Json
          threads?: string | null
          tiktok?: string | null
          timezone?: string
          title_bar_color?: string | null
          trade_license?: string | null
          trial_ends_at?: string | null
          twitter?: string | null
          updated_at?: string
          use_icon_as_favicon?: boolean
          website?: string | null
          whatsapp?: string | null
          youtube?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stores_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "subscription_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stores_primary_domain_id_fkey"
            columns: ["primary_domain_id"]
            isOneToOne: false
            referencedRelation: "store_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stores_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "store_themes"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_coupon_redemptions: {
        Row: {
          amount_off: number
          coupon_id: string
          id: string
          invoice_id: string
          redeemed_at: string
          user_id: string
        }
        Insert: {
          amount_off?: number
          coupon_id: string
          id?: string
          invoice_id: string
          redeemed_at?: string
          user_id: string
        }
        Update: {
          amount_off?: number
          coupon_id?: string
          id?: string
          invoice_id?: string
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "subscription_coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_coupon_redemptions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "subscription_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_coupons: {
        Row: {
          active: boolean
          applies_to_cycles: string[]
          applies_to_packages: string[]
          code: string
          created_at: string
          expires_at: string | null
          id: string
          min_amount: number
          starts_at: string | null
          type: string
          updated_at: string
          usage_limit: number | null
          used_count: number
          value: number
        }
        Insert: {
          active?: boolean
          applies_to_cycles?: string[]
          applies_to_packages?: string[]
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          min_amount?: number
          starts_at?: string | null
          type: string
          updated_at?: string
          usage_limit?: number | null
          used_count?: number
          value: number
        }
        Update: {
          active?: boolean
          applies_to_cycles?: string[]
          applies_to_packages?: string[]
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          min_amount?: number
          starts_at?: string | null
          type?: string
          updated_at?: string
          usage_limit?: number | null
          used_count?: number
          value?: number
        }
        Relationships: []
      }
      subscription_invoices: {
        Row: {
          amount: number
          billing_cycle: string
          coupon_id: string | null
          created_at: string
          currency: string
          discount: number
          id: string
          invoice_no: string
          issued_at: string
          package_id: string | null
          paid_at: string | null
          pdf_path: string | null
          purpose: string
          status: string
          store_id: string | null
          tax: number
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          billing_cycle: string
          coupon_id?: string | null
          created_at?: string
          currency?: string
          discount?: number
          id?: string
          invoice_no: string
          issued_at?: string
          package_id?: string | null
          paid_at?: string | null
          pdf_path?: string | null
          purpose?: string
          status?: string
          store_id?: string | null
          tax?: number
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          billing_cycle?: string
          coupon_id?: string | null
          created_at?: string
          currency?: string
          discount?: number
          id?: string
          invoice_no?: string
          issued_at?: string
          package_id?: string | null
          paid_at?: string | null
          pdf_path?: string | null
          purpose?: string
          status?: string
          store_id?: string | null
          tax?: number
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_invoices_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "subscription_coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_invoices_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "subscription_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_invoices_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
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
          landing_page_limit: number
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
          landing_page_limit?: number
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
          landing_page_limit?: number
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
      subscription_payment_providers: {
        Row: {
          created_at: string
          credentials: Json
          enabled: boolean
          id: string
          is_active: boolean
          label: string
          last_tested_at: string | null
          latency_ms: number | null
          sandbox: boolean
          status: string | null
          status_message: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          credentials?: Json
          enabled?: boolean
          id: string
          is_active?: boolean
          label: string
          last_tested_at?: string | null
          latency_ms?: number | null
          sandbox?: boolean
          status?: string | null
          status_message?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          credentials?: Json
          enabled?: boolean
          id?: string
          is_active?: boolean
          label?: string
          last_tested_at?: string | null
          latency_ms?: number | null
          sandbox?: boolean
          status?: string | null
          status_message?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      subscription_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string | null
          method: string | null
          provider_id: string | null
          provider_ref: string | null
          raw: Json | null
          sandbox: boolean
          status: string
          verified_at: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string | null
          method?: string | null
          provider_id?: string | null
          provider_ref?: string | null
          raw?: Json | null
          sandbox?: boolean
          status?: string
          verified_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string | null
          method?: string | null
          provider_id?: string | null
          provider_ref?: string | null
          raw?: Json | null
          sandbox?: boolean
          status?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "subscription_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_transactions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "subscription_payment_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          id: string
          priority: string
          status: string
          store_id: string | null
          subject: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          priority?: string
          status?: string
          store_id?: string | null
          subject: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          priority?: string
          status?: string
          store_id?: string | null
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      ticket_messages: {
        Row: {
          author_user_id: string | null
          body: string
          created_at: string
          id: string
          is_internal: boolean
          ticket_id: string
        }
        Insert: {
          author_user_id?: string | null
          body: string
          created_at?: string
          id?: string
          is_internal?: boolean
          ticket_id: string
        }
        Update: {
          author_user_id?: string | null
          body?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
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
      voice_audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json
          store_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json
          store_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json
          store_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_audit_log_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_automation_settings: {
        Row: {
          auto_call_enabled: boolean
          business_hours_only: boolean
          call_immediately: boolean
          call_rate_per_min: number | null
          cancel_audio_url: string | null
          cancel_text: string | null
          confirm_audio_url: string | null
          confirm_text: string | null
          created_at: string
          delay_minutes: number
          hours_from: string
          hours_to: string
          main_audio_url: string | null
          manual_calling_enabled: boolean
          messages: Json
          press2_action: string
          representative_transfer: boolean
          retry_count: number
          retry_delay_minutes: number
          retry_on_no_answer: boolean
          retry_on_no_keypress: boolean
          sms_on_confirm: boolean
          store_id: string
          tts_template: string | null
          updated_at: string
        }
        Insert: {
          auto_call_enabled?: boolean
          business_hours_only?: boolean
          call_immediately?: boolean
          call_rate_per_min?: number | null
          cancel_audio_url?: string | null
          cancel_text?: string | null
          confirm_audio_url?: string | null
          confirm_text?: string | null
          created_at?: string
          delay_minutes?: number
          hours_from?: string
          hours_to?: string
          main_audio_url?: string | null
          manual_calling_enabled?: boolean
          messages?: Json
          press2_action?: string
          representative_transfer?: boolean
          retry_count?: number
          retry_delay_minutes?: number
          retry_on_no_answer?: boolean
          retry_on_no_keypress?: boolean
          sms_on_confirm?: boolean
          store_id: string
          tts_template?: string | null
          updated_at?: string
        }
        Update: {
          auto_call_enabled?: boolean
          business_hours_only?: boolean
          call_immediately?: boolean
          call_rate_per_min?: number | null
          cancel_audio_url?: string | null
          cancel_text?: string | null
          confirm_audio_url?: string | null
          confirm_text?: string | null
          created_at?: string
          delay_minutes?: number
          hours_from?: string
          hours_to?: string
          main_audio_url?: string | null
          manual_calling_enabled?: boolean
          messages?: Json
          press2_action?: string
          representative_transfer?: boolean
          retry_count?: number
          retry_delay_minutes?: number
          retry_on_no_answer?: boolean
          retry_on_no_keypress?: boolean
          sms_on_confirm?: boolean
          store_id?: string
          tts_template?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_automation_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_call_events: {
        Row: {
          call_id: string | null
          created_at: string
          id: string
          payload: Json
          provider: string
          provider_event_id: string
          store_id: string
        }
        Insert: {
          call_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          provider: string
          provider_event_id: string
          store_id: string
        }
        Update: {
          call_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          provider?: string
          provider_event_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_call_events_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_call_queue: {
        Row: {
          attempt: number
          call_id: string | null
          cancel_reason: string | null
          created_at: string
          id: string
          last_error: string | null
          order_id: string
          run_at: string
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          attempt?: number
          call_id?: string | null
          cancel_reason?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          order_id: string
          run_at?: string
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          attempt?: number
          call_id?: string | null
          cancel_reason?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          order_id?: string
          run_at?: string
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_call_queue_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_call_queue_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_provider_connections: {
        Row: {
          account_id: string | null
          account_info: Json
          connected_at: string | null
          created_at: string
          default_caller_id: string | null
          default_extension: string | null
          encrypted_token: string | null
          id: string
          last_error: string | null
          last_tested_at: string | null
          provider: string
          status: string
          store_id: string
          token_preview: string | null
          updated_at: string
          webhook_secret_hash: string | null
        }
        Insert: {
          account_id?: string | null
          account_info?: Json
          connected_at?: string | null
          created_at?: string
          default_caller_id?: string | null
          default_extension?: string | null
          encrypted_token?: string | null
          id?: string
          last_error?: string | null
          last_tested_at?: string | null
          provider: string
          status?: string
          store_id: string
          token_preview?: string | null
          updated_at?: string
          webhook_secret_hash?: string | null
        }
        Update: {
          account_id?: string | null
          account_info?: Json
          connected_at?: string | null
          created_at?: string
          default_caller_id?: string | null
          default_extension?: string | null
          encrypted_token?: string | null
          id?: string
          last_error?: string | null
          last_tested_at?: string | null
          provider?: string
          status?: string
          store_id?: string
          token_preview?: string | null
          updated_at?: string
          webhook_secret_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_provider_connections_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          id: string
          invoice_id: string | null
          note: string | null
          reference: string | null
          status: string
          type: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          id?: string
          invoice_id?: string | null
          note?: string | null
          reference?: string | null
          status?: string
          type: string
          user_id: string
          wallet_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          id?: string
          invoice_id?: string | null
          note?: string | null
          reference?: string | null
          status?: string
          type?: string
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "subscription_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "merchant_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          created_at: string
          event: string
          id: string
          is_active: boolean
          last_delivery_at: string | null
          last_status: number | null
          name: string
          secret: string | null
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          is_active?: boolean
          last_delivery_at?: string | null
          last_status?: number | null
          name: string
          secret?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          is_active?: boolean
          last_delivery_at?: string | null
          last_status?: number | null
          name?: string
          secret?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      whatsapp_integrations: {
        Row: {
          access_token_encrypted: string | null
          ai_auto_reply: boolean
          app_secret_encrypted: string | null
          compact_memory: boolean
          connected_at: string | null
          conversation_history: boolean
          created_at: string
          delivery_failures: number
          display_name: string | null
          faq_reply: boolean
          human_takeover: boolean
          id: string
          last_error: string | null
          last_verified_at: string | null
          last_webhook_at: string | null
          last_webhook_error: string | null
          last_webhook_type: string | null
          order_detection: boolean
          permissions: Json
          phone_number: string | null
          phone_number_id: string | null
          product_recommendation: boolean
          quality_rating: string | null
          status: string
          store_id: string
          updated_at: string
          verify_token: string
          waba_id: string | null
        }
        Insert: {
          access_token_encrypted?: string | null
          ai_auto_reply?: boolean
          app_secret_encrypted?: string | null
          compact_memory?: boolean
          connected_at?: string | null
          conversation_history?: boolean
          created_at?: string
          delivery_failures?: number
          display_name?: string | null
          faq_reply?: boolean
          human_takeover?: boolean
          id?: string
          last_error?: string | null
          last_verified_at?: string | null
          last_webhook_at?: string | null
          last_webhook_error?: string | null
          last_webhook_type?: string | null
          order_detection?: boolean
          permissions?: Json
          phone_number?: string | null
          phone_number_id?: string | null
          product_recommendation?: boolean
          quality_rating?: string | null
          status?: string
          store_id: string
          updated_at?: string
          verify_token?: string
          waba_id?: string | null
        }
        Update: {
          access_token_encrypted?: string | null
          ai_auto_reply?: boolean
          app_secret_encrypted?: string | null
          compact_memory?: boolean
          connected_at?: string | null
          conversation_history?: boolean
          created_at?: string
          delivery_failures?: number
          display_name?: string | null
          faq_reply?: boolean
          human_takeover?: boolean
          id?: string
          last_error?: string | null
          last_verified_at?: string | null
          last_webhook_at?: string | null
          last_webhook_error?: string | null
          last_webhook_type?: string | null
          order_detection?: boolean
          permissions?: Json
          phone_number?: string | null
          phone_number_id?: string | null
          product_recommendation?: boolean
          quality_rating?: string | null
          status?: string
          store_id?: string
          updated_at?: string
          verify_token?: string
          waba_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_integrations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_jobs: {
        Row: {
          attempts: number
          available_at: string
          completed_at: string | null
          conversation_id: string | null
          created_at: string
          event_payload: Json
          id: string
          integration_id: string
          last_error: string | null
          merged_into: string | null
          message_id: string
          phone_number_id: string
          processing_ms: number | null
          received_at: string | null
          reply_text: string | null
          route: string | null
          sender_id: string
          started_at: string | null
          status: string
          store_id: string
          timings: Json | null
          trace_id: string | null
          updated_at: string
          wake_token: string
        }
        Insert: {
          attempts?: number
          available_at?: string
          completed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          event_payload?: Json
          id?: string
          integration_id: string
          last_error?: string | null
          merged_into?: string | null
          message_id: string
          phone_number_id: string
          processing_ms?: number | null
          received_at?: string | null
          reply_text?: string | null
          route?: string | null
          sender_id: string
          started_at?: string | null
          status?: string
          store_id: string
          timings?: Json | null
          trace_id?: string | null
          updated_at?: string
          wake_token?: string
        }
        Update: {
          attempts?: number
          available_at?: string
          completed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          event_payload?: Json
          id?: string
          integration_id?: string
          last_error?: string | null
          merged_into?: string | null
          message_id?: string
          phone_number_id?: string
          processing_ms?: number | null
          received_at?: string | null
          reply_text?: string | null
          route?: string | null
          sender_id?: string
          started_at?: string | null
          status?: string
          store_id?: string
          timings?: Json | null
          trace_id?: string | null
          updated_at?: string
          wake_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_jobs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_jobs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          body_preview: string | null
          category: string | null
          created_at: string
          id: string
          language: string
          name: string
          status: string
          store_id: string
          synced_at: string
          template_id: string | null
          updated_at: string
        }
        Insert: {
          body_preview?: string | null
          category?: string | null
          created_at?: string
          id?: string
          language?: string
          name: string
          status?: string
          store_id: string
          synced_at?: string
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          body_preview?: string | null
          category?: string | null
          created_at?: string
          id?: string
          language?: string
          name?: string
          status?: string
          store_id?: string
          synced_at?: string
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_templates_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_webhook_events: {
        Row: {
          error: string | null
          event_type: string
          external_id: string | null
          id: string
          payload: Json | null
          phone_number_id: string | null
          received_at: string
          store_id: string | null
        }
        Insert: {
          error?: string | null
          event_type: string
          external_id?: string | null
          id?: string
          payload?: Json | null
          phone_number_id?: string | null
          received_at?: string
          store_id?: string | null
        }
        Update: {
          error?: string | null
          event_type?: string
          external_id?: string | null
          id?: string
          payload?: Json | null
          phone_number_id?: string | null
          received_at?: string
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_webhook_events_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      storefront_products: {
        Row: {
          brand: string | null
          category_id: string | null
          created_at: string | null
          delivery_charge: number | null
          delivery_time_days: string | null
          description: string | null
          features: Json | null
          gallery: Json | null
          id: string | null
          is_featured: boolean | null
          meta: Json | null
          name: string | null
          old_price: number | null
          price: number | null
          primary_image_url: string | null
          product_type: string | null
          rating: number | null
          related_product_ids: string[] | null
          return_policy: string | null
          shipping_info: string | null
          short_description: string | null
          sku: string | null
          slug: string | null
          specifications: Json | null
          status: Database["public"]["Enums"]["product_status"] | null
          stock: number | null
          store_id: string | null
          total_sold: number | null
          updated_at: string | null
          variants: Json | null
          video_url: string | null
          warranty: string | null
        }
        Insert: {
          brand?: string | null
          category_id?: string | null
          created_at?: string | null
          delivery_charge?: number | null
          delivery_time_days?: string | null
          description?: string | null
          features?: Json | null
          gallery?: Json | null
          id?: string | null
          is_featured?: boolean | null
          meta?: Json | null
          name?: string | null
          old_price?: number | null
          price?: number | null
          primary_image_url?: string | null
          product_type?: string | null
          rating?: number | null
          related_product_ids?: string[] | null
          return_policy?: string | null
          shipping_info?: string | null
          short_description?: string | null
          sku?: string | null
          slug?: string | null
          specifications?: Json | null
          status?: Database["public"]["Enums"]["product_status"] | null
          stock?: number | null
          store_id?: string | null
          total_sold?: number | null
          updated_at?: string | null
          variants?: Json | null
          video_url?: string | null
          warranty?: string | null
        }
        Update: {
          brand?: string | null
          category_id?: string | null
          created_at?: string | null
          delivery_charge?: number | null
          delivery_time_days?: string | null
          description?: string | null
          features?: Json | null
          gallery?: Json | null
          id?: string | null
          is_featured?: boolean | null
          meta?: Json | null
          name?: string | null
          old_price?: number | null
          price?: number | null
          primary_image_url?: string | null
          product_type?: string | null
          rating?: number | null
          related_product_ids?: string[] | null
          return_policy?: string | null
          shipping_info?: string | null
          short_description?: string | null
          sku?: string | null
          slug?: string | null
          specifications?: Json | null
          status?: Database["public"]["Enums"]["product_status"] | null
          stock?: number | null
          store_id?: string | null
          total_sold?: number | null
          updated_at?: string | null
          variants?: Json | null
          video_url?: string | null
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
    }
    Functions: {
      _default_invoice_prefix: { Args: { _name: string }; Returns: string }
      _new_session_token: {
        Args: {
          _customer_id: string
          _ip: string
          _store_id: string
          _ua: string
        }
        Returns: string
      }
      _normalize_phone: { Args: { _phone: string }; Returns: string }
      claim_messenger_job: {
        Args: { _job_id: string; _wake_token: string }
        Returns: Json
      }
      claim_whatsapp_job: {
        Args: { _job_id: string; _wake_token: string }
        Returns: Json
      }
      create_chat_order: {
        Args: {
          _idem_key: string
          _items: Json
          _order: Json
          _store_id: string
        }
        Returns: Json
      }
      customer_change_password: {
        Args: { _new: string; _old: string; _store_id: string; _token: string }
        Returns: Json
      }
      customer_create_return: {
        Args: {
          _images: string[]
          _items: Json
          _note: string
          _order_id: string
          _reason: string
          _replacement_note: string
          _store_id: string
          _token: string
          _type: string
        }
        Returns: Json
      }
      customer_create_return_v2: {
        Args: {
          _amounts: Json
          _images: string[]
          _kind: string
          _lines: Json
          _note: string
          _order_id: string
          _reason: string
          _replacement_items: Json
          _store_id: string
          _token: string
          _type: string
        }
        Returns: Json
      }
      customer_from_token: {
        Args: { _store_id: string; _token: string }
        Returns: Json
      }
      customer_list_returns: {
        Args: { _order_id: string; _store_id: string; _token: string }
        Returns: Json
      }
      customer_list_returns_v2: {
        Args: { _order_id: string; _store_id: string; _token: string }
        Returns: Json
      }
      customer_login: {
        Args: {
          _identifier: string
          _ip: string
          _password: string
          _store_id: string
          _ua: string
        }
        Returns: Json
      }
      customer_logout: { Args: { _token: string }; Returns: undefined }
      customer_request_password_reset: {
        Args: { _identifier: string; _store_id: string }
        Returns: Json
      }
      customer_reset_password: {
        Args: { _new: string; _store_id: string; _token: string }
        Returns: Json
      }
      customer_signup: {
        Args: {
          _email: string
          _ip: string
          _name: string
          _password: string
          _phone: string
          _store_id: string
          _ua: string
        }
        Returns: Json
      }
      customer_update_profile: {
        Args: {
          _email: string
          _name: string
          _phone: string
          _store_id: string
          _token: string
        }
        Returns: Json
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      domain_token_exists: { Args: { _token: string }; Returns: boolean }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      expire_due_subscriptions: { Args: never; Returns: undefined }
      expire_trials: { Args: never; Returns: undefined }
      format_merchant_code: { Args: { _n: number }; Returns: string }
      generate_invoice_no: {
        Args: { _order_type?: string; _store_id: string }
        Returns: string
      }
      get_active_store_gateway_public: {
        Args: { _store_id: string }
        Returns: Json
      }
      get_billing_discounts: { Args: never; Returns: Json }
      get_custom_gateway_public: { Args: { _id: string }; Returns: Json }
      get_customer_subscriptions: {
        Args: { _store_id: string; _token: string }
        Returns: Json
      }
      get_fraud_public_status: { Args: never; Returns: Json }
      get_messenger_daily_stats: { Args: { _store_id: string }; Returns: Json }
      get_my_active_ads: { Args: never; Returns: Json }
      get_platform_branding: { Args: never; Returns: Json }
      get_platform_footer: { Args: never; Returns: Json }
      get_product_reviews: { Args: { _product_id: string }; Returns: Json }
      get_public_courier_providers: {
        Args: never
        Returns: {
          brand_color: string
          code: string
          dark_logo_url: string
          description: string
          docs_url: string
          favicon_url: string
          icon_bg_color: string
          is_active: boolean
          logo_url: string
          name: string
          secondary_color: string
          sort_order: number
          support_url: string
          website_url: string
          wordmark_url: string
        }[]
      }
      get_public_delivery_zones: {
        Args: { _store_id: string }
        Returns: {
          charge: number
          eta: string
          id: string
          is_default: boolean
          name: string
          sort_order: number
        }[]
      }
      get_public_landing_page: { Args: { _slug: string }; Returns: Json }
      get_public_order: { Args: { _order_id: string }; Returns: Json }
      get_public_payment_gateways: {
        Args: never
        Returns: {
          brand_color: string
          description: string
          enabled: boolean
          icon_bg_color: string
          id: string
          label: string
          logo_url: string
          secondary_color: string
          sort_order: number
        }[]
      }
      get_public_return_settings: { Args: { _store_id: string }; Returns: Json }
      get_public_service_order: { Args: { _order_id: string }; Returns: Json }
      get_public_store_by_slug: { Args: { _slug: string }; Returns: Json }
      get_public_subscription_order: {
        Args: { _order_id: string }
        Returns: Json
      }
      get_store_bestsellers: {
        Args: { _limit?: number; _store_id: string }
        Returns: {
          product_id: string
          total_qty: number
        }[]
      }
      get_store_legal_page: {
        Args: { _page: string; _slug: string }
        Returns: Json
      }
      get_store_page: {
        Args: { _page_key: string; _slug: string }
        Returns: Json
      }
      get_store_subscription_public_settings: {
        Args: { _store_id: string }
        Returns: Json
      }
      get_store_template_for_seed: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_store_access: { Args: { _store_id: string }; Returns: boolean }
      is_landing_slug_taken: { Args: { _slug: string }; Returns: boolean }
      is_slug_taken: { Args: { _slug: string }; Returns: boolean }
      is_store_active: { Args: { _store_id: string }; Returns: boolean }
      is_store_employee: { Args: { _store_id: string }; Returns: boolean }
      is_store_owner: { Args: { _store_id: string }; Returns: boolean }
      kick_whatsapp_job: { Args: { _job_id: string }; Returns: undefined }
      landing_public_host: { Args: { _slug: string }; Returns: string }
      list_ai_call_tones_public: {
        Args: never
        Returns: {
          description: string
          id: string
          name: string
          sort_order: number
        }[]
      }
      list_store_pages_public: { Args: { _slug: string }; Returns: Json }
      match_product_image_embeddings: {
        Args: { _embedding: string; _limit?: number; _store_id: string }
        Returns: {
          product_id: string
          similarity: number
        }[]
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      next_subscription_no: { Args: { _store_id: string }; Returns: string }
      platform_routing_hosts: { Args: never; Returns: Json }
      rate_limit_cleanup: { Args: never; Returns: undefined }
      rate_limit_hit: {
        Args: { _key: string; _limit: number; _window_sec: number }
        Returns: Json
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      refresh_store_subscription_status: {
        Args: { _store_id: string }
        Returns: undefined
      }
      resolve_domain: { Args: { _host: string }; Returns: Json }
      resolve_host_kind: { Args: { _host: string }; Returns: Json }
      seed_store_ai_agent_state: {
        Args: { _store_id: string }
        Returns: undefined
      }
      staff_can: {
        Args: { _level: string; _section: string; _store_id: string }
        Returns: boolean
      }
      staff_store_id: { Args: { _user_id: string }; Returns: string }
      submit_product_review: {
        Args: {
          _comment: string
          _email?: string
          _name: string
          _phone?: string
          _product_id: string
          _rating: number
          _store_id: string
        }
        Returns: Json
      }
      touch_landing_activity: {
        Args: { _page_id: string; _visit?: boolean }
        Returns: undefined
      }
      validate_coupon: {
        Args: { _code: string; _store_id: string; _subtotal: number }
        Returns: Json
      }
      validate_subscription_coupon: {
        Args: {
          _amount: number
          _code: string
          _cycle: string
          _package_id: string
        }
        Returns: Json
      }
      wallet_credit: {
        Args: {
          _amount: number
          _invoice_id?: string
          _note?: string
          _reference?: string
          _store_id?: string
          _type: string
          _user_id: string
        }
        Returns: Json
      }
      wallet_debit: {
        Args: {
          _amount: number
          _invoice_id?: string
          _note?: string
          _reference?: string
          _store_id?: string
          _type: string
          _user_id: string
        }
        Returns: Json
      }
      wallet_ensure: {
        Args: { _store_id?: string; _user_id: string }
        Returns: {
          auto_renew: boolean
          auto_renew_cycle: string
          balance: number
          created_at: string
          currency: string
          id: string
          store_id: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "merchant_wallets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "owner" | "user"
      coupon_type: "percent" | "fixed" | "free_shipping"
      expense_category:
        | "fb_ads"
        | "courier"
        | "packaging"
        | "salary"
        | "misc"
        | "ads"
        | "product_purchase"
        | "payment_gateway"
        | "staff"
        | "other"
      fraud_risk: "safe" | "medium" | "high"
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
      payment_method: "cod" | "bkash" | "nagad" | "rocket" | "bank" | "online"
      product_status: "active" | "draft" | "out_of_stock"
      return_status:
        | "requested"
        | "approved"
        | "rejected"
        | "refunded"
        | "completed"
        | "shipment_created"
        | "in_transit"
        | "received"
        | "inspection_passed"
        | "inspection_failed"
        | "replacement_created"
        | "cancelled"
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
      app_role: ["owner", "user"],
      coupon_type: ["percent", "fixed", "free_shipping"],
      expense_category: [
        "fb_ads",
        "courier",
        "packaging",
        "salary",
        "misc",
        "ads",
        "product_purchase",
        "payment_gateway",
        "staff",
        "other",
      ],
      fraud_risk: ["safe", "medium", "high"],
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
      payment_method: ["cod", "bkash", "nagad", "rocket", "bank", "online"],
      product_status: ["active", "draft", "out_of_stock"],
      return_status: [
        "requested",
        "approved",
        "rejected",
        "refunded",
        "completed",
        "shipment_created",
        "in_transit",
        "received",
        "inspection_passed",
        "inspection_failed",
        "replacement_created",
        "cancelled",
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
