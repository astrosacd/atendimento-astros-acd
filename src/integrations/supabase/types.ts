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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agency_products: {
        Row: {
          beneficios: string | null
          categoria: string | null
          created_at: string
          descricao: string | null
          detalhes_extras: string | null
          id: string
          is_active: boolean
          nome: string
          preco: string | null
          updated_at: string
        }
        Insert: {
          beneficios?: string | null
          categoria?: string | null
          created_at?: string
          descricao?: string | null
          detalhes_extras?: string | null
          id?: string
          is_active?: boolean
          nome: string
          preco?: string | null
          updated_at?: string
        }
        Update: {
          beneficios?: string | null
          categoria?: string | null
          created_at?: string
          descricao?: string | null
          detalhes_extras?: string | null
          id?: string
          is_active?: boolean
          nome?: string
          preco?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          api_key: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          last_used_at: string | null
          name: string
          updated_at: string
        }
        Insert: {
          api_key: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          api_key?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      api_quotas: {
        Row: {
          alert_threshold: number | null
          api_name: string
          created_at: string
          current_value: number
          display_name: string
          id: string
          is_active: boolean | null
          last_updated: string | null
          limit_type: string
          max_value: number | null
          updated_at: string
        }
        Insert: {
          alert_threshold?: number | null
          api_name: string
          created_at?: string
          current_value?: number
          display_name: string
          id?: string
          is_active?: boolean | null
          last_updated?: string | null
          limit_type: string
          max_value?: number | null
          updated_at?: string
        }
        Update: {
          alert_threshold?: number | null
          api_name?: string
          created_at?: string
          current_value?: number
          display_name?: string
          id?: string
          is_active?: boolean | null
          last_updated?: string | null
          limit_type?: string
          max_value?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      approval_history: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          id: string
          rejection_reason: string | null
          role_assigned: string | null
          user_id: string
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          id?: string
          rejection_reason?: string | null
          role_assigned?: string | null
          user_id: string
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          id?: string
          rejection_reason?: string | null
          role_assigned?: string | null
          user_id?: string
        }
        Relationships: []
      }
      atomicat_forms: {
        Row: {
          created_at: string
          created_by: string | null
          field_overrides: Json
          form_id: string | null
          form_name: string | null
          id: string
          identifier_type: string
          instance_name: string | null
          is_active: boolean
          message_template: string
          nome: string
          page_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          field_overrides?: Json
          form_id?: string | null
          form_name?: string | null
          id?: string
          identifier_type: string
          instance_name?: string | null
          is_active?: boolean
          message_template: string
          nome: string
          page_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          field_overrides?: Json
          form_id?: string | null
          form_name?: string | null
          id?: string
          identifier_type?: string
          instance_name?: string | null
          is_active?: boolean
          message_template?: string
          nome?: string
          page_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      atomicat_settings: {
        Row: {
          api_key: string | null
          api_url: string | null
          default_instance_name: string | null
          enabled: boolean
          id: string
          updated_at: string
        }
        Insert: {
          api_key?: string | null
          api_url?: string | null
          default_instance_name?: string | null
          enabled?: boolean
          id?: string
          updated_at?: string
        }
        Update: {
          api_key?: string | null
          api_url?: string | null
          default_instance_name?: string | null
          enabled?: boolean
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      atomicat_submissions: {
        Row: {
          atomicat_form_id: string | null
          atomicat_form_name: string | null
          created_at: string
          error_message: string | null
          extracted_email: string | null
          extracted_nome: string | null
          extracted_telefone: string | null
          form_config_id: string | null
          id: string
          page_url: string | null
          payload: Json
          sent_at: string | null
          status: string
        }
        Insert: {
          atomicat_form_id?: string | null
          atomicat_form_name?: string | null
          created_at?: string
          error_message?: string | null
          extracted_email?: string | null
          extracted_nome?: string | null
          extracted_telefone?: string | null
          form_config_id?: string | null
          id?: string
          page_url?: string | null
          payload: Json
          sent_at?: string | null
          status?: string
        }
        Update: {
          atomicat_form_id?: string | null
          atomicat_form_name?: string | null
          created_at?: string
          error_message?: string | null
          extracted_email?: string | null
          extracted_nome?: string | null
          extracted_telefone?: string | null
          form_config_id?: string | null
          id?: string
          page_url?: string | null
          payload?: Json
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "atomicat_submissions_form_config_id_fkey"
            columns: ["form_config_id"]
            isOneToOne: false
            referencedRelation: "atomicat_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          api_key_id: string | null
          created_at: string
          id: string
          ip_address: string | null
          request_body: Json | null
          request_method: string | null
          request_path: string | null
          resource_id: string | null
          resource_type: string
          response_body: Json | null
          response_status: number | null
          user_agent: string | null
          webhook_id: string | null
        }
        Insert: {
          action: string
          api_key_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          request_body?: Json | null
          request_method?: string | null
          request_path?: string | null
          resource_id?: string | null
          resource_type: string
          response_body?: Json | null
          response_status?: number | null
          user_agent?: string | null
          webhook_id?: string | null
        }
        Update: {
          action?: string
          api_key_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          request_body?: Json | null
          request_method?: string | null
          request_path?: string | null
          resource_id?: string | null
          resource_type?: string
          response_body?: Json | null
          response_status?: number | null
          user_agent?: string | null
          webhook_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_logs: {
        Row: {
          action_taken: string
          cliente_id: string | null
          created_at: string
          id: string
          result: string | null
          rule_id: string
        }
        Insert: {
          action_taken: string
          cliente_id?: string | null
          created_at?: string
          id?: string
          result?: string | null
          rule_id: string
        }
        Update: {
          action_taken?: string
          cliente_id?: string | null
          created_at?: string
          id?: string
          result?: string | null
          rule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_logs_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_logs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          action_config: Json | null
          action_type: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          last_run_at: string | null
          name: string
          trigger_config: Json | null
          trigger_type: string
          updated_at: string
        }
        Insert: {
          action_config?: Json | null
          action_type: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_run_at?: string | null
          name: string
          trigger_config?: Json | null
          trigger_type: string
          updated_at?: string
        }
        Update: {
          action_config?: Json | null
          action_type?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_run_at?: string | null
          name?: string
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      baserow_integrations: {
        Row: {
          api_token: string
          api_url: string
          created_at: string
          events: string[]
          id: string
          is_enabled: boolean
          module: string
          table_id: string
          updated_at: string
        }
        Insert: {
          api_token?: string
          api_url?: string
          created_at?: string
          events?: string[]
          id?: string
          is_enabled?: boolean
          module: string
          table_id?: string
          updated_at?: string
        }
        Update: {
          api_token?: string
          api_url?: string
          created_at?: string
          events?: string[]
          id?: string
          is_enabled?: boolean
          module?: string
          table_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      billing_config: {
        Row: {
          config_key: string
          config_value: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          config_key: string
          config_value: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          config_key?: string
          config_value?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      billing_logs: {
        Row: {
          channel: string
          cliente_email: string | null
          cliente_id: string | null
          cliente_nome: string
          cliente_numero: string | null
          cliente_observacoes: string | null
          cliente_produto: string | null
          error_message: string | null
          id: string
          message_type: string
          resolution: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          sent_at: string
          status: string
        }
        Insert: {
          channel: string
          cliente_email?: string | null
          cliente_id?: string | null
          cliente_nome: string
          cliente_numero?: string | null
          cliente_observacoes?: string | null
          cliente_produto?: string | null
          error_message?: string | null
          id?: string
          message_type: string
          resolution?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          sent_at?: string
          status?: string
        }
        Update: {
          channel?: string
          cliente_email?: string | null
          cliente_id?: string | null
          cliente_nome?: string
          cliente_numero?: string | null
          cliente_observacoes?: string | null
          cliente_produto?: string | null
          error_message?: string | null
          id?: string
          message_type?: string
          resolution?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          sent_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_logs_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_stripe_config: {
        Row: {
          created_at: string
          id: string
          stripe_enabled: boolean | null
          stripe_secret_key: string | null
          stripe_tax_percent: number | null
          stripe_webhook_secret: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          stripe_enabled?: boolean | null
          stripe_secret_key?: string | null
          stripe_tax_percent?: number | null
          stripe_webhook_secret?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          stripe_enabled?: boolean | null
          stripe_secret_key?: string | null
          stripe_tax_percent?: number | null
          stripe_webhook_secret?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      billing_webhook_logs: {
        Row: {
          created_at: string
          event_type: string | null
          external_id: string | null
          http_status: number | null
          id: string
          is_test: boolean
          matched_payment_id: string | null
          message: string | null
          payload: Json | null
          provider: string
          result: string
        }
        Insert: {
          created_at?: string
          event_type?: string | null
          external_id?: string | null
          http_status?: number | null
          id?: string
          is_test?: boolean
          matched_payment_id?: string | null
          message?: string | null
          payload?: Json | null
          provider: string
          result: string
        }
        Update: {
          created_at?: string
          event_type?: string | null
          external_id?: string | null
          http_status?: number | null
          id?: string
          is_test?: boolean
          matched_payment_id?: string | null
          message?: string | null
          payload?: Json | null
          provider?: string
          result?: string
        }
        Relationships: []
      }
      billing_whatsapp_instances: {
        Row: {
          api_key: string
          api_url: string
          created_at: string
          id: string
          instance_name: string
          is_active: boolean
          last_used_at: string | null
          updated_at: string
        }
        Insert: {
          api_key: string
          api_url: string
          created_at?: string
          id?: string
          instance_name: string
          is_active?: boolean
          last_used_at?: string | null
          updated_at?: string
        }
        Update: {
          api_key?: string
          api_url?: string
          created_at?: string
          id?: string
          instance_name?: string
          is_active?: boolean
          last_used_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      bloqueios: {
        Row: {
          created_at: string
          data: string
          dia_todo: boolean
          hora_fim: string | null
          hora_inicio: string | null
          id: number
          motivo: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data: string
          dia_todo?: boolean
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: number
          motivo?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: string
          dia_todo?: boolean
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: number
          motivo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      bloqueios_historico: {
        Row: {
          acao: string
          bloqueio_id: number | null
          created_at: string
          dados_antes: Json | null
          dados_depois: Json | null
          data_bloqueio: string | null
          dia_todo: boolean | null
          hora_fim: string | null
          hora_inicio: string | null
          id: number
          motivo: string | null
          origem: string
          user_email: string | null
          user_id: string | null
          user_nome: string | null
        }
        Insert: {
          acao: string
          bloqueio_id?: number | null
          created_at?: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          data_bloqueio?: string | null
          dia_todo?: boolean | null
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: number
          motivo?: string | null
          origem?: string
          user_email?: string | null
          user_id?: string | null
          user_nome?: string | null
        }
        Update: {
          acao?: string
          bloqueio_id?: number | null
          created_at?: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          data_bloqueio?: string | null
          dia_todo?: boolean | null
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: number
          motivo?: string | null
          origem?: string
          user_email?: string | null
          user_id?: string | null
          user_nome?: string | null
        }
        Relationships: []
      }
      calendar_config: {
        Row: {
          config_key: string
          config_value: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          config_key: string
          config_value?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          config_key?: string
          config_value?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      calendar_event_history: {
        Row: {
          action: string
          created_at: string
          event_id: string | null
          event_title: string | null
          id: string
          reason: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          event_id?: string | null
          event_title?: string | null
          id?: string
          reason?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          event_id?: string | null
          event_title?: string | null
          id?: string
          reason?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_event_history_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          client_email: string | null
          client_name: string | null
          client_phone: string | null
          consultant_phones: string[] | null
          created_at: string
          created_by: string | null
          description: string | null
          end_time: string
          google_event_id: string | null
          id: string
          location: string | null
          meet_link: string | null
          meeting_type: string | null
          notes: string | null
          notified_at: string | null
          reference_point: string | null
          source: string
          start_time: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          consultant_phones?: string[] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time: string
          google_event_id?: string | null
          id?: string
          location?: string | null
          meet_link?: string | null
          meeting_type?: string | null
          notes?: string | null
          notified_at?: string | null
          reference_point?: string | null
          source?: string
          start_time: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          consultant_phones?: string[] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time?: string
          google_event_id?: string | null
          id?: string
          location?: string | null
          meet_link?: string | null
          meeting_type?: string | null
          notes?: string | null
          notified_at?: string | null
          reference_point?: string | null
          source?: string
          start_time?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      calendar_notification_logs: {
        Row: {
          channel: string
          error_message: string | null
          event_id: string | null
          id: string
          message_sent: string | null
          recipient_contact: string | null
          recipient_name: string | null
          recipient_type: string
          sent_at: string
          status: string
          whatsapp_instance_id: string | null
        }
        Insert: {
          channel?: string
          error_message?: string | null
          event_id?: string | null
          id?: string
          message_sent?: string | null
          recipient_contact?: string | null
          recipient_name?: string | null
          recipient_type?: string
          sent_at?: string
          status?: string
          whatsapp_instance_id?: string | null
        }
        Update: {
          channel?: string
          error_message?: string | null
          event_id?: string | null
          id?: string
          message_sent?: string | null
          recipient_contact?: string | null
          recipient_name?: string | null
          recipient_type?: string
          sent_at?: string
          status?: string
          whatsapp_instance_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_notification_logs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_notification_logs_whatsapp_instance_id_fkey"
            columns: ["whatsapp_instance_id"]
            isOneToOne: false
            referencedRelation: "calendar_notification_whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_notification_whatsapp_instances: {
        Row: {
          api_key: string
          api_url: string
          created_at: string
          id: string
          instance_name: string
          is_active: boolean | null
          last_used_at: string | null
          updated_at: string
        }
        Insert: {
          api_key: string
          api_url: string
          created_at?: string
          id?: string
          instance_name: string
          is_active?: boolean | null
          last_used_at?: string | null
          updated_at?: string
        }
        Update: {
          api_key?: string
          api_url?: string
          created_at?: string
          id?: string
          instance_name?: string
          is_active?: boolean | null
          last_used_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      chamados: {
        Row: {
          cliente_id: string | null
          closed_at: string | null
          codigo: string
          contato: string
          created_at: string
          criado_por: string | null
          email: string
          hash_acesso: string
          id: string
          is_internal: boolean | null
          motivo: string
          nome: string
          prioridade: Database["public"]["Enums"]["chamado_prioridade"]
          setor: string | null
          status: Database["public"]["Enums"]["chamado_status"]
          tecnico_id: string | null
          updated_at: string
        }
        Insert: {
          cliente_id?: string | null
          closed_at?: string | null
          codigo: string
          contato: string
          created_at?: string
          criado_por?: string | null
          email: string
          hash_acesso: string
          id?: string
          is_internal?: boolean | null
          motivo: string
          nome: string
          prioridade?: Database["public"]["Enums"]["chamado_prioridade"]
          setor?: string | null
          status?: Database["public"]["Enums"]["chamado_status"]
          tecnico_id?: string | null
          updated_at?: string
        }
        Update: {
          cliente_id?: string | null
          closed_at?: string | null
          codigo?: string
          contato?: string
          created_at?: string
          criado_por?: string | null
          email?: string
          hash_acesso?: string
          id?: string
          is_internal?: boolean | null
          motivo?: string
          nome?: string
          prioridade?: Database["public"]["Enums"]["chamado_prioridade"]
          setor?: string | null
          status?: Database["public"]["Enums"]["chamado_status"]
          tecnico_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chamados_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      chamados_api_keys: {
        Row: {
          api_key: string
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          is_active: boolean
          last_used_at: string | null
          nome: string
          permissions: string[]
          updated_at: string
        }
        Insert: {
          api_key: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          nome: string
          permissions?: string[]
          updated_at?: string
        }
        Update: {
          api_key?: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          nome?: string
          permissions?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      chamados_codigos_verificacao: {
        Row: {
          codigo: string
          created_at: string
          email: string
          expires_at: string
          id: string
          used: boolean
        }
        Insert: {
          codigo: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          used?: boolean
        }
        Update: {
          codigo?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          used?: boolean
        }
        Relationships: []
      }
      chamados_comentarios: {
        Row: {
          autor_email: string | null
          autor_id: string | null
          autor_nome: string
          chamado_id: string
          conteudo: string
          created_at: string
          id: string
          tipo: string
        }
        Insert: {
          autor_email?: string | null
          autor_id?: string | null
          autor_nome: string
          chamado_id: string
          conteudo: string
          created_at?: string
          id?: string
          tipo?: string
        }
        Update: {
          autor_email?: string | null
          autor_id?: string | null
          autor_nome?: string
          chamado_id?: string
          conteudo?: string
          created_at?: string
          id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "chamados_comentarios_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados"
            referencedColumns: ["id"]
          },
        ]
      }
      chamados_config: {
        Row: {
          config_key: string
          config_value: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          config_key: string
          config_value: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          config_key?: string
          config_value?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      chamados_historico: {
        Row: {
          acao: string
          chamado_id: string
          created_at: string
          dados_anteriores: Json | null
          dados_novos: Json | null
          id: string
          ip_address: string | null
          usuario_email: string | null
          usuario_id: string | null
        }
        Insert: {
          acao: string
          chamado_id: string
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          id?: string
          ip_address?: string | null
          usuario_email?: string | null
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          chamado_id?: string
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          id?: string
          ip_address?: string | null
          usuario_email?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chamados_historico_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados"
            referencedColumns: ["id"]
          },
        ]
      }
      chamados_webhook_logs: {
        Row: {
          chamado_id: string | null
          created_at: string
          evento: string
          id: string
          payload: Json
          response_body: string | null
          response_status: number | null
          retry_count: number
          success: boolean
          webhook_id: string
        }
        Insert: {
          chamado_id?: string | null
          created_at?: string
          evento: string
          id?: string
          payload: Json
          response_body?: string | null
          response_status?: number | null
          retry_count?: number
          success?: boolean
          webhook_id: string
        }
        Update: {
          chamado_id?: string | null
          created_at?: string
          evento?: string
          id?: string
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          retry_count?: number
          success?: boolean
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chamados_webhook_logs_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_webhook_logs_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "chamados_webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      chamados_webhooks: {
        Row: {
          created_at: string
          created_by: string | null
          eventos: string[]
          id: string
          is_active: boolean
          last_triggered_at: string | null
          nome: string
          secret_key: string | null
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          eventos?: string[]
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          nome: string
          secret_key?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          eventos?: string[]
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          nome?: string
          secret_key?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      chat_conversations: {
        Row: {
          created_at: string
          id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
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
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_ai_logs: {
        Row: {
          cliente_id: string
          completion_tokens: number | null
          created_at: string
          id: string
          mode: string
          model: string
          prompt_tokens: number | null
          user_id: string | null
        }
        Insert: {
          cliente_id: string
          completion_tokens?: number | null
          created_at?: string
          id?: string
          mode: string
          model: string
          prompt_tokens?: number | null
          user_id?: string | null
        }
        Update: {
          cliente_id?: string
          completion_tokens?: number | null
          created_at?: string
          id?: string
          mode?: string
          model?: string
          prompt_tokens?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_ai_logs_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      client_ai_upsell_suggestions: {
        Row: {
          cliente_id: string
          created_at: string
          id: string
          last_analysis_at: string
          status: string
          suggestions: Json
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          id?: string
          last_analysis_at?: string
          status?: string
          suggestions: Json
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          id?: string
          last_analysis_at?: string
          status?: string
          suggestions?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_ai_upsell_suggestions_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      client_files: {
        Row: {
          cliente_id: string | null
          created_at: string
          created_by: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_files_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      client_followup_logs: {
        Row: {
          channel: string
          error_message: string | null
          followup_id: string
          id: string
          sent_at: string
          status: string
        }
        Insert: {
          channel: string
          error_message?: string | null
          followup_id: string
          id?: string
          sent_at?: string
          status?: string
        }
        Update: {
          channel?: string
          error_message?: string | null
          followup_id?: string
          id?: string
          sent_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_followup_logs_followup_id_fkey"
            columns: ["followup_id"]
            isOneToOne: false
            referencedRelation: "client_followups"
            referencedColumns: ["id"]
          },
        ]
      }
      client_followups: {
        Row: {
          channel: string
          cliente_id: string | null
          conversion_note: string | null
          conversion_status: string | null
          converted_at: string | null
          created_at: string
          created_by: string | null
          current_attempt: number
          custom_message: string | null
          id: string
          is_recurring: boolean
          manual_email: string | null
          manual_name: string | null
          manual_phone: string | null
          max_attempts: number | null
          message_template: string | null
          next_dispatch_at: string | null
          produto: string
          recurrence_interval_days: number | null
          scheduled_at: string
          status: string
          updated_at: string
        }
        Insert: {
          channel?: string
          cliente_id?: string | null
          conversion_note?: string | null
          conversion_status?: string | null
          converted_at?: string | null
          created_at?: string
          created_by?: string | null
          current_attempt?: number
          custom_message?: string | null
          id?: string
          is_recurring?: boolean
          manual_email?: string | null
          manual_name?: string | null
          manual_phone?: string | null
          max_attempts?: number | null
          message_template?: string | null
          next_dispatch_at?: string | null
          produto: string
          recurrence_interval_days?: number | null
          scheduled_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          channel?: string
          cliente_id?: string | null
          conversion_note?: string | null
          conversion_status?: string | null
          converted_at?: string | null
          created_at?: string
          created_by?: string | null
          current_attempt?: number
          custom_message?: string | null
          id?: string
          is_recurring?: boolean
          manual_email?: string | null
          manual_name?: string | null
          manual_phone?: string | null
          max_attempts?: number | null
          message_template?: string | null
          next_dispatch_at?: string | null
          produto?: string
          recurrence_interval_days?: number | null
          scheduled_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_followups_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      client_history: {
        Row: {
          action: string
          changed_by: string | null
          changed_by_email: string | null
          changed_fields: string[] | null
          cliente_id: string | null
          created_at: string
          id: string
          new_data: Json | null
          previous_data: Json | null
        }
        Insert: {
          action: string
          changed_by?: string | null
          changed_by_email?: string | null
          changed_fields?: string[] | null
          cliente_id?: string | null
          created_at?: string
          id?: string
          new_data?: Json | null
          previous_data?: Json | null
        }
        Update: {
          action?: string
          changed_by?: string | null
          changed_by_email?: string | null
          changed_fields?: string[] | null
          cliente_id?: string | null
          created_at?: string
          id?: string
          new_data?: Json | null
          previous_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "client_history_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      client_logos: {
        Row: {
          cliente_id: string
          created_at: string
          created_by: string | null
          description: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_logos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      client_payments: {
        Row: {
          amount: number
          approval_override: boolean | null
          approval_reason: string | null
          approved_by: string | null
          approved_by_email: string | null
          billing_date: string
          cliente_id: string | null
          comprovante_url: string | null
          created_at: string
          id: string
          ocr_amount: number | null
          ocr_status: string | null
          paid_at: string | null
          payment_id: string
          payment_type: string
          pix_transaction_id: string | null
          preference_id: string | null
          receipt_number: string | null
          status: string
          submitted_by: string | null
          submitted_by_email: string | null
          submitted_by_name: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          approval_override?: boolean | null
          approval_reason?: string | null
          approved_by?: string | null
          approved_by_email?: string | null
          billing_date: string
          cliente_id?: string | null
          comprovante_url?: string | null
          created_at?: string
          id?: string
          ocr_amount?: number | null
          ocr_status?: string | null
          paid_at?: string | null
          payment_id: string
          payment_type: string
          pix_transaction_id?: string | null
          preference_id?: string | null
          receipt_number?: string | null
          status?: string
          submitted_by?: string | null
          submitted_by_email?: string | null
          submitted_by_name?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          approval_override?: boolean | null
          approval_reason?: string | null
          approved_by?: string | null
          approved_by_email?: string | null
          billing_date?: string
          cliente_id?: string | null
          comprovante_url?: string | null
          created_at?: string
          id?: string
          ocr_amount?: number | null
          ocr_status?: string | null
          paid_at?: string | null
          payment_id?: string
          payment_type?: string
          pix_transaction_id?: string | null
          preference_id?: string | null
          receipt_number?: string | null
          status?: string
          submitted_by?: string | null
          submitted_by_email?: string | null
          submitted_by_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_payments_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      client_pipeline: {
        Row: {
          chatwoot_conversation_id: number | null
          cliente_id: string | null
          converted_at: string | null
          id: string
          is_lead: boolean | null
          last_ai_update: string | null
          last_interaction_at: string | null
          lead_email: string | null
          lead_name: string | null
          lead_phone: string | null
          lead_produto: string | null
          lead_score: number | null
          lead_score_reason: string | null
          moved_at: string
          moved_by: string | null
          next_action_suggestion: string | null
          notes: string | null
          stage_id: string | null
        }
        Insert: {
          chatwoot_conversation_id?: number | null
          cliente_id?: string | null
          converted_at?: string | null
          id?: string
          is_lead?: boolean | null
          last_ai_update?: string | null
          last_interaction_at?: string | null
          lead_email?: string | null
          lead_name?: string | null
          lead_phone?: string | null
          lead_produto?: string | null
          lead_score?: number | null
          lead_score_reason?: string | null
          moved_at?: string
          moved_by?: string | null
          next_action_suggestion?: string | null
          notes?: string | null
          stage_id?: string | null
        }
        Update: {
          chatwoot_conversation_id?: number | null
          cliente_id?: string | null
          converted_at?: string | null
          id?: string
          is_lead?: boolean | null
          last_ai_update?: string | null
          last_interaction_at?: string | null
          lead_email?: string | null
          lead_name?: string | null
          lead_phone?: string | null
          lead_produto?: string | null
          lead_score?: number | null
          lead_score_reason?: string | null
          moved_at?: string
          moved_by?: string | null
          next_action_suggestion?: string | null
          notes?: string | null
          stage_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_pipeline_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: true
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_pipeline_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      client_purchases: {
        Row: {
          cliente_id: string
          created_at: string
          created_by: string | null
          data_compra: string
          descricao: string | null
          id: string
          moeda: string
          produto: string
          valor: number
        }
        Insert: {
          cliente_id: string
          created_at?: string
          created_by?: string | null
          data_compra?: string
          descricao?: string | null
          id?: string
          moeda?: string
          produto: string
          valor?: number
        }
        Update: {
          cliente_id?: string
          created_at?: string
          created_by?: string | null
          data_compra?: string
          descricao?: string | null
          id?: string
          moeda?: string
          produto?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_purchases_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      client_recovery_attempts: {
        Row: {
          canal: string
          cliente_id: string | null
          converteu: boolean | null
          created_at: string
          data_envio: string
          data_vencimento: string
          error_message: string | null
          id: string
          mensagem_enviada: string
          status: string
          updated_at: string
        }
        Insert: {
          canal?: string
          cliente_id?: string | null
          converteu?: boolean | null
          created_at?: string
          data_envio?: string
          data_vencimento: string
          error_message?: string | null
          id?: string
          mensagem_enviada: string
          status?: string
          updated_at?: string
        }
        Update: {
          canal?: string
          cliente_id?: string | null
          converteu?: boolean | null
          created_at?: string
          data_envio?: string
          data_vencimento?: string
          error_message?: string | null
          id?: string
          mensagem_enviada?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_recovery_attempts_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      client_recovery_webhook_logs: {
        Row: {
          attempt_id: string | null
          created_at: string
          evento: string
          id: string
          payload: Json
          response_body: string | null
          response_status: number | null
          success: boolean
          webhook_id: string
        }
        Insert: {
          attempt_id?: string | null
          created_at?: string
          evento: string
          id?: string
          payload: Json
          response_body?: string | null
          response_status?: number | null
          success?: boolean
          webhook_id: string
        }
        Update: {
          attempt_id?: string | null
          created_at?: string
          evento?: string
          id?: string
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          success?: boolean
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_recovery_webhook_logs_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "client_recovery_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_recovery_webhook_logs_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "client_recovery_webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      client_recovery_webhooks: {
        Row: {
          created_at: string
          eventos: string[]
          id: string
          is_active: boolean
          last_triggered_at: string | null
          nome: string
          secret_key: string | null
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          eventos?: string[]
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          nome: string
          secret_key?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          eventos?: string[]
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          nome?: string
          secret_key?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      client_score_history: {
        Row: {
          cliente_id: string
          created_at: string
          faixa_anterior: string | null
          faixa_nova: string
          id: string
          motivo: string | null
          score_anterior: number | null
          score_novo: number
        }
        Insert: {
          cliente_id: string
          created_at?: string
          faixa_anterior?: string | null
          faixa_nova: string
          id?: string
          motivo?: string | null
          score_anterior?: number | null
          score_novo: number
        }
        Update: {
          cliente_id?: string
          created_at?: string
          faixa_anterior?: string | null
          faixa_nova?: string
          id?: string
          motivo?: string | null
          score_anterior?: number | null
          score_novo?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_score_history_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      client_scores: {
        Row: {
          calculated_at: string
          cliente_id: string
          created_at: string
          desconto_sugerido: number | null
          faixa: string
          fatores: Json | null
          id: string
          justificativa: string | null
          score: number
          updated_at: string
        }
        Insert: {
          calculated_at?: string
          cliente_id: string
          created_at?: string
          desconto_sugerido?: number | null
          faixa?: string
          fatores?: Json | null
          id?: string
          justificativa?: string | null
          score?: number
          updated_at?: string
        }
        Update: {
          calculated_at?: string
          cliente_id?: string
          created_at?: string
          desconto_sugerido?: number | null
          faixa?: string
          fatores?: Json | null
          id?: string
          justificativa?: string | null
          score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_scores_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: true
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      client_server_tool_types: {
        Row: {
          created_at: string
          created_by: string | null
          icon: string
          id: string
          is_system: boolean
          label: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          icon?: string
          id?: string
          is_system?: boolean
          label: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          icon?: string
          id?: string
          is_system?: boolean
          label?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      client_social_credentials: {
        Row: {
          cliente_id: string
          created_at: string
          created_by: string | null
          encrypted_password: string
          id: string
          login: string
          notes: string | null
          platform: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cliente_id: string
          created_at?: string
          created_by?: string | null
          encrypted_password: string
          id?: string
          login: string
          notes?: string | null
          platform: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cliente_id?: string
          created_at?: string
          created_by?: string | null
          encrypted_password?: string
          id?: string
          login?: string
          notes?: string | null
          platform?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_social_credentials_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      client_tasks: {
        Row: {
          assigned_to: string | null
          assigned_to_email: string | null
          cliente_id: string | null
          codigo: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          created_by_email: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          assigned_to_email?: string | null
          cliente_id?: string | null
          codigo?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          assigned_to_email?: string | null
          cliente_id?: string | null
          codigo?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_tasks_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      client_tasks_history: {
        Row: {
          action: string
          changed_fields: string[] | null
          created_at: string
          deletion_reason: string | null
          id: string
          new_data: Json | null
          previous_data: Json | null
          task_id: string | null
          user_email: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          changed_fields?: string[] | null
          created_at?: string
          deletion_reason?: string | null
          id?: string
          new_data?: Json | null
          previous_data?: Json | null
          task_id?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          changed_fields?: string[] | null
          created_at?: string
          deletion_reason?: string | null
          id?: string
          new_data?: Json | null
          previous_data?: Json | null
          task_id?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_tasks_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "client_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      client_whatsapp_groups: {
        Row: {
          cliente_id: string | null
          created_at: string
          created_by: string | null
          created_by_email: string | null
          created_by_name: string | null
          error_message: string | null
          finalization_message: string | null
          finalization_reason: string | null
          finalized_at: string | null
          finalized_by: string | null
          finalized_by_email: string | null
          finalized_by_name: string | null
          group_description: string | null
          group_jid: string | null
          group_name: string
          id: string
          image_url: string | null
          motivo: string | null
          participants: string[]
          status: string
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          created_by_name?: string | null
          error_message?: string | null
          finalization_message?: string | null
          finalization_reason?: string | null
          finalized_at?: string | null
          finalized_by?: string | null
          finalized_by_email?: string | null
          finalized_by_name?: string | null
          group_description?: string | null
          group_jid?: string | null
          group_name: string
          id?: string
          image_url?: string | null
          motivo?: string | null
          participants?: string[]
          status?: string
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          created_by_name?: string | null
          error_message?: string | null
          finalization_message?: string | null
          finalization_reason?: string | null
          finalized_at?: string | null
          finalized_by?: string | null
          finalized_by_email?: string | null
          finalized_by_name?: string | null
          group_description?: string | null
          group_jid?: string | null
          group_name?: string
          id?: string
          image_url?: string | null
          motivo?: string | null
          participants?: string[]
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_whatsapp_groups_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          ciclo_cobranca: string
          cobranca_ativa: boolean
          cpf: string | null
          created_at: string
          created_by: string | null
          data_d_mais_1: string | null
          data_d_mais_15: string | null
          data_d_mais_2: string | null
          data_d_mais_30: string | null
          data_d_menos_3: string | null
          data_renovacao: string
          email: string | null
          excluir_metricas: boolean | null
          id: string
          moeda: string
          nome: string
          numero: string
          observacao: string | null
          plano: string | null
          produto: string
          tags: string[] | null
          tipo: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          ciclo_cobranca?: string
          cobranca_ativa?: boolean
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          data_d_mais_1?: string | null
          data_d_mais_15?: string | null
          data_d_mais_2?: string | null
          data_d_mais_30?: string | null
          data_d_menos_3?: string | null
          data_renovacao: string
          email?: string | null
          excluir_metricas?: boolean | null
          id?: string
          moeda?: string
          nome: string
          numero: string
          observacao?: string | null
          plano?: string | null
          produto: string
          tags?: string[] | null
          tipo?: string | null
          updated_at?: string
          valor: number
        }
        Update: {
          ciclo_cobranca?: string
          cobranca_ativa?: boolean
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          data_d_mais_1?: string | null
          data_d_mais_15?: string | null
          data_d_mais_2?: string | null
          data_d_mais_30?: string | null
          data_d_menos_3?: string | null
          data_renovacao?: string
          email?: string | null
          excluir_metricas?: boolean | null
          id?: string
          moeda?: string
          nome?: string
          numero?: string
          observacao?: string | null
          plano?: string | null
          produto?: string
          tags?: string[] | null
          tipo?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      cobranca_ligacao_config: {
        Row: {
          apenas_cobranca_ativa: boolean
          created_at: string
          delay_minutes: number
          dias_disparo: number[]
          enabled: boolean
          fallback_audio_enabled: boolean
          fallback_audio_send_text: boolean
          fallback_audio_template: string
          fallback_max_per_day: number
          horario_fim: string
          horario_inicio: string
          id: string
          roteiro_id: string | null
          updated_at: string
        }
        Insert: {
          apenas_cobranca_ativa?: boolean
          created_at?: string
          delay_minutes?: number
          dias_disparo?: number[]
          enabled?: boolean
          fallback_audio_enabled?: boolean
          fallback_audio_send_text?: boolean
          fallback_audio_template?: string
          fallback_max_per_day?: number
          horario_fim?: string
          horario_inicio?: string
          id?: string
          roteiro_id?: string | null
          updated_at?: string
        }
        Update: {
          apenas_cobranca_ativa?: boolean
          created_at?: string
          delay_minutes?: number
          dias_disparo?: number[]
          enabled?: boolean
          fallback_audio_enabled?: boolean
          fallback_audio_send_text?: boolean
          fallback_audio_template?: string
          fallback_max_per_day?: number
          horario_fim?: string
          horario_inicio?: string
          id?: string
          roteiro_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cobranca_ligacao_config_roteiro_id_fkey"
            columns: ["roteiro_id"]
            isOneToOne: false
            referencedRelation: "ligacoes_ia_roteiros"
            referencedColumns: ["id"]
          },
        ]
      }
      cobranca_ligacao_logs: {
        Row: {
          created_at: string
          dia_alvo: string
          dias_processados: number[]
          enqueued: number
          executed_at: string
          id: string
          message: string | null
          scanned: number
          status: string
          triggered_by: string
        }
        Insert: {
          created_at?: string
          dia_alvo: string
          dias_processados?: number[]
          enqueued?: number
          executed_at?: string
          id?: string
          message?: string | null
          scanned?: number
          status?: string
          triggered_by?: string
        }
        Update: {
          created_at?: string
          dia_alvo?: string
          dias_processados?: number[]
          enqueued?: number
          executed_at?: string
          id?: string
          message?: string | null
          scanned?: number
          status?: string
          triggered_by?: string
        }
        Relationships: []
      }
      consulta_numeros_api_keys: {
        Row: {
          api_key: string
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          is_active: boolean
          last_used_at: string | null
          nome: string
          permissions: string[]
          updated_at: string
        }
        Insert: {
          api_key: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          nome: string
          permissions?: string[]
          updated_at?: string
        }
        Update: {
          api_key?: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          nome?: string
          permissions?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      consulta_numeros_auto_sync_config: {
        Row: {
          created_at: string
          id: string
          interval_minutes: number
          is_active: boolean
          last_auto_sync_at: string | null
          next_scheduled_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          interval_minutes?: number
          is_active?: boolean
          last_auto_sync_at?: string | null
          next_scheduled_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          interval_minutes?: number
          is_active?: boolean
          last_auto_sync_at?: string | null
          next_scheduled_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      consulta_numeros_cache: {
        Row: {
          auto_hospedado: boolean
          auto_hospedado_marcado_em: string | null
          auto_hospedado_marcado_por: string | null
          auto_hospedado_observacao: string | null
          baserow_row_id: number
          created_at: string
          id: string
          row_data: Json
          updated_at: string
        }
        Insert: {
          auto_hospedado?: boolean
          auto_hospedado_marcado_em?: string | null
          auto_hospedado_marcado_por?: string | null
          auto_hospedado_observacao?: string | null
          baserow_row_id: number
          created_at?: string
          id?: string
          row_data: Json
          updated_at?: string
        }
        Update: {
          auto_hospedado?: boolean
          auto_hospedado_marcado_em?: string | null
          auto_hospedado_marcado_por?: string | null
          auto_hospedado_observacao?: string | null
          baserow_row_id?: number
          created_at?: string
          id?: string
          row_data?: Json
          updated_at?: string
        }
        Relationships: []
      }
      consulta_numeros_config: {
        Row: {
          config_key: string
          config_value: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          config_key: string
          config_value: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          config_key?: string
          config_value?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      consulta_numeros_field_mappings: {
        Row: {
          baserow_field_id: string
          baserow_field_name: string
          created_at: string
          field_name: string
          id: string
          is_required: boolean | null
          updated_at: string
        }
        Insert: {
          baserow_field_id: string
          baserow_field_name: string
          created_at?: string
          field_name: string
          id?: string
          is_required?: boolean | null
          updated_at?: string
        }
        Update: {
          baserow_field_id?: string
          baserow_field_name?: string
          created_at?: string
          field_name?: string
          id?: string
          is_required?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      consulta_numeros_fields_cache: {
        Row: {
          fields_data: Json
          id: string
          synced_at: string
        }
        Insert: {
          fields_data: Json
          id?: string
          synced_at?: string
        }
        Update: {
          fields_data?: Json
          id?: string
          synced_at?: string
        }
        Relationships: []
      }
      consulta_numeros_history: {
        Row: {
          acao: string
          api_key_id: string | null
          baserow_row_id: string | null
          campos_alterados: string[] | null
          created_at: string
          dados_anteriores: Json | null
          dados_novos: Json | null
          id: string
          ip_address: string | null
          numero: string
          origem: string
          user_agent: string | null
          usuario_email: string | null
          usuario_id: string | null
          webhook_id: string | null
        }
        Insert: {
          acao: string
          api_key_id?: string | null
          baserow_row_id?: string | null
          campos_alterados?: string[] | null
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          id?: string
          ip_address?: string | null
          numero: string
          origem: string
          user_agent?: string | null
          usuario_email?: string | null
          usuario_id?: string | null
          webhook_id?: string | null
        }
        Update: {
          acao?: string
          api_key_id?: string | null
          baserow_row_id?: string | null
          campos_alterados?: string[] | null
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          id?: string
          ip_address?: string | null
          numero?: string
          origem?: string
          user_agent?: string | null
          usuario_email?: string | null
          usuario_id?: string | null
          webhook_id?: string | null
        }
        Relationships: []
      }
      consulta_numeros_masked_fields: {
        Row: {
          created_at: string
          field_name: string
          id: string
          is_masked: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          field_name: string
          id?: string
          is_masked?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          field_name?: string
          id?: string
          is_masked?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      consulta_numeros_obs_presets: {
        Row: {
          ativo: boolean
          cor: string | null
          created_at: string
          icone: string | null
          id: string
          label: string
          ordem: number
          status_padrao: string | null
          texto_observacao: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          icone?: string | null
          id?: string
          label: string
          ordem?: number
          status_padrao?: string | null
          texto_observacao: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          icone?: string | null
          id?: string
          label?: string
          ordem?: number
          status_padrao?: string | null
          texto_observacao?: string
          updated_at?: string
        }
        Relationships: []
      }
      consulta_numeros_obs_tags: {
        Row: {
          cor: string | null
          created_at: string
          created_by: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          cor?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          cor?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      consulta_numeros_reminder_config: {
        Row: {
          created_at: string
          cron_days: string[]
          cron_end_hour: number
          cron_end_minute: number | null
          cron_interval_hours: number
          cron_interval_minutes: number | null
          cron_start_hour: number
          cron_start_minute: number | null
          evolution_api_key: string | null
          evolution_api_url: string | null
          evolution_instance_name: string | null
          gmail_app_password: string | null
          gmail_enabled: boolean
          gmail_recipients: string[] | null
          gmail_subject_template: string | null
          gmail_user: string | null
          id: string
          is_active: boolean
          message_template: string | null
          retry_window_minutes: number
          status_to_monitor: string[]
          updated_at: string
          whatsapp_enabled: boolean
          whatsapp_group_id: string | null
          whatsapp_mention_all: boolean
        }
        Insert: {
          created_at?: string
          cron_days?: string[]
          cron_end_hour?: number
          cron_end_minute?: number | null
          cron_interval_hours?: number
          cron_interval_minutes?: number | null
          cron_start_hour?: number
          cron_start_minute?: number | null
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          evolution_instance_name?: string | null
          gmail_app_password?: string | null
          gmail_enabled?: boolean
          gmail_recipients?: string[] | null
          gmail_subject_template?: string | null
          gmail_user?: string | null
          id?: string
          is_active?: boolean
          message_template?: string | null
          retry_window_minutes?: number
          status_to_monitor?: string[]
          updated_at?: string
          whatsapp_enabled?: boolean
          whatsapp_group_id?: string | null
          whatsapp_mention_all?: boolean
        }
        Update: {
          created_at?: string
          cron_days?: string[]
          cron_end_hour?: number
          cron_end_minute?: number | null
          cron_interval_hours?: number
          cron_interval_minutes?: number | null
          cron_start_hour?: number
          cron_start_minute?: number | null
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          evolution_instance_name?: string | null
          gmail_app_password?: string | null
          gmail_enabled?: boolean
          gmail_recipients?: string[] | null
          gmail_subject_template?: string | null
          gmail_user?: string | null
          id?: string
          is_active?: boolean
          message_template?: string | null
          retry_window_minutes?: number
          status_to_monitor?: string[]
          updated_at?: string
          whatsapp_enabled?: boolean
          whatsapp_group_id?: string | null
          whatsapp_mention_all?: boolean
        }
        Relationships: []
      }
      consulta_numeros_reminder_logs: {
        Row: {
          channel: string
          error_message: string | null
          id: string
          numbers_count: number
          numbers_list: string[] | null
          sent_at: string
          status: string
          status_monitored: string | null
        }
        Insert: {
          channel: string
          error_message?: string | null
          id?: string
          numbers_count?: number
          numbers_list?: string[] | null
          sent_at?: string
          status?: string
          status_monitored?: string | null
        }
        Update: {
          channel?: string
          error_message?: string | null
          id?: string
          numbers_count?: number
          numbers_list?: string[] | null
          sent_at?: string
          status?: string
          status_monitored?: string | null
        }
        Relationships: []
      }
      consulta_numeros_sync_status: {
        Row: {
          error_message: string | null
          id: string
          last_sync_at: string | null
          last_sync_status: string | null
          rows_synced: number | null
          updated_at: string
        }
        Insert: {
          error_message?: string | null
          id?: string
          last_sync_at?: string | null
          last_sync_status?: string | null
          rows_synced?: number | null
          updated_at?: string
        }
        Update: {
          error_message?: string | null
          id?: string
          last_sync_at?: string | null
          last_sync_status?: string | null
          rows_synced?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      consulta_numeros_tipo: {
        Row: {
          baserow_row_id: string
          created_at: string
          id: string
          tipo: string
        }
        Insert: {
          baserow_row_id: string
          created_at?: string
          id?: string
          tipo: string
        }
        Update: {
          baserow_row_id?: string
          created_at?: string
          id?: string
          tipo?: string
        }
        Relationships: []
      }
      consulta_numeros_webhooks: {
        Row: {
          created_at: string
          created_by: string | null
          eventos: string[]
          id: string
          is_active: boolean
          last_triggered_at: string | null
          nome: string
          secret_key: string | null
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          eventos?: string[]
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          nome: string
          secret_key?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          eventos?: string[]
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          nome?: string
          secret_key?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      custom_roles: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          display_name: string
          id: string
          is_system_role: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          display_name: string
          id?: string
          is_system_role?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          display_name?: string
          id?: string
          is_system_role?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      despesa_categorias: {
        Row: {
          cor: string | null
          created_at: string
          descricao: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          cor?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          cor?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      despesas: {
        Row: {
          categoria_id: string | null
          comprovante_url: string | null
          created_at: string
          created_by: string | null
          data_pagamento: string | null
          data_vencimento: string
          descricao: string
          id: string
          moeda: string
          observacao: string | null
          recorrencia: string | null
          status: string
          tipo: string
          updated_at: string
          valor: number
        }
        Insert: {
          categoria_id?: string | null
          comprovante_url?: string | null
          created_at?: string
          created_by?: string | null
          data_pagamento?: string | null
          data_vencimento: string
          descricao: string
          id?: string
          moeda?: string
          observacao?: string | null
          recorrencia?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          categoria_id?: string | null
          comprovante_url?: string | null
          created_at?: string
          created_by?: string | null
          data_pagamento?: string | null
          data_vencimento?: string
          descricao?: string
          id?: string
          moeda?: string
          observacao?: string | null
          recorrencia?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "despesas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "despesa_categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas_cron_config: {
        Row: {
          created_at: string
          day_of_month: number
          id: string
          is_active: boolean
          last_run_at: string | null
          last_run_message: string | null
          last_run_status: string | null
          next_run_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_month?: number
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          last_run_message?: string | null
          last_run_status?: string | null
          next_run_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_month?: number
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          last_run_message?: string | null
          last_run_status?: string | null
          next_run_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      despesas_cron_logs: {
        Row: {
          despesas_created: number | null
          despesas_skipped: number | null
          error_details: string | null
          executed_at: string
          id: string
          message: string | null
          status: string
          target_month: string | null
        }
        Insert: {
          despesas_created?: number | null
          despesas_skipped?: number | null
          error_details?: string | null
          executed_at?: string
          id?: string
          message?: string | null
          status: string
          target_month?: string | null
        }
        Update: {
          despesas_created?: number | null
          despesas_skipped?: number | null
          error_details?: string | null
          executed_at?: string
          id?: string
          message?: string | null
          status?: string
          target_month?: string | null
        }
        Relationships: []
      }
      divulgador_campaigns: {
        Row: {
          auto_create_groups: boolean | null
          created_at: string
          description: string | null
          id: string
          instance_id: string | null
          is_active: boolean | null
          max_participants_per_group: number | null
          min_empty_groups: number | null
          name: string
          updated_at: string
        }
        Insert: {
          auto_create_groups?: boolean | null
          created_at?: string
          description?: string | null
          id?: string
          instance_id?: string | null
          is_active?: boolean | null
          max_participants_per_group?: number | null
          min_empty_groups?: number | null
          name: string
          updated_at?: string
        }
        Update: {
          auto_create_groups?: boolean | null
          created_at?: string
          description?: string | null
          id?: string
          instance_id?: string | null
          is_active?: boolean | null
          max_participants_per_group?: number | null
          min_empty_groups?: number | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "divulgador_campaigns_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "divulgador_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      divulgador_config: {
        Row: {
          config_key: string
          config_value: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          config_key: string
          config_value: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          config_key?: string
          config_value?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      divulgador_groups: {
        Row: {
          announce: boolean
          campaign_id: string | null
          created_at: string
          description: string | null
          id: string
          instance_id: string | null
          invite_link: string | null
          is_active: boolean | null
          is_instance_admin: boolean | null
          member_add_mode: boolean
          name: string
          participant_count: number | null
          restrict: boolean
          updated_at: string
          whatsapp_group_id: string
        }
        Insert: {
          announce?: boolean
          campaign_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          instance_id?: string | null
          invite_link?: string | null
          is_active?: boolean | null
          is_instance_admin?: boolean | null
          member_add_mode?: boolean
          name: string
          participant_count?: number | null
          restrict?: boolean
          updated_at?: string
          whatsapp_group_id: string
        }
        Update: {
          announce?: boolean
          campaign_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          instance_id?: string | null
          invite_link?: string | null
          is_active?: boolean | null
          is_instance_admin?: boolean | null
          member_add_mode?: boolean
          name?: string
          participant_count?: number | null
          restrict?: boolean
          updated_at?: string
          whatsapp_group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "divulgador_groups_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "divulgador_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "divulgador_groups_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "divulgador_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      divulgador_instances: {
        Row: {
          api_key: string
          api_url: string
          created_at: string | null
          id: string
          instance_name: string
          is_active: boolean | null
          is_connected: boolean | null
          last_connected_at: string | null
          updated_at: string | null
        }
        Insert: {
          api_key: string
          api_url: string
          created_at?: string | null
          id?: string
          instance_name: string
          is_active?: boolean | null
          is_connected?: boolean | null
          last_connected_at?: string | null
          updated_at?: string | null
        }
        Update: {
          api_key?: string
          api_url?: string
          created_at?: string | null
          id?: string
          instance_name?: string
          is_active?: boolean | null
          is_connected?: boolean | null
          last_connected_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      divulgador_messages: {
        Row: {
          campaign_id: string | null
          content: string
          created_at: string
          delay_seconds: number | null
          group_id: string | null
          id: string
          media_type: string | null
          media_url: string | null
          mention_all: boolean | null
          poll_options: string[] | null
          poll_selectable_count: number | null
          resolution: string | null
          scheduled_at: string | null
          sent_at: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          campaign_id?: string | null
          content: string
          created_at?: string
          delay_seconds?: number | null
          group_id?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          mention_all?: boolean | null
          poll_options?: string[] | null
          poll_selectable_count?: number | null
          resolution?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          campaign_id?: string | null
          content?: string
          created_at?: string
          delay_seconds?: number | null
          group_id?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          mention_all?: boolean | null
          poll_options?: string[] | null
          poll_selectable_count?: number | null
          resolution?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "divulgador_messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "divulgador_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "divulgador_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "divulgador_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      divulgador_operation_logs: {
        Row: {
          created_at: string
          id: string
          message: string | null
          metadata: Json | null
          operation: string
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          metadata?: Json | null
          operation: string
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          metadata?: Json | null
          operation?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      divulgador_participants: {
        Row: {
          created_at: string
          group_id: string | null
          id: string
          is_admin: boolean | null
          is_inactive: boolean | null
          joined_at: string | null
          last_message_at: string | null
          left_at: string | null
          message_count: number | null
          name: string | null
          welcome_sent: boolean | null
          whatsapp_number: string
        }
        Insert: {
          created_at?: string
          group_id?: string | null
          id?: string
          is_admin?: boolean | null
          is_inactive?: boolean | null
          joined_at?: string | null
          last_message_at?: string | null
          left_at?: string | null
          message_count?: number | null
          name?: string | null
          welcome_sent?: boolean | null
          whatsapp_number: string
        }
        Update: {
          created_at?: string
          group_id?: string | null
          id?: string
          is_admin?: boolean | null
          is_inactive?: boolean | null
          joined_at?: string | null
          last_message_at?: string | null
          left_at?: string | null
          message_count?: number | null
          name?: string | null
          welcome_sent?: boolean | null
          whatsapp_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "divulgador_participants_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "divulgador_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      divulgador_poll_results: {
        Row: {
          created_at: string
          group_id: string | null
          id: string
          message_id: string | null
          option_name: string
          poll_name: string
          updated_at: string
          vote_count: number
          voters: string[] | null
        }
        Insert: {
          created_at?: string
          group_id?: string | null
          id?: string
          message_id?: string | null
          option_name: string
          poll_name: string
          updated_at?: string
          vote_count?: number
          voters?: string[] | null
        }
        Update: {
          created_at?: string
          group_id?: string | null
          id?: string
          message_id?: string | null
          option_name?: string
          poll_name?: string
          updated_at?: string
          vote_count?: number
          voters?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "divulgador_poll_results_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "divulgador_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "divulgador_poll_results_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "divulgador_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      divulgador_send_logs: {
        Row: {
          error_message: string | null
          group_id: string | null
          id: string
          message_id: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          error_message?: string | null
          group_id?: string | null
          id?: string
          message_id?: string | null
          sent_at?: string | null
          status: string
        }
        Update: {
          error_message?: string | null
          group_id?: string | null
          id?: string
          message_id?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "divulgador_send_logs_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "divulgador_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "divulgador_send_logs_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "divulgador_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      divulgador_welcome_config: {
        Row: {
          campaign_id: string | null
          created_at: string
          delay_seconds: number | null
          group_id: string | null
          id: string
          is_active: boolean | null
          message: string
          message_type: string
          updated_at: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          delay_seconds?: number | null
          group_id?: string | null
          id?: string
          is_active?: boolean | null
          message: string
          message_type?: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          delay_seconds?: number | null
          group_id?: string | null
          id?: string
          is_active?: boolean | null
          message?: string
          message_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "divulgador_welcome_config_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "divulgador_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "divulgador_welcome_config_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "divulgador_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      divulgador_whatsapp_instance: {
        Row: {
          api_key: string
          api_url: string
          created_at: string
          id: string
          instance_name: string
          is_connected: boolean | null
          last_connected_at: string | null
          updated_at: string
        }
        Insert: {
          api_key: string
          api_url: string
          created_at?: string
          id?: string
          instance_name: string
          is_connected?: boolean | null
          last_connected_at?: string | null
          updated_at?: string
        }
        Update: {
          api_key?: string
          api_url?: string
          created_at?: string
          id?: string
          instance_name?: string
          is_connected?: boolean | null
          last_connected_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      extrato_investimento_logs: {
        Row: {
          cliente_nome: string
          created_at: string
          gerado_por: string | null
          gerado_por_email: string | null
          id: string
          itens: Json
          qtd_numeros: number
          referencia: string | null
          total_mensal: number
          total_unico: number
        }
        Insert: {
          cliente_nome: string
          created_at?: string
          gerado_por?: string | null
          gerado_por_email?: string | null
          id?: string
          itens?: Json
          qtd_numeros?: number
          referencia?: string | null
          total_mensal?: number
          total_unico?: number
        }
        Update: {
          cliente_nome?: string
          created_at?: string
          gerado_por?: string | null
          gerado_por_email?: string | null
          id?: string
          itens?: Json
          qtd_numeros?: number
          referencia?: string | null
          total_mensal?: number
          total_unico?: number
        }
        Relationships: []
      }
      followup_config: {
        Row: {
          config_key: string
          config_value: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          config_key: string
          config_value: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          config_key?: string
          config_value?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      followup_webhook_logs: {
        Row: {
          created_at: string
          evento: string
          followup_id: string | null
          id: string
          payload: Json
          response_body: string | null
          response_status: number | null
          success: boolean
          webhook_id: string
        }
        Insert: {
          created_at?: string
          evento: string
          followup_id?: string | null
          id?: string
          payload: Json
          response_body?: string | null
          response_status?: number | null
          success?: boolean
          webhook_id: string
        }
        Update: {
          created_at?: string
          evento?: string
          followup_id?: string | null
          id?: string
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          success?: boolean
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "followup_webhook_logs_followup_id_fkey"
            columns: ["followup_id"]
            isOneToOne: false
            referencedRelation: "client_followups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_webhook_logs_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "followup_webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_webhooks: {
        Row: {
          created_at: string
          created_by: string | null
          eventos: string[]
          id: string
          is_active: boolean
          last_triggered_at: string | null
          nome: string
          secret_key: string | null
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          eventos?: string[]
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          nome: string
          secret_key?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          eventos?: string[]
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          nome?: string
          secret_key?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      gateway_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      gateway_coupon_usages: {
        Row: {
          coupon_id: string
          created_at: string
          discount_amount: number
          id: string
          order_id: string
        }
        Insert: {
          coupon_id: string
          created_at?: string
          discount_amount?: number
          id?: string
          order_id: string
        }
        Update: {
          coupon_id?: string
          created_at?: string
          discount_amount?: number
          id?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gateway_coupon_usages_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "gateway_coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gateway_coupon_usages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "gateway_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_coupons: {
        Row: {
          code: string
          created_at: string
          currency: string
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          max_uses_global: number | null
          max_uses_per_order: number | null
          starts_at: string | null
          status: string
          total_discount_given: number
          updated_at: string
          usage_count: number
        }
        Insert: {
          code: string
          created_at?: string
          currency?: string
          discount_type: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          max_uses_global?: number | null
          max_uses_per_order?: number | null
          starts_at?: string | null
          status?: string
          total_discount_given?: number
          updated_at?: string
          usage_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          currency?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          max_uses_global?: number | null
          max_uses_per_order?: number | null
          starts_at?: string | null
          status?: string
          total_discount_given?: number
          updated_at?: string
          usage_count?: number
        }
        Relationships: []
      }
      gateway_events: {
        Row: {
          coupon_code: string | null
          created_at: string
          currency: string | null
          event_type: string
          id: string
          metadata: Json | null
          order_bump_id: string | null
          order_id: string | null
          payment_gateway: string | null
          product_id: string | null
          referrer: string | null
          slug: string | null
          user_agent: string | null
        }
        Insert: {
          coupon_code?: string | null
          created_at?: string
          currency?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          order_bump_id?: string | null
          order_id?: string | null
          payment_gateway?: string | null
          product_id?: string | null
          referrer?: string | null
          slug?: string | null
          user_agent?: string | null
        }
        Update: {
          coupon_code?: string | null
          created_at?: string
          currency?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          order_bump_id?: string | null
          order_id?: string | null
          payment_gateway?: string | null
          product_id?: string | null
          referrer?: string | null
          slug?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      gateway_order_approvals: {
        Row: {
          approved_by: string
          created_at: string | null
          id: string
          new_status: string | null
          notes: string | null
          order_id: string
          previous_status: string | null
        }
        Insert: {
          approved_by: string
          created_at?: string | null
          id?: string
          new_status?: string | null
          notes?: string | null
          order_id: string
          previous_status?: string | null
        }
        Update: {
          approved_by?: string
          created_at?: string | null
          id?: string
          new_status?: string | null
          notes?: string | null
          order_id?: string
          previous_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gateway_order_approvals_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gateway_order_approvals_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "gateway_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_order_bumps: {
        Row: {
          allow_coupon: boolean
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          price_brl: number
          price_usd: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          allow_coupon?: boolean
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          price_brl?: number
          price_usd?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          allow_coupon?: boolean
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          price_brl?: number
          price_usd?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      gateway_order_items: {
        Row: {
          created_at: string
          id: string
          name: string
          order_bump_id: string
          order_id: string
          price: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          order_bump_id: string
          order_id: string
          price?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          order_bump_id?: string
          order_id?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "gateway_order_items_order_bump_id_fkey"
            columns: ["order_bump_id"]
            isOneToOne: false
            referencedRelation: "gateway_order_bumps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gateway_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "gateway_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_orders: {
        Row: {
          abandoned_email_sent: boolean
          approval_flow_step: string | null
          approved_by: string | null
          coupon_id: string | null
          created_at: string
          currency: string
          customer_cpf: string | null
          customer_email: string
          customer_name: string
          customer_phone: string | null
          discount_amount: number
          id: string
          ocr_amount: number | null
          ocr_status: string | null
          order_bump_id: string | null
          payment_gateway: string | null
          payment_id: string | null
          pix_transaction_id: string | null
          product_id: string | null
          proof_url: string | null
          rejection_reason: string | null
          status: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          abandoned_email_sent?: boolean
          approval_flow_step?: string | null
          approved_by?: string | null
          coupon_id?: string | null
          created_at?: string
          currency?: string
          customer_cpf?: string | null
          customer_email: string
          customer_name: string
          customer_phone?: string | null
          discount_amount?: number
          id?: string
          ocr_amount?: number | null
          ocr_status?: string | null
          order_bump_id?: string | null
          payment_gateway?: string | null
          payment_id?: string | null
          pix_transaction_id?: string | null
          product_id?: string | null
          proof_url?: string | null
          rejection_reason?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          abandoned_email_sent?: boolean
          approval_flow_step?: string | null
          approved_by?: string | null
          coupon_id?: string | null
          created_at?: string
          currency?: string
          customer_cpf?: string | null
          customer_email?: string
          customer_name?: string
          customer_phone?: string | null
          discount_amount?: number
          id?: string
          ocr_amount?: number | null
          ocr_status?: string | null
          order_bump_id?: string | null
          payment_gateway?: string | null
          payment_id?: string | null
          pix_transaction_id?: string | null
          product_id?: string | null
          proof_url?: string | null
          rejection_reason?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gateway_orders_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gateway_orders_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "gateway_coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gateway_orders_order_bump_id_fkey"
            columns: ["order_bump_id"]
            isOneToOne: false
            referencedRelation: "gateway_order_bumps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gateway_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "gateway_products"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_product_order_bumps: {
        Row: {
          created_at: string
          display_order: number
          id: string
          order_bump_id: string
          product_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          order_bump_id: string
          product_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          order_bump_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gateway_product_order_bumps_order_bump_id_fkey"
            columns: ["order_bump_id"]
            isOneToOne: false
            referencedRelation: "gateway_order_bumps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gateway_product_order_bumps_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "gateway_products"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_products: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          price_brl: number
          price_usd: number
          public_slug: string
          status: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          price_brl?: number
          price_usd?: number
          public_slug?: string
          status?: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          price_brl?: number
          price_usd?: number
          public_slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gateway_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "gateway_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      horario_cleanup_config: {
        Row: {
          cleanup_hour: number
          cleanup_minute: number
          enabled: boolean
          external_anon_key: string | null
          external_url: string | null
          id: number
          last_run_at: string | null
          last_run_deleted: number | null
          updated_at: string
        }
        Insert: {
          cleanup_hour?: number
          cleanup_minute?: number
          enabled?: boolean
          external_anon_key?: string | null
          external_url?: string | null
          id?: number
          last_run_at?: string | null
          last_run_deleted?: number | null
          updated_at?: string
        }
        Update: {
          cleanup_hour?: number
          cleanup_minute?: number
          enabled?: boolean
          external_anon_key?: string | null
          external_url?: string | null
          id?: number
          last_run_at?: string | null
          last_run_deleted?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      horario_comercial: {
        Row: {
          created_at: string
          id: number
          sabado_fim: string | null
          sabado_inicio: string | null
          semana_fim: string
          semana_inicio: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          sabado_fim?: string | null
          sabado_inicio?: string | null
          semana_fim?: string
          semana_inicio?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          sabado_fim?: string | null
          sabado_inicio?: string | null
          semana_fim?: string
          semana_inicio?: string
          updated_at?: string
        }
        Relationships: []
      }
      ig_auto_reply_history: {
        Row: {
          comment_text: string | null
          created_at: string
          dm_sent: boolean | null
          error_message: string | null
          id: string
          ig_comment_id: string
          ig_media_id: string | null
          ig_user_id: string | null
          ig_username: string | null
          public_response_sent: boolean | null
          rule_id: string | null
          user_id: string
        }
        Insert: {
          comment_text?: string | null
          created_at?: string
          dm_sent?: boolean | null
          error_message?: string | null
          id?: string
          ig_comment_id: string
          ig_media_id?: string | null
          ig_user_id?: string | null
          ig_username?: string | null
          public_response_sent?: boolean | null
          rule_id?: string | null
          user_id: string
        }
        Update: {
          comment_text?: string | null
          created_at?: string
          dm_sent?: boolean | null
          error_message?: string | null
          id?: string
          ig_comment_id?: string
          ig_media_id?: string | null
          ig_user_id?: string | null
          ig_username?: string | null
          public_response_sent?: boolean | null
          rule_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ig_auto_reply_history_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "ig_auto_reply_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      ig_auto_reply_rules: {
        Row: {
          active: boolean | null
          created_at: string
          daily_limit: number | null
          delay_seconds: number | null
          dm_response: string | null
          follower_only: boolean | null
          id: string
          keywords: string[] | null
          media_type: string | null
          name: string
          non_follower_response: string | null
          public_response: string | null
          specific_media_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          daily_limit?: number | null
          delay_seconds?: number | null
          dm_response?: string | null
          follower_only?: boolean | null
          id?: string
          keywords?: string[] | null
          media_type?: string | null
          name: string
          non_follower_response?: string | null
          public_response?: string | null
          specific_media_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          daily_limit?: number | null
          delay_seconds?: number | null
          dm_response?: string | null
          follower_only?: boolean | null
          id?: string
          keywords?: string[] | null
          media_type?: string | null
          name?: string
          non_follower_response?: string | null
          public_response?: string | null
          specific_media_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      instagram_competitor_analyses: {
        Row: {
          analysis_type: string
          competitor_id: string | null
          content: Json
          created_at: string
          created_by: string
          id: string
          model_used: string | null
          period_days: number
          posts_analyzed_count: number
        }
        Insert: {
          analysis_type: string
          competitor_id?: string | null
          content: Json
          created_at?: string
          created_by: string
          id?: string
          model_used?: string | null
          period_days?: number
          posts_analyzed_count?: number
        }
        Update: {
          analysis_type?: string
          competitor_id?: string | null
          content?: Json
          created_at?: string
          created_by?: string
          id?: string
          model_used?: string | null
          period_days?: number
          posts_analyzed_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "instagram_competitor_analyses_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "instagram_competitors"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_competitor_posts: {
        Row: {
          caption: string | null
          comments_count: number | null
          competitor_id: string
          hashtags: string[] | null
          id: string
          ig_media_id: string
          like_count: number | null
          media_product_type: string | null
          media_type: string
          media_url: string | null
          permalink: string | null
          posted_at: string | null
          synced_at: string
          thumbnail_url: string | null
          views_count: number | null
        }
        Insert: {
          caption?: string | null
          comments_count?: number | null
          competitor_id: string
          hashtags?: string[] | null
          id?: string
          ig_media_id: string
          like_count?: number | null
          media_product_type?: string | null
          media_type: string
          media_url?: string | null
          permalink?: string | null
          posted_at?: string | null
          synced_at?: string
          thumbnail_url?: string | null
          views_count?: number | null
        }
        Update: {
          caption?: string | null
          comments_count?: number | null
          competitor_id?: string
          hashtags?: string[] | null
          id?: string
          ig_media_id?: string
          like_count?: number | null
          media_product_type?: string | null
          media_type?: string
          media_url?: string | null
          permalink?: string | null
          posted_at?: string | null
          synced_at?: string
          thumbnail_url?: string | null
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "instagram_competitor_posts_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "instagram_competitors"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_competitors: {
        Row: {
          category: string
          created_at: string
          created_by: string
          display_name: string | null
          followers_count: number | null
          id: string
          ig_business_id: string | null
          is_active: boolean
          last_sync_error: string | null
          last_sync_status: string | null
          last_synced_at: string | null
          notes: string | null
          profile_picture_url: string | null
          updated_at: string
          username: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by: string
          display_name?: string | null
          followers_count?: number | null
          id?: string
          ig_business_id?: string | null
          is_active?: boolean
          last_sync_error?: string | null
          last_sync_status?: string | null
          last_synced_at?: string | null
          notes?: string | null
          profile_picture_url?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string
          display_name?: string | null
          followers_count?: number | null
          id?: string
          ig_business_id?: string | null
          is_active?: boolean
          last_sync_error?: string | null
          last_sync_status?: string | null
          last_synced_at?: string | null
          notes?: string | null
          profile_picture_url?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      instagram_espionage_config: {
        Row: {
          auto_analysis_enabled: boolean
          auto_sync_enabled: boolean
          created_at: string
          default_analysis_period_days: number
          default_analysis_type: string
          id: string
          last_auto_run_at: string | null
          last_auto_run_status: string | null
          max_competitors: number
          sync_frequency: string
          updated_at: string
        }
        Insert: {
          auto_analysis_enabled?: boolean
          auto_sync_enabled?: boolean
          created_at?: string
          default_analysis_period_days?: number
          default_analysis_type?: string
          id?: string
          last_auto_run_at?: string | null
          last_auto_run_status?: string | null
          max_competitors?: number
          sync_frequency?: string
          updated_at?: string
        }
        Update: {
          auto_analysis_enabled?: boolean
          auto_sync_enabled?: boolean
          created_at?: string
          default_analysis_period_days?: number
          default_analysis_type?: string
          id?: string
          last_auto_run_at?: string | null
          last_auto_run_status?: string | null
          max_competitors?: number
          sync_frequency?: string
          updated_at?: string
        }
        Relationships: []
      }
      instagram_oauth_invites: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          message: string | null
          profile_id: string
          status: string
          token: string
          used_at: string | null
          used_by_fb_user_id: string | null
          used_by_ig_username: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          message?: string | null
          profile_id: string
          status?: string
          token?: string
          used_at?: string | null
          used_by_fb_user_id?: string | null
          used_by_ig_username?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          message?: string | null
          profile_id?: string
          status?: string
          token?: string
          used_at?: string | null
          used_by_fb_user_id?: string | null
          used_by_ig_username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instagram_oauth_invites_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "social_media_client_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_settings: {
        Row: {
          access_token: string | null
          account_username: string | null
          app_id: string | null
          app_secret: string | null
          auto_reply_enabled: boolean | null
          created_at: string
          ig_user_id: string | null
          last_renewal_notification_at: string | null
          manager_numbers: Json | null
          notify_whatsapp: boolean | null
          page_id: string | null
          renewal_webhook_url: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
          webhook_verify_token: string | null
        }
        Insert: {
          access_token?: string | null
          account_username?: string | null
          app_id?: string | null
          app_secret?: string | null
          auto_reply_enabled?: boolean | null
          created_at?: string
          ig_user_id?: string | null
          last_renewal_notification_at?: string | null
          manager_numbers?: Json | null
          notify_whatsapp?: boolean | null
          page_id?: string | null
          renewal_webhook_url?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
          webhook_verify_token?: string | null
        }
        Update: {
          access_token?: string | null
          account_username?: string | null
          app_id?: string | null
          app_secret?: string | null
          auto_reply_enabled?: boolean | null
          created_at?: string
          ig_user_id?: string | null
          last_renewal_notification_at?: string | null
          manager_numbers?: Json | null
          notify_whatsapp?: boolean | null
          page_id?: string | null
          renewal_webhook_url?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
          webhook_verify_token?: string | null
        }
        Relationships: []
      }
      integration_logs: {
        Row: {
          created_at: string
          details: Json | null
          id: string
          integration_name: string
          message: string | null
          status: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          id?: string
          integration_name: string
          message?: string | null
          status: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          id?: string
          integration_name?: string
          message?: string | null
          status?: string
        }
        Relationships: []
      }
      integration_status: {
        Row: {
          category: string
          created_at: string
          display_name: string
          error_message: string | null
          id: string
          integration_name: string
          last_check: string | null
          metadata: Json | null
          response_time_ms: number | null
          status: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          display_name: string
          error_message?: string | null
          id?: string
          integration_name: string
          last_check?: string | null
          metadata?: Json | null
          response_time_ms?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          display_name?: string
          error_message?: string | null
          id?: string
          integration_name?: string
          last_check?: string | null
          metadata?: Json | null
          response_time_ms?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      lead_hunter_baserow_config: {
        Row: {
          api_token: string | null
          api_url: string | null
          created_at: string | null
          id: string
          is_enabled: boolean | null
          table_id: string | null
          updated_at: string | null
        }
        Insert: {
          api_token?: string | null
          api_url?: string | null
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          table_id?: string | null
          updated_at?: string | null
        }
        Update: {
          api_token?: string | null
          api_url?: string | null
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          table_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      lead_hunter_buscas: {
        Row: {
          created_at: string | null
          created_by: string | null
          erro_mensagem: string | null
          id: string
          localizacao: string | null
          query: string
          status: string | null
          total_resultados: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          erro_mensagem?: string | null
          id?: string
          localizacao?: string | null
          query: string
          status?: string | null
          total_resultados?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          erro_mensagem?: string | null
          id?: string
          localizacao?: string | null
          query?: string
          status?: string | null
          total_resultados?: number | null
        }
        Relationships: []
      }
      lead_hunter_campanhas: {
        Row: {
          created_at: string | null
          created_by: string | null
          delay_entre_mensagens: number | null
          descricao: string | null
          id: string
          mensagem_modelo: string | null
          meta_language_code: string | null
          meta_template_name: string | null
          modelo_ia: string | null
          nome: string
          prompt_ia: string | null
          provedor_ia: string | null
          status: string | null
          tipo_mensagem: string | null
          total_enviados: number | null
          total_erros: number | null
          total_leads: number | null
          total_respondidos: number | null
          updated_at: string | null
          whatsapp_provider: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          delay_entre_mensagens?: number | null
          descricao?: string | null
          id?: string
          mensagem_modelo?: string | null
          meta_language_code?: string | null
          meta_template_name?: string | null
          modelo_ia?: string | null
          nome: string
          prompt_ia?: string | null
          provedor_ia?: string | null
          status?: string | null
          tipo_mensagem?: string | null
          total_enviados?: number | null
          total_erros?: number | null
          total_leads?: number | null
          total_respondidos?: number | null
          updated_at?: string | null
          whatsapp_provider?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          delay_entre_mensagens?: number | null
          descricao?: string | null
          id?: string
          mensagem_modelo?: string | null
          meta_language_code?: string | null
          meta_template_name?: string | null
          modelo_ia?: string | null
          nome?: string
          prompt_ia?: string | null
          provedor_ia?: string | null
          status?: string | null
          tipo_mensagem?: string | null
          total_enviados?: number | null
          total_erros?: number | null
          total_leads?: number | null
          total_respondidos?: number | null
          updated_at?: string | null
          whatsapp_provider?: string | null
        }
        Relationships: []
      }
      lead_hunter_config: {
        Row: {
          config_key: string
          config_value: string
          created_at: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          config_key: string
          config_value?: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          config_key?: string
          config_value?: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      lead_hunter_leads: {
        Row: {
          avaliacao: number | null
          campanha_id: string | null
          categoria: string | null
          cidade: string | null
          created_at: string | null
          created_by: string | null
          dados_extras: Json | null
          email: string | null
          empresa: string | null
          endereco: string | null
          enviado_at: string | null
          enviado_por_instancia: string | null
          erro_mensagem: string | null
          estado: string | null
          fonte: string | null
          id: string
          nome: string | null
          status: string | null
          telefone: string
          updated_at: string | null
          website: string | null
        }
        Insert: {
          avaliacao?: number | null
          campanha_id?: string | null
          categoria?: string | null
          cidade?: string | null
          created_at?: string | null
          created_by?: string | null
          dados_extras?: Json | null
          email?: string | null
          empresa?: string | null
          endereco?: string | null
          enviado_at?: string | null
          enviado_por_instancia?: string | null
          erro_mensagem?: string | null
          estado?: string | null
          fonte?: string | null
          id?: string
          nome?: string | null
          status?: string | null
          telefone: string
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          avaliacao?: number | null
          campanha_id?: string | null
          categoria?: string | null
          cidade?: string | null
          created_at?: string | null
          created_by?: string | null
          dados_extras?: Json | null
          email?: string | null
          empresa?: string | null
          endereco?: string | null
          enviado_at?: string | null
          enviado_por_instancia?: string | null
          erro_mensagem?: string | null
          estado?: string | null
          fonte?: string | null
          id?: string
          nome?: string | null
          status?: string | null
          telefone?: string
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_hunter_leads_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "lead_hunter_campanhas"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_hunter_logs: {
        Row: {
          campanha_id: string | null
          created_at: string | null
          detalhes: Json | null
          id: string
          lead_id: string | null
          mensagem: string | null
          resultado: string | null
          tipo: string
        }
        Insert: {
          campanha_id?: string | null
          created_at?: string | null
          detalhes?: Json | null
          id?: string
          lead_id?: string | null
          mensagem?: string | null
          resultado?: string | null
          tipo: string
        }
        Update: {
          campanha_id?: string | null
          created_at?: string | null
          detalhes?: Json | null
          id?: string
          lead_id?: string | null
          mensagem?: string | null
          resultado?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_hunter_logs_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "lead_hunter_campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_hunter_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lead_hunter_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_hunter_whatsapp_instances: {
        Row: {
          api_key: string
          api_url: string
          created_at: string | null
          id: string
          instance_name: string
          is_active: boolean | null
          last_used_at: string | null
          updated_at: string | null
        }
        Insert: {
          api_key: string
          api_url: string
          created_at?: string | null
          id?: string
          instance_name: string
          is_active?: boolean | null
          last_used_at?: string | null
          updated_at?: string | null
        }
        Update: {
          api_key?: string
          api_url?: string
          created_at?: string | null
          id?: string
          instance_name?: string
          is_active?: boolean | null
          last_used_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      licencas_entregues: {
        Row: {
          cliente_id: string
          codigo_licenca: string
          created_at: string
          created_by: string | null
          data_entrega: string
          ferramenta: string
          id: string
          observacao: string | null
          origem: string
        }
        Insert: {
          cliente_id: string
          codigo_licenca: string
          created_at?: string
          created_by?: string | null
          data_entrega?: string
          ferramenta: string
          id?: string
          observacao?: string | null
          origem?: string
        }
        Update: {
          cliente_id?: string
          codigo_licenca?: string
          created_at?: string
          created_by?: string | null
          data_entrega?: string
          ferramenta?: string
          id?: string
          observacao?: string | null
          origem?: string
        }
        Relationships: [
          {
            foreignKeyName: "licencas_entregues_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      ligacoes_agendadas: {
        Row: {
          campanha_id: string | null
          cliente_id: string | null
          created_at: string
          dia_alvo: string
          erro: string | null
          historico_id: string | null
          id: string
          nome_manual: string | null
          numero_manual: string | null
          processada_em: string | null
          roteiro_id: string | null
          status: string
          tentativas: number
          tipo_d: string
          updated_at: string
        }
        Insert: {
          campanha_id?: string | null
          cliente_id?: string | null
          created_at?: string
          dia_alvo: string
          erro?: string | null
          historico_id?: string | null
          id?: string
          nome_manual?: string | null
          numero_manual?: string | null
          processada_em?: string | null
          roteiro_id?: string | null
          status?: string
          tentativas?: number
          tipo_d: string
          updated_at?: string
        }
        Update: {
          campanha_id?: string | null
          cliente_id?: string | null
          created_at?: string
          dia_alvo?: string
          erro?: string | null
          historico_id?: string | null
          id?: string
          nome_manual?: string | null
          numero_manual?: string | null
          processada_em?: string | null
          roteiro_id?: string | null
          status?: string
          tentativas?: number
          tipo_d?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ligacoes_agendadas_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "ligacoes_campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ligacoes_agendadas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ligacoes_agendadas_historico_id_fkey"
            columns: ["historico_id"]
            isOneToOne: false
            referencedRelation: "ligacoes_ia_historico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ligacoes_agendadas_roteiro_id_fkey"
            columns: ["roteiro_id"]
            isOneToOne: false
            referencedRelation: "ligacoes_ia_roteiros"
            referencedColumns: ["id"]
          },
        ]
      }
      ligacoes_campanhas: {
        Row: {
          created_at: string
          criado_por: string | null
          delay_minutes_override: number | null
          dia_alvo: string
          id: string
          nome: string
          roteiro_id: string | null
          status: string
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          delay_minutes_override?: number | null
          dia_alvo?: string
          id?: string
          nome: string
          roteiro_id?: string | null
          status?: string
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          delay_minutes_override?: number | null
          dia_alvo?: string
          id?: string
          nome?: string
          roteiro_id?: string | null
          status?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ligacoes_campanhas_roteiro_id_fkey"
            columns: ["roteiro_id"]
            isOneToOne: false
            referencedRelation: "ligacoes_ia_roteiros"
            referencedColumns: ["id"]
          },
        ]
      }
      ligacoes_ia_audios_cache: {
        Row: {
          cache_hash: string
          characters_count: number | null
          created_at: string
          duration_seconds: number | null
          hit_count: number
          id: string
          last_used_at: string
          roteiro_id: string | null
          size_bytes: number | null
          storage_path: string
          texto_final: string
          voice_id: string
        }
        Insert: {
          cache_hash: string
          characters_count?: number | null
          created_at?: string
          duration_seconds?: number | null
          hit_count?: number
          id?: string
          last_used_at?: string
          roteiro_id?: string | null
          size_bytes?: number | null
          storage_path: string
          texto_final: string
          voice_id: string
        }
        Update: {
          cache_hash?: string
          characters_count?: number | null
          created_at?: string
          duration_seconds?: number | null
          hit_count?: number
          id?: string
          last_used_at?: string
          roteiro_id?: string | null
          size_bytes?: number | null
          storage_path?: string
          texto_final?: string
          voice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ligacoes_ia_audios_cache_roteiro_id_fkey"
            columns: ["roteiro_id"]
            isOneToOne: false
            referencedRelation: "ligacoes_ia_roteiros"
            referencedColumns: ["id"]
          },
        ]
      }
      ligacoes_ia_config: {
        Row: {
          config_key: string
          config_value: string | null
          created_at: string
          description: string | null
          id: string
          is_secret: boolean
          updated_at: string
        }
        Insert: {
          config_key: string
          config_value?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_secret?: boolean
          updated_at?: string
        }
        Update: {
          config_key?: string
          config_value?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_secret?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      ligacoes_ia_historico: {
        Row: {
          answered_at: string | null
          attempt_number: number
          audio_cache_id: string | null
          cliente_id: string | null
          context: Json
          cost_cents: number | null
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          error_message: string | null
          fallback_audio_error: string | null
          fallback_audio_sent_at: string | null
          id: string
          numero_destino: string
          numero_origem: string | null
          raw_payload: Json | null
          recording_url: string | null
          roteiro_id: string | null
          source: string
          started_at: string | null
          status: string
          triggered_by: string | null
          updated_at: string
          wavoip_call_id: string | null
        }
        Insert: {
          answered_at?: string | null
          attempt_number?: number
          audio_cache_id?: string | null
          cliente_id?: string | null
          context?: Json
          cost_cents?: number | null
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          error_message?: string | null
          fallback_audio_error?: string | null
          fallback_audio_sent_at?: string | null
          id?: string
          numero_destino: string
          numero_origem?: string | null
          raw_payload?: Json | null
          recording_url?: string | null
          roteiro_id?: string | null
          source?: string
          started_at?: string | null
          status?: string
          triggered_by?: string | null
          updated_at?: string
          wavoip_call_id?: string | null
        }
        Update: {
          answered_at?: string | null
          attempt_number?: number
          audio_cache_id?: string | null
          cliente_id?: string | null
          context?: Json
          cost_cents?: number | null
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          error_message?: string | null
          fallback_audio_error?: string | null
          fallback_audio_sent_at?: string | null
          id?: string
          numero_destino?: string
          numero_origem?: string | null
          raw_payload?: Json | null
          recording_url?: string | null
          roteiro_id?: string | null
          source?: string
          started_at?: string | null
          status?: string
          triggered_by?: string | null
          updated_at?: string
          wavoip_call_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ligacoes_ia_historico_audio_cache_id_fkey"
            columns: ["audio_cache_id"]
            isOneToOne: false
            referencedRelation: "ligacoes_ia_audios_cache"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ligacoes_ia_historico_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ligacoes_ia_historico_roteiro_id_fkey"
            columns: ["roteiro_id"]
            isOneToOne: false
            referencedRelation: "ligacoes_ia_roteiros"
            referencedColumns: ["id"]
          },
        ]
      }
      ligacoes_ia_roteiros: {
        Row: {
          ativo: boolean
          categoria: string
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          idioma: string
          moeda: string
          nome: string
          texto: string
          tipo: string
          updated_at: string
          variaveis: string[]
          voice_id: string | null
          voice_settings: Json
        }
        Insert: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          idioma?: string
          moeda?: string
          nome: string
          texto: string
          tipo?: string
          updated_at?: string
          variaveis?: string[]
          voice_id?: string | null
          voice_settings?: Json
        }
        Update: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          idioma?: string
          moeda?: string
          nome?: string
          texto?: string
          tipo?: string
          updated_at?: string
          variaveis?: string[]
          voice_id?: string | null
          voice_settings?: Json
        }
        Relationships: []
      }
      marketing_expenses: {
        Row: {
          ano: number
          created_at: string
          descricao: string | null
          dividir_12: boolean | null
          id: string
          mes: number
          updated_at: string
          valor: number
        }
        Insert: {
          ano: number
          created_at?: string
          descricao?: string | null
          dividir_12?: boolean | null
          id?: string
          mes: number
          updated_at?: string
          valor?: number
        }
        Update: {
          ano?: number
          created_at?: string
          descricao?: string | null
          dividir_12?: boolean | null
          id?: string
          mes?: number
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      mcp_audit_log: {
        Row: {
          caller_api_key_hint: string | null
          caller_ip: string | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: string
          method: string | null
          payload: Json | null
          result_summary: Json | null
          success: boolean
          tool_name: string | null
          tool_type: string | null
        }
        Insert: {
          caller_api_key_hint?: string | null
          caller_ip?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          method?: string | null
          payload?: Json | null
          result_summary?: Json | null
          success?: boolean
          tool_name?: string | null
          tool_type?: string | null
        }
        Update: {
          caller_api_key_hint?: string | null
          caller_ip?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          method?: string | null
          payload?: Json | null
          result_summary?: Json | null
          success?: boolean
          tool_name?: string | null
          tool_type?: string | null
        }
        Relationships: []
      }
      mcp_config: {
        Row: {
          config_key: string
          config_value: string | null
          created_at: string | null
          description: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          config_key: string
          config_value?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          config_key?: string
          config_value?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      mcp_tools: {
        Row: {
          configuration: Json | null
          created_at: string | null
          description: string | null
          enabled: boolean | null
          id: string
          name: string
          tool_type: string
          updated_at: string | null
        }
        Insert: {
          configuration?: Json | null
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          name: string
          tool_type: string
          updated_at?: string | null
        }
        Update: {
          configuration?: Json | null
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          name?: string
          tool_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      meta_credentials: {
        Row: {
          access_token: string
          created_at: string | null
          id: string
          is_active: boolean | null
          phone_number_id: string
          updated_at: string | null
          waba_id: string
        }
        Insert: {
          access_token: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          phone_number_id: string
          updated_at?: string | null
          waba_id: string
        }
        Update: {
          access_token?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          phone_number_id?: string
          updated_at?: string | null
          waba_id?: string
        }
        Relationships: []
      }
      meta_template_mapping: {
        Row: {
          created_at: string | null
          event_key: string
          id: string
          language_code: string | null
          template_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          event_key: string
          id?: string
          language_code?: string | null
          template_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          event_key?: string
          id?: string
          language_code?: string | null
          template_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      numeros_aquecimento: {
        Row: {
          aparelho_id: string | null
          created_at: string
          created_by: string | null
          id: string
          modelo_id: string | null
          numero: string
          observacoes: string | null
          status_id: string | null
          tipo_whatsapp: string | null
          ultima_atividade: string
          updated_at: string
        }
        Insert: {
          aparelho_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          modelo_id?: string | null
          numero: string
          observacoes?: string | null
          status_id?: string | null
          tipo_whatsapp?: string | null
          ultima_atividade: string
          updated_at?: string
        }
        Update: {
          aparelho_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          modelo_id?: string | null
          numero?: string
          observacoes?: string | null
          status_id?: string | null
          tipo_whatsapp?: string | null
          ultima_atividade?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "numeros_aquecimento_aparelho_id_fkey"
            columns: ["aparelho_id"]
            isOneToOne: false
            referencedRelation: "numeros_aquecimento_aparelhos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "numeros_aquecimento_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "numeros_aquecimento_modelos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "numeros_aquecimento_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "numeros_aquecimento_status"
            referencedColumns: ["id"]
          },
        ]
      }
      numeros_aquecimento_alert_config: {
        Row: {
          alert_interval_hours: number
          alert_interval_minutes: number
          created_at: string
          id: string
          is_active: boolean
          last_alert_at: string | null
          message_template: string | null
          status_to_monitor: string[]
          updated_at: string
        }
        Insert: {
          alert_interval_hours?: number
          alert_interval_minutes?: number
          created_at?: string
          id?: string
          is_active?: boolean
          last_alert_at?: string | null
          message_template?: string | null
          status_to_monitor?: string[]
          updated_at?: string
        }
        Update: {
          alert_interval_hours?: number
          alert_interval_minutes?: number
          created_at?: string
          id?: string
          is_active?: boolean
          last_alert_at?: string | null
          message_template?: string | null
          status_to_monitor?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      numeros_aquecimento_aparelhos: {
        Row: {
          apelido: string
          capacidade_total: number
          created_at: string
          created_by: string | null
          id: string
          modelo_id: string | null
          observacoes: string | null
          updated_at: string
        }
        Insert: {
          apelido: string
          capacidade_total?: number
          created_at?: string
          created_by?: string | null
          id?: string
          modelo_id?: string | null
          observacoes?: string | null
          updated_at?: string
        }
        Update: {
          apelido?: string
          capacidade_total?: number
          created_at?: string
          created_by?: string | null
          id?: string
          modelo_id?: string | null
          observacoes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "numeros_aquecimento_aparelhos_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "numeros_aquecimento_modelos"
            referencedColumns: ["id"]
          },
        ]
      }
      numeros_aquecimento_api_keys: {
        Row: {
          api_key: string
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          is_active: boolean
          last_used_at: string | null
          nome: string
          updated_at: string
        }
        Insert: {
          api_key: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          nome: string
          updated_at?: string
        }
        Update: {
          api_key?: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      numeros_aquecimento_history: {
        Row: {
          acao: string
          campos_alterados: string[] | null
          created_at: string
          dados_anteriores: Json | null
          dados_novos: Json | null
          id: string
          numero_id: string | null
          numero_valor: string
          usuario_email: string | null
          usuario_id: string | null
        }
        Insert: {
          acao: string
          campos_alterados?: string[] | null
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          id?: string
          numero_id?: string | null
          numero_valor: string
          usuario_email?: string | null
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          campos_alterados?: string[] | null
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          id?: string
          numero_id?: string | null
          numero_valor?: string
          usuario_email?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "numeros_aquecimento_history_numero_id_fkey"
            columns: ["numero_id"]
            isOneToOne: false
            referencedRelation: "numeros_aquecimento"
            referencedColumns: ["id"]
          },
        ]
      }
      numeros_aquecimento_modelos: {
        Row: {
          aparece_no_checkin: boolean
          capacidade_whatsapp: number
          created_at: string
          descricao: string | null
          id: string
          marca: string | null
          nome: string
          updated_at: string
        }
        Insert: {
          aparece_no_checkin?: boolean
          capacidade_whatsapp?: number
          created_at?: string
          descricao?: string | null
          id?: string
          marca?: string | null
          nome: string
          updated_at?: string
        }
        Update: {
          aparece_no_checkin?: boolean
          capacidade_whatsapp?: number
          created_at?: string
          descricao?: string | null
          id?: string
          marca?: string | null
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      numeros_aquecimento_status: {
        Row: {
          cor: string | null
          created_at: string
          descricao: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          cor?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          cor?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      numeros_aquecimento_webhooks: {
        Row: {
          created_at: string
          created_by: string | null
          eventos: string[]
          id: string
          is_active: boolean
          nome: string
          secret_key: string | null
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          eventos?: string[]
          id?: string
          is_active?: boolean
          nome: string
          secret_key?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          eventos?: string[]
          id?: string
          is_active?: boolean
          nome?: string
          secret_key?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      password_recovery_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          recovery_method: string
          sent_by: string
          status: string
          user_email: string
          whatsapp_instance_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          recovery_method: string
          sent_by: string
          status?: string
          user_email: string
          whatsapp_instance_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          recovery_method?: string
          sent_by?: string
          status?: string
          user_email?: string
          whatsapp_instance_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "password_recovery_logs_whatsapp_instance_id_fkey"
            columns: ["whatsapp_instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      password_reset_tokens: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          token: string
          used: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          token: string
          used?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          token?: string
          used?: boolean
          user_id?: string
        }
        Relationships: []
      }
      payment_link_share_tokens: {
        Row: {
          allow_status_check: boolean
          allowed_providers: string[]
          created_at: string
          created_by: string | null
          created_by_email: string | null
          expires_at: string
          id: string
          token: string
        }
        Insert: {
          allow_status_check?: boolean
          allowed_providers?: string[]
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          expires_at: string
          id?: string
          token?: string
        }
        Update: {
          allow_status_check?: boolean
          allowed_providers?: string[]
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          expires_at?: string
          id?: string
          token?: string
        }
        Relationships: []
      }
      payment_links: {
        Row: {
          arquivado_em: string | null
          config_source: string
          created_at: string
          created_by: string | null
          created_by_email: string | null
          empresa: string
          expires_at: string
          external_reference: string | null
          id: string
          mp_payment_id: string | null
          paid_at: string | null
          payment_url: string
          preference_id: string | null
          provider: string
          provider_label: string
          status: string
          taxa_percentual: number
          valor_com_taxa: number
          valor_original: number
        }
        Insert: {
          arquivado_em?: string | null
          config_source: string
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          empresa: string
          expires_at: string
          external_reference?: string | null
          id?: string
          mp_payment_id?: string | null
          paid_at?: string | null
          payment_url: string
          preference_id?: string | null
          provider: string
          provider_label: string
          status?: string
          taxa_percentual?: number
          valor_com_taxa: number
          valor_original: number
        }
        Update: {
          arquivado_em?: string | null
          config_source?: string
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          empresa?: string
          expires_at?: string
          external_reference?: string | null
          id?: string
          mp_payment_id?: string | null
          paid_at?: string | null
          payment_url?: string
          preference_id?: string | null
          provider?: string
          provider_label?: string
          status?: string
          taxa_percentual?: number
          valor_com_taxa?: number
          valor_original?: number
        }
        Relationships: []
      }
      pipeline_ai_config: {
        Row: {
          api_key: string | null
          created_at: string
          enabled: boolean
          id: string
          model: string
          prompt_template: string
          provider: string
          updated_at: string
        }
        Insert: {
          api_key?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          model?: string
          prompt_template?: string
          provider?: string
          updated_at?: string
        }
        Update: {
          api_key?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          model?: string
          prompt_template?: string
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      pipeline_chatwoot_config: {
        Row: {
          account_id: string | null
          chatwoot_api_key: string | null
          chatwoot_url: string | null
          created_at: string | null
          enabled: boolean | null
          id: string
          inbox_id: string | null
          sync_conversations: boolean | null
          sync_leads: boolean | null
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          chatwoot_api_key?: string | null
          chatwoot_url?: string | null
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          inbox_id?: string | null
          sync_conversations?: boolean | null
          sync_leads?: boolean | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          chatwoot_api_key?: string | null
          chatwoot_url?: string | null
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          inbox_id?: string | null
          sync_conversations?: boolean | null
          sync_leads?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      pipeline_stages: {
        Row: {
          color: string | null
          created_at: string
          id: string
          is_default: boolean | null
          name: string
          order_index: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          is_default?: boolean | null
          name: string
          order_index?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          is_default?: boolean | null
          name?: string
          order_index?: number
          updated_at?: string
        }
        Relationships: []
      }
      pipeline_temporary_links: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          label: string | null
          token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          label?: string | null
          token: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          label?: string | null
          token?: string
          updated_at?: string
        }
        Relationships: []
      }
      plano_ferramentas: {
        Row: {
          created_at: string
          ferramenta: string
          id: string
          plano_id: string
          quantidade_licencas: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          ferramenta: string
          id?: string
          plano_id: string
          quantidade_licencas?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          ferramenta?: string
          id?: string
          plano_id?: string
          quantidade_licencas?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plano_ferramentas_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos_revendedor"
            referencedColumns: ["id"]
          },
        ]
      }
      planos_revendedor: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          is_active: boolean
          nome: string
          updated_at: string
          valor: number
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          is_active?: boolean
          nome: string
          updated_at?: string
          valor?: number
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          is_active?: boolean
          nome?: string
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      post_logs: {
        Row: {
          created_at: string
          id: string
          level: Database["public"]["Enums"]["log_level"]
          message: string
          post_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          level?: Database["public"]["Enums"]["log_level"]
          message: string
          post_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          level?: Database["public"]["Enums"]["log_level"]
          message?: string
          post_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_logs_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          caption: string | null
          created_at: string
          error_message: string | null
          id: string
          ig_media_id: string | null
          media_urls: string[]
          permalink: string | null
          published_at: string | null
          scheduled_for: string | null
          status: Database["public"]["Enums"]["post_status"]
          type: Database["public"]["Enums"]["post_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          ig_media_id?: string | null
          media_urls?: string[]
          permalink?: string | null
          published_at?: string | null
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          type?: Database["public"]["Enums"]["post_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          ig_media_id?: string | null
          media_urls?: string[]
          permalink?: string | null
          published_at?: string | null
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          type?: Database["public"]["Enums"]["post_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      predefined_products: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approval_status: string | null
          approved: boolean
          blocked_at: string | null
          blocked_by: string | null
          blocked_reason: string | null
          created_at: string
          email: string | null
          id: string
          is_blocked: boolean | null
          language: string | null
          name: string
          phone: string | null
          rejection_reason: string | null
          updated_at: string
          user_id: string
          user_response: string | null
        }
        Insert: {
          approval_status?: string | null
          approved?: boolean
          blocked_at?: string | null
          blocked_by?: string | null
          blocked_reason?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_blocked?: boolean | null
          language?: string | null
          name: string
          phone?: string | null
          rejection_reason?: string | null
          updated_at?: string
          user_id: string
          user_response?: string | null
        }
        Update: {
          approval_status?: string | null
          approved?: boolean
          blocked_at?: string | null
          blocked_by?: string | null
          blocked_reason?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_blocked?: boolean | null
          language?: string | null
          name?: string
          phone?: string | null
          rejection_reason?: string | null
          updated_at?: string
          user_id?: string
          user_response?: string | null
        }
        Relationships: []
      }
      proposal_auto_remarketing_logs: {
        Row: {
          channel: string
          day_number: number
          email_sent: boolean | null
          error_message: string | null
          id: string
          media_type: string | null
          media_url: string | null
          proposal_id: string
          sent_at: string
          status: string
          whatsapp_sent: boolean | null
        }
        Insert: {
          channel: string
          day_number: number
          email_sent?: boolean | null
          error_message?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          proposal_id: string
          sent_at?: string
          status?: string
          whatsapp_sent?: boolean | null
        }
        Update: {
          channel?: string
          day_number?: number
          email_sent?: boolean | null
          error_message?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          proposal_id?: string
          sent_at?: string
          status?: string
          whatsapp_sent?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_auto_remarketing_logs_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_branding: {
        Row: {
          accent_color: string | null
          certifications: Json | null
          client_logos: Json | null
          company_name: string | null
          cover_background_url: string | null
          created_at: string
          font_family: string | null
          footer_contact: string | null
          footer_social: Json | null
          footer_website: string | null
          id: string
          logo_url: string | null
          primary_color: string | null
          secondary_color: string | null
          show_logo_on_cover: boolean | null
          show_logo_on_pages: boolean | null
          tagline: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          certifications?: Json | null
          client_logos?: Json | null
          company_name?: string | null
          cover_background_url?: string | null
          created_at?: string
          font_family?: string | null
          footer_contact?: string | null
          footer_social?: Json | null
          footer_website?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          show_logo_on_cover?: boolean | null
          show_logo_on_pages?: boolean | null
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          certifications?: Json | null
          client_logos?: Json | null
          company_name?: string | null
          cover_background_url?: string | null
          created_at?: string
          font_family?: string | null
          footer_contact?: string | null
          footer_social?: Json | null
          footer_website?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          show_logo_on_cover?: boolean | null
          show_logo_on_pages?: boolean | null
          tagline?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      proposal_history: {
        Row: {
          action: string
          changes: Json | null
          created_at: string
          id: string
          proposal_id: string
          user_email: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string
          id?: string
          proposal_id: string
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string
          id?: string
          proposal_id?: string
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_history_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_scheduled_sends: {
        Row: {
          channel: string
          created_at: string
          created_by: string | null
          enable_password_protection: boolean | null
          error_message: string | null
          id: string
          proposal_id: string
          recipient_email: string | null
          recipient_name: string | null
          recipient_phone: string | null
          scheduled_at: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          channel?: string
          created_at?: string
          created_by?: string | null
          enable_password_protection?: boolean | null
          error_message?: string | null
          id?: string
          proposal_id: string
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          scheduled_at: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          created_by?: string | null
          enable_password_protection?: boolean | null
          error_message?: string | null
          id?: string
          proposal_id?: string
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_scheduled_sends_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_sections: {
        Row: {
          content: Json | null
          created_at: string
          id: string
          is_visible: boolean
          order_index: number
          proposal_id: string
          section_type: string
          title: string | null
          updated_at: string
        }
        Insert: {
          content?: Json | null
          created_at?: string
          id?: string
          is_visible?: boolean
          order_index?: number
          proposal_id: string
          section_type: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          content?: Json | null
          created_at?: string
          id?: string
          is_visible?: boolean
          order_index?: number
          proposal_id?: string
          section_type?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_sections_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_send_config: {
        Row: {
          auto_remarketing_channel: string
          auto_remarketing_cron_hour: number
          auto_remarketing_enabled: boolean
          auto_remarketing_max_days: number
          created_at: string
          elevenlabs_api_key: string | null
          elevenlabs_voice_id: string | null
          email_body_template: string | null
          email_enabled: boolean | null
          email_remarketing_body_template: string | null
          email_remarketing_subject_template: string | null
          email_subject_template: string | null
          evolution_api_key: string | null
          evolution_api_url: string | null
          evolution_instance_name: string | null
          ghost_audio_url: string | null
          ghost_mode_day: number | null
          ghost_mode_enabled: boolean | null
          ghost_mode_type: string | null
          ghost_video_url: string | null
          ghost_view_threshold: number | null
          gmail_app_password: string | null
          gmail_sender_name: string | null
          gmail_user: string | null
          id: string
          tts_text: string | null
          updated_at: string
          whatsapp_enabled: boolean | null
          whatsapp_message_template: string | null
          whatsapp_remarketing_template: string | null
        }
        Insert: {
          auto_remarketing_channel?: string
          auto_remarketing_cron_hour?: number
          auto_remarketing_enabled?: boolean
          auto_remarketing_max_days?: number
          created_at?: string
          elevenlabs_api_key?: string | null
          elevenlabs_voice_id?: string | null
          email_body_template?: string | null
          email_enabled?: boolean | null
          email_remarketing_body_template?: string | null
          email_remarketing_subject_template?: string | null
          email_subject_template?: string | null
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          evolution_instance_name?: string | null
          ghost_audio_url?: string | null
          ghost_mode_day?: number | null
          ghost_mode_enabled?: boolean | null
          ghost_mode_type?: string | null
          ghost_video_url?: string | null
          ghost_view_threshold?: number | null
          gmail_app_password?: string | null
          gmail_sender_name?: string | null
          gmail_user?: string | null
          id?: string
          tts_text?: string | null
          updated_at?: string
          whatsapp_enabled?: boolean | null
          whatsapp_message_template?: string | null
          whatsapp_remarketing_template?: string | null
        }
        Update: {
          auto_remarketing_channel?: string
          auto_remarketing_cron_hour?: number
          auto_remarketing_enabled?: boolean
          auto_remarketing_max_days?: number
          created_at?: string
          elevenlabs_api_key?: string | null
          elevenlabs_voice_id?: string | null
          email_body_template?: string | null
          email_enabled?: boolean | null
          email_remarketing_body_template?: string | null
          email_remarketing_subject_template?: string | null
          email_subject_template?: string | null
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          evolution_instance_name?: string | null
          ghost_audio_url?: string | null
          ghost_mode_day?: number | null
          ghost_mode_enabled?: boolean | null
          ghost_mode_type?: string | null
          ghost_video_url?: string | null
          ghost_view_threshold?: number | null
          gmail_app_password?: string | null
          gmail_sender_name?: string | null
          gmail_user?: string | null
          id?: string
          tts_text?: string | null
          updated_at?: string
          whatsapp_enabled?: boolean | null
          whatsapp_message_template?: string | null
          whatsapp_remarketing_template?: string | null
        }
        Relationships: []
      }
      proposal_send_logs: {
        Row: {
          channel: string
          error_message: string | null
          id: string
          proposal_id: string
          recipient: string
          sent_at: string
          sent_by: string | null
          sent_by_email: string | null
          status: string
        }
        Insert: {
          channel: string
          error_message?: string | null
          id?: string
          proposal_id: string
          recipient: string
          sent_at?: string
          sent_by?: string | null
          sent_by_email?: string | null
          status?: string
        }
        Update: {
          channel?: string
          error_message?: string | null
          id?: string
          proposal_id?: string
          recipient?: string
          sent_at?: string
          sent_by?: string | null
          sent_by_email?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_send_logs_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_status_notification_logs: {
        Row: {
          channel: string
          error_message: string | null
          id: string
          message_sent: string | null
          proposal_id: string | null
          recipient: string | null
          sent_at: string
          status: string | null
          status_change: string
        }
        Insert: {
          channel: string
          error_message?: string | null
          id?: string
          message_sent?: string | null
          proposal_id?: string | null
          recipient?: string | null
          sent_at?: string
          status?: string | null
          status_change: string
        }
        Update: {
          channel?: string
          error_message?: string | null
          id?: string
          message_sent?: string | null
          proposal_id?: string | null
          recipient?: string | null
          sent_at?: string
          status?: string | null
          status_change?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_status_notification_logs_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_status_notifications: {
        Row: {
          accept_channel: string | null
          accept_enabled: boolean | null
          accept_message_template: string | null
          created_at: string
          enabled: boolean | null
          id: string
          manager_accept_message: string | null
          manager_delay_seconds: number
          manager_notify_enabled: boolean | null
          manager_numbers: string[] | null
          manager_reject_message: string | null
          reject_channel: string | null
          reject_enabled: boolean | null
          reject_message_template: string | null
          updated_at: string
        }
        Insert: {
          accept_channel?: string | null
          accept_enabled?: boolean | null
          accept_message_template?: string | null
          created_at?: string
          enabled?: boolean | null
          id?: string
          manager_accept_message?: string | null
          manager_delay_seconds?: number
          manager_notify_enabled?: boolean | null
          manager_numbers?: string[] | null
          manager_reject_message?: string | null
          reject_channel?: string | null
          reject_enabled?: boolean | null
          reject_message_template?: string | null
          updated_at?: string
        }
        Update: {
          accept_channel?: string | null
          accept_enabled?: boolean | null
          accept_message_template?: string | null
          created_at?: string
          enabled?: boolean | null
          id?: string
          manager_accept_message?: string | null
          manager_delay_seconds?: number
          manager_notify_enabled?: boolean | null
          manager_numbers?: string[] | null
          manager_reject_message?: string | null
          reject_channel?: string | null
          reject_enabled?: boolean | null
          reject_message_template?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      proposal_tts_logs: {
        Row: {
          action: string
          created_at: string
          error_details: Json | null
          id: string
          response_time_ms: number | null
          status: string
          text_preview: string | null
          user_id: string | null
          voice_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          error_details?: Json | null
          id?: string
          response_time_ms?: number | null
          status: string
          text_preview?: string | null
          user_id?: string | null
          voice_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          error_details?: Json | null
          id?: string
          response_time_ms?: number | null
          status?: string
          text_preview?: string | null
          user_id?: string | null
          voice_id?: string | null
        }
        Relationships: []
      }
      proposal_view_logs: {
        Row: {
          city: string | null
          country: string | null
          id: string
          ip_address: string | null
          proposal_id: string
          user_agent: string | null
          viewed_at: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          id?: string
          ip_address?: string | null
          proposal_id: string
          user_agent?: string | null
          viewed_at?: string
        }
        Update: {
          city?: string | null
          country?: string | null
          id?: string
          ip_address?: string | null
          proposal_id?: string
          user_agent?: string | null
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_view_logs_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_views: {
        Row: {
          created_at: string
          event_data: Json | null
          event_type: string
          id: string
          ip_address: string | null
          proposal_id: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          event_data?: Json | null
          event_type: string
          id?: string
          ip_address?: string | null
          proposal_id: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          ip_address?: string | null
          proposal_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_views_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_webhook_logs: {
        Row: {
          created_at: string
          evento: string
          id: string
          payload: Json
          proposal_id: string | null
          response_body: string | null
          response_status: number | null
          success: boolean | null
          webhook_id: string | null
        }
        Insert: {
          created_at?: string
          evento: string
          id?: string
          payload: Json
          proposal_id?: string | null
          response_body?: string | null
          response_status?: number | null
          success?: boolean | null
          webhook_id?: string | null
        }
        Update: {
          created_at?: string
          evento?: string
          id?: string
          payload?: Json
          proposal_id?: string | null
          response_body?: string | null
          response_status?: number | null
          success?: boolean | null
          webhook_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_webhook_logs_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_webhook_logs_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "proposal_webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_webhooks: {
        Row: {
          created_at: string
          eventos: string[] | null
          id: string
          is_active: boolean | null
          last_triggered_at: string | null
          nome: string
          secret_key: string | null
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          eventos?: string[] | null
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          nome: string
          secret_key?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          eventos?: string[] | null
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          nome?: string
          secret_key?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      proposals: {
        Row: {
          client_id: string | null
          client_signature: string | null
          created_at: string
          currency: string
          expires_at: string | null
          id: string
          is_password_protected: boolean | null
          manual_client_email: string | null
          manual_client_name: string | null
          manual_client_phone: string | null
          notes: string | null
          password_channel: string | null
          password_hash: string | null
          rejection_reason: string | null
          share_token: string
          signature_image: string | null
          signed_at: string | null
          signed_ip: string | null
          signed_name: string | null
          signed_status: string | null
          status: Database["public"]["Enums"]["proposal_status"]
          template_id: string | null
          title: string
          total_value: number | null
          updated_at: string
          user_id: string
          valid_until: string | null
          view_count: number | null
        }
        Insert: {
          client_id?: string | null
          client_signature?: string | null
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          is_password_protected?: boolean | null
          manual_client_email?: string | null
          manual_client_name?: string | null
          manual_client_phone?: string | null
          notes?: string | null
          password_channel?: string | null
          password_hash?: string | null
          rejection_reason?: string | null
          share_token?: string
          signature_image?: string | null
          signed_at?: string | null
          signed_ip?: string | null
          signed_name?: string | null
          signed_status?: string | null
          status?: Database["public"]["Enums"]["proposal_status"]
          template_id?: string | null
          title?: string
          total_value?: number | null
          updated_at?: string
          user_id: string
          valid_until?: string | null
          view_count?: number | null
        }
        Update: {
          client_id?: string | null
          client_signature?: string | null
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          is_password_protected?: boolean | null
          manual_client_email?: string | null
          manual_client_name?: string | null
          manual_client_phone?: string | null
          notes?: string | null
          password_channel?: string | null
          password_hash?: string | null
          rejection_reason?: string | null
          share_token?: string
          signature_image?: string | null
          signed_at?: string | null
          signed_ip?: string | null
          signed_name?: string | null
          signed_status?: string | null
          status?: Database["public"]["Enums"]["proposal_status"]
          template_id?: string | null
          title?: string
          total_value?: number | null
          updated_at?: string
          user_id?: string
          valid_until?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_scan_checkins_diarios: {
        Row: {
          aparelho_id: string | null
          baserow_row_id: number | null
          cliente_nome: string | null
          created_at: string
          created_by: string | null
          data_checkin: string
          id: string
          modelo_id: string | null
          modelo_snapshot: string | null
          numero: string
          observacao: string | null
          status_conexao: string
          status_geral: string | null
          tipo_slot: string
          updated_at: string
        }
        Insert: {
          aparelho_id?: string | null
          baserow_row_id?: number | null
          cliente_nome?: string | null
          created_at?: string
          created_by?: string | null
          data_checkin?: string
          id?: string
          modelo_id?: string | null
          modelo_snapshot?: string | null
          numero: string
          observacao?: string | null
          status_conexao?: string
          status_geral?: string | null
          tipo_slot: string
          updated_at?: string
        }
        Update: {
          aparelho_id?: string | null
          baserow_row_id?: number | null
          cliente_nome?: string | null
          created_at?: string
          created_by?: string | null
          data_checkin?: string
          id?: string
          modelo_id?: string | null
          modelo_snapshot?: string | null
          numero?: string
          observacao?: string | null
          status_conexao?: string
          status_geral?: string | null
          tipo_slot?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qr_scan_checkins_diarios_aparelho_id_fkey"
            columns: ["aparelho_id"]
            isOneToOne: false
            referencedRelation: "numeros_aquecimento_aparelhos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_scan_checkins_diarios_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "numeros_aquecimento_modelos"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_scan_config: {
        Row: {
          ativo: boolean
          checkin_ativo_dias: number
          created_at: string
          id: string
          payment_provider_default: string
          qtd_gratis_por_mes: number
          qtd_por_dia: number
          updated_at: string
          valor_excedente: number
        }
        Insert: {
          ativo?: boolean
          checkin_ativo_dias?: number
          created_at?: string
          id?: string
          payment_provider_default?: string
          qtd_gratis_por_mes?: number
          qtd_por_dia?: number
          updated_at?: string
          valor_excedente?: number
        }
        Update: {
          ativo?: boolean
          checkin_ativo_dias?: number
          created_at?: string
          id?: string
          payment_provider_default?: string
          qtd_gratis_por_mes?: number
          qtd_por_dia?: number
          updated_at?: string
          valor_excedente?: number
        }
        Relationships: []
      }
      qr_scan_history: {
        Row: {
          baserow_row_id: number
          cliente_nome: string | null
          confirmed_by: string | null
          created_at: string
          id: string
          numero: string
          observacao: string | null
          operador_user_id: string | null
          paid_at: string | null
          payment_comprovante_url: string | null
          payment_link_id: string | null
          payment_manual_observacao: string | null
          payment_method: string | null
          payment_status: string
          scan_date: string
          tipo: string
          updated_at: string
          valor_cobrado: number | null
        }
        Insert: {
          baserow_row_id: number
          cliente_nome?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          numero: string
          observacao?: string | null
          operador_user_id?: string | null
          paid_at?: string | null
          payment_comprovante_url?: string | null
          payment_link_id?: string | null
          payment_manual_observacao?: string | null
          payment_method?: string | null
          payment_status?: string
          scan_date?: string
          tipo: string
          updated_at?: string
          valor_cobrado?: number | null
        }
        Update: {
          baserow_row_id?: number
          cliente_nome?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          numero?: string
          observacao?: string | null
          operador_user_id?: string | null
          paid_at?: string | null
          payment_comprovante_url?: string | null
          payment_link_id?: string | null
          payment_manual_observacao?: string | null
          payment_method?: string | null
          payment_status?: string
          scan_date?: string
          tipo?: string
          updated_at?: string
          valor_cobrado?: number | null
        }
        Relationships: []
      }
      qr_scan_insurance_payment_status: {
        Row: {
          ano: number
          baserow_row_id: number
          created_at: string
          id: string
          marcado_em: string
          marcado_por: string | null
          mes: number
          observacao: string | null
          status: string
          updated_at: string
        }
        Insert: {
          ano: number
          baserow_row_id: number
          created_at?: string
          id?: string
          marcado_em?: string
          marcado_por?: string | null
          mes: number
          observacao?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          ano?: number
          baserow_row_id?: number
          created_at?: string
          id?: string
          marcado_em?: string
          marcado_por?: string | null
          mes?: number
          observacao?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      qr_scan_insurance_usage: {
        Row: {
          baserow_row_id: number
          cliente_nome: string | null
          created_at: string
          id: string
          numero: string
          observacao: string | null
          operador_id: string | null
          used_at: string
        }
        Insert: {
          baserow_row_id: number
          cliente_nome?: string | null
          created_at?: string
          id?: string
          numero: string
          observacao?: string | null
          operador_id?: string | null
          used_at?: string
        }
        Update: {
          baserow_row_id?: number
          cliente_nome?: string | null
          created_at?: string
          id?: string
          numero?: string
          observacao?: string | null
          operador_id?: string | null
          used_at?: string
        }
        Relationships: []
      }
      qr_scan_monthly_counter: {
        Row: {
          ano: number
          baserow_row_id: number
          created_at: string
          id: string
          mes: number
          qtd_gratis_usados: number
          qtd_pagos: number
          updated_at: string
        }
        Insert: {
          ano: number
          baserow_row_id: number
          created_at?: string
          id?: string
          mes: number
          qtd_gratis_usados?: number
          qtd_pagos?: number
          updated_at?: string
        }
        Update: {
          ano?: number
          baserow_row_id?: number
          created_at?: string
          id?: string
          mes?: number
          qtd_gratis_usados?: number
          qtd_pagos?: number
          updated_at?: string
        }
        Relationships: []
      }
      rcs_messages: {
        Row: {
          conteudo: string
          created_at: string
          error_message: string | null
          id: string
          numero_destino: string
          session_id: string | null
          status: string
          template_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          conteudo: string
          created_at?: string
          error_message?: string | null
          id?: string
          numero_destino: string
          session_id?: string | null
          status?: string
          template_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          conteudo?: string
          created_at?: string
          error_message?: string | null
          id?: string
          numero_destino?: string
          session_id?: string | null
          status?: string
          template_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rcs_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "rcs_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rcs_messages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "rcs_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      rcs_sessions: {
        Row: {
          created_at: string
          id: string
          last_connected_at: string | null
          name: string
          provider: string | null
          provider_config: Json | null
          qr_code: string | null
          session_data: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          last_connected_at?: string | null
          name: string
          provider?: string | null
          provider_config?: Json | null
          qr_code?: string | null
          session_data?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          last_connected_at?: string | null
          name?: string
          provider?: string | null
          provider_config?: Json | null
          qr_code?: string | null
          session_data?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      rcs_templates: {
        Row: {
          ativo: boolean | null
          botoes: Json | null
          conteudo: string
          created_at: string
          id: string
          nome: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ativo?: boolean | null
          botoes?: Json | null
          conteudo: string
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ativo?: boolean | null
          botoes?: Json | null
          conteudo?: string
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      recovery_config: {
        Row: {
          config_key: string
          config_value: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          config_key: string
          config_value: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          config_key?: string
          config_value?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      reports_analysis_config: {
        Row: {
          ai_model: string | null
          ai_provider: string | null
          created_at: string
          custom_prompt: string | null
          email_recipients: string[] | null
          frequency: string | null
          gmail_app_password: string | null
          gmail_sender_name: string | null
          gmail_user: string | null
          grok_api_key: string | null
          id: string
          is_active: boolean | null
          last_analysis_at: string | null
          notify_email: boolean | null
          notify_whatsapp: boolean | null
          openai_api_key: string | null
          schedule_hour: number | null
          schedule_minute: number | null
          updated_at: string
          whatsapp_recipients: string[] | null
        }
        Insert: {
          ai_model?: string | null
          ai_provider?: string | null
          created_at?: string
          custom_prompt?: string | null
          email_recipients?: string[] | null
          frequency?: string | null
          gmail_app_password?: string | null
          gmail_sender_name?: string | null
          gmail_user?: string | null
          grok_api_key?: string | null
          id?: string
          is_active?: boolean | null
          last_analysis_at?: string | null
          notify_email?: boolean | null
          notify_whatsapp?: boolean | null
          openai_api_key?: string | null
          schedule_hour?: number | null
          schedule_minute?: number | null
          updated_at?: string
          whatsapp_recipients?: string[] | null
        }
        Update: {
          ai_model?: string | null
          ai_provider?: string | null
          created_at?: string
          custom_prompt?: string | null
          email_recipients?: string[] | null
          frequency?: string | null
          gmail_app_password?: string | null
          gmail_sender_name?: string | null
          gmail_user?: string | null
          grok_api_key?: string | null
          id?: string
          is_active?: boolean | null
          last_analysis_at?: string | null
          notify_email?: boolean | null
          notify_whatsapp?: boolean | null
          openai_api_key?: string | null
          schedule_hour?: number | null
          schedule_minute?: number | null
          updated_at?: string
          whatsapp_recipients?: string[] | null
        }
        Relationships: []
      }
      reports_analysis_history: {
        Row: {
          ai_model: string | null
          ai_provider: string
          analysis_text: string
          created_at: string
          created_by: string | null
          id: string
          metrics_snapshot: Json | null
          notification_channels: string[] | null
          notification_sent: boolean | null
          prompt_used: string | null
        }
        Insert: {
          ai_model?: string | null
          ai_provider: string
          analysis_text: string
          created_at?: string
          created_by?: string | null
          id?: string
          metrics_snapshot?: Json | null
          notification_channels?: string[] | null
          notification_sent?: boolean | null
          prompt_used?: string | null
        }
        Update: {
          ai_model?: string | null
          ai_provider?: string
          analysis_text?: string
          created_at?: string
          created_by?: string | null
          id?: string
          metrics_snapshot?: Json | null
          notification_channels?: string[] | null
          notification_sent?: boolean | null
          prompt_used?: string | null
        }
        Relationships: []
      }
      reports_notification_logs: {
        Row: {
          analysis_id: string | null
          channel: string
          created_at: string
          error_message: string | null
          id: string
          recipient: string
          status: string
        }
        Insert: {
          analysis_id?: string | null
          channel: string
          created_at?: string
          error_message?: string | null
          id?: string
          recipient: string
          status?: string
        }
        Update: {
          analysis_id?: string | null
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          recipient?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_notification_logs_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "reports_analysis_history"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string | null
          id: string
          permission_key: string
          role_name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          permission_key: string
          role_name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          permission_key?: string
          role_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "system_permissions"
            referencedColumns: ["key"]
          },
        ]
      }
      sales_forecasts: {
        Row: {
          cold_leads: number
          confidence_pct: number
          created_at: string
          generated_at: string
          generated_by: string | null
          hot_leads: number
          id: string
          opportunities: Json | null
          period_end: string
          period_start: string
          pipeline_value_brl: number
          pipeline_value_usd: number
          predicted_revenue_brl: number
          predicted_revenue_usd: number
          raw_analysis: Json | null
          reasoning: string | null
          recommended_actions: Json | null
          risks: Json | null
          total_leads: number
          warm_leads: number
        }
        Insert: {
          cold_leads?: number
          confidence_pct?: number
          created_at?: string
          generated_at?: string
          generated_by?: string | null
          hot_leads?: number
          id?: string
          opportunities?: Json | null
          period_end: string
          period_start: string
          pipeline_value_brl?: number
          pipeline_value_usd?: number
          predicted_revenue_brl?: number
          predicted_revenue_usd?: number
          raw_analysis?: Json | null
          reasoning?: string | null
          recommended_actions?: Json | null
          risks?: Json | null
          total_leads?: number
          warm_leads?: number
        }
        Update: {
          cold_leads?: number
          confidence_pct?: number
          created_at?: string
          generated_at?: string
          generated_by?: string | null
          hot_leads?: number
          id?: string
          opportunities?: Json | null
          period_end?: string
          period_start?: string
          pipeline_value_brl?: number
          pipeline_value_usd?: number
          predicted_revenue_brl?: number
          predicted_revenue_usd?: number
          raw_analysis?: Json | null
          reasoning?: string | null
          recommended_actions?: Json | null
          risks?: Json | null
          total_leads?: number
          warm_leads?: number
        }
        Relationships: []
      }
      shared_access_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          target_url: string
          token: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          target_url: string
          token: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          target_url?: string
          token?: string
        }
        Relationships: []
      }
      sms_agendados: {
        Row: {
          campanha_id: string | null
          cliente_id: string | null
          created_at: string
          dia_alvo: string
          erro: string | null
          historico_id: string | null
          id: string
          nome_manual: string | null
          numero_manual: string | null
          processada_em: string | null
          status: string
          template_id: string | null
          tentativas: number
          tipo_d: string | null
          updated_at: string
        }
        Insert: {
          campanha_id?: string | null
          cliente_id?: string | null
          created_at?: string
          dia_alvo: string
          erro?: string | null
          historico_id?: string | null
          id?: string
          nome_manual?: string | null
          numero_manual?: string | null
          processada_em?: string | null
          status?: string
          template_id?: string | null
          tentativas?: number
          tipo_d?: string | null
          updated_at?: string
        }
        Update: {
          campanha_id?: string | null
          cliente_id?: string | null
          created_at?: string
          dia_alvo?: string
          erro?: string | null
          historico_id?: string | null
          id?: string
          nome_manual?: string | null
          numero_manual?: string | null
          processada_em?: string | null
          status?: string
          template_id?: string | null
          tentativas?: number
          tipo_d?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_agendados_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "sms_campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_agendados_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_agendados_historico_id_fkey"
            columns: ["historico_id"]
            isOneToOne: false
            referencedRelation: "sms_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_agendados_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "sms_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_campanhas: {
        Row: {
          created_at: string
          criado_por: string | null
          delay_minutes_override: number | null
          dia_alvo: string | null
          id: string
          nome: string
          status: string
          template_id: string | null
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          delay_minutes_override?: number | null
          dia_alvo?: string | null
          id?: string
          nome: string
          status?: string
          template_id?: string | null
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          delay_minutes_override?: number | null
          dia_alvo?: string | null
          id?: string
          nome?: string
          status?: string
          template_id?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_campanhas_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "sms_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_cobranca_config: {
        Row: {
          apenas_cobranca_ativa: boolean
          created_at: string
          delay_minutes: number
          dias_disparo: number[] | null
          enabled: boolean
          horario_fim: string | null
          horario_inicio: string | null
          id: string
          template_id: string | null
          updated_at: string
        }
        Insert: {
          apenas_cobranca_ativa?: boolean
          created_at?: string
          delay_minutes?: number
          dias_disparo?: number[] | null
          enabled?: boolean
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: string
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          apenas_cobranca_ativa?: boolean
          created_at?: string
          delay_minutes?: number
          dias_disparo?: number[] | null
          enabled?: boolean
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: string
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_cobranca_config_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "sms_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_cobranca_logs: {
        Row: {
          dias_processados: number[] | null
          enqueued: number | null
          executed_at: string
          id: string
          message: string | null
          scanned: number | null
          status: string
          triggered_by: string | null
        }
        Insert: {
          dias_processados?: number[] | null
          enqueued?: number | null
          executed_at?: string
          id?: string
          message?: string | null
          scanned?: number | null
          status: string
          triggered_by?: string | null
        }
        Update: {
          dias_processados?: number[] | null
          enqueued?: number | null
          executed_at?: string
          id?: string
          message?: string | null
          scanned?: number | null
          status?: string
          triggered_by?: string | null
        }
        Relationships: []
      }
      sms_history: {
        Row: {
          cliente_id: string | null
          conteudo: string
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          numero_destino: string
          provider_message_id: string | null
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          cliente_id?: string | null
          conteudo: string
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          numero_destino: string
          provider_message_id?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          cliente_id?: string | null
          conteudo?: string
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          numero_destino?: string
          provider_message_id?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_history_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_templates: {
        Row: {
          ativo: boolean | null
          categoria: string | null
          conteudo: string
          created_at: string
          created_by: string | null
          id: string
          nome: string
          updated_at: string
          variaveis: string[] | null
        }
        Insert: {
          ativo?: boolean | null
          categoria?: string | null
          conteudo: string
          created_at?: string
          created_by?: string | null
          id?: string
          nome: string
          updated_at?: string
          variaveis?: string[] | null
        }
        Update: {
          ativo?: boolean | null
          categoria?: string | null
          conteudo?: string
          created_at?: string
          created_by?: string | null
          id?: string
          nome?: string
          updated_at?: string
          variaveis?: string[] | null
        }
        Relationships: []
      }
      sms_validation_logs: {
        Row: {
          baserow_row_id: string | null
          created_at: string
          id: string
          motivo: string | null
          numero: string
          resultado: string
          user_email: string | null
          user_id: string
        }
        Insert: {
          baserow_row_id?: string | null
          created_at?: string
          id?: string
          motivo?: string | null
          numero: string
          resultado: string
          user_email?: string | null
          user_id: string
        }
        Update: {
          baserow_row_id?: string | null
          created_at?: string
          id?: string
          motivo?: string | null
          numero?: string
          resultado?: string
          user_email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      sms_validation_result_shares: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_email: string | null
          expires_at: string
          id: string
          message: string | null
          results: Json
          token: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          expires_at: string
          id?: string
          message?: string | null
          results: Json
          token?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          expires_at?: string
          id?: string
          message?: string | null
          results?: Json
          token?: string
        }
        Relationships: []
      }
      sms_validation_share_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_email: string | null
          expires_at: string
          id: string
          token: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          expires_at: string
          id?: string
          token?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          expires_at?: string
          id?: string
          token?: string
        }
        Relationships: []
      }
      social_credential_share_links: {
        Row: {
          cliente_id: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          token: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          token?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_credential_share_links_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      social_media_client_profiles: {
        Row: {
          audience_demographics: Json | null
          audience_demographics_updated_at: string | null
          auto_send_enabled: boolean
          cliente_id: string | null
          created_at: string
          created_by: string | null
          display_name: string | null
          email: string | null
          followers_count: number | null
          id: string
          ig_business_id: string | null
          is_active: boolean
          last_sync_error: string | null
          last_sync_status: string | null
          last_synced_at: string | null
          notify_email: boolean
          notify_whatsapp: boolean
          oauth_access_token: string | null
          oauth_connected: boolean
          oauth_connected_at: string | null
          oauth_fb_page_id: string | null
          oauth_ig_business_id: string | null
          oauth_token_expires_at: string | null
          profile_picture_url: string | null
          report_day: number
          updated_at: string
          username: string
          whatsapp_number: string | null
        }
        Insert: {
          audience_demographics?: Json | null
          audience_demographics_updated_at?: string | null
          auto_send_enabled?: boolean
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          email?: string | null
          followers_count?: number | null
          id?: string
          ig_business_id?: string | null
          is_active?: boolean
          last_sync_error?: string | null
          last_sync_status?: string | null
          last_synced_at?: string | null
          notify_email?: boolean
          notify_whatsapp?: boolean
          oauth_access_token?: string | null
          oauth_connected?: boolean
          oauth_connected_at?: string | null
          oauth_fb_page_id?: string | null
          oauth_ig_business_id?: string | null
          oauth_token_expires_at?: string | null
          profile_picture_url?: string | null
          report_day?: number
          updated_at?: string
          username: string
          whatsapp_number?: string | null
        }
        Update: {
          audience_demographics?: Json | null
          audience_demographics_updated_at?: string | null
          auto_send_enabled?: boolean
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          email?: string | null
          followers_count?: number | null
          id?: string
          ig_business_id?: string | null
          is_active?: boolean
          last_sync_error?: string | null
          last_sync_status?: string | null
          last_synced_at?: string | null
          notify_email?: boolean
          notify_whatsapp?: boolean
          oauth_access_token?: string | null
          oauth_connected?: boolean
          oauth_connected_at?: string | null
          oauth_fb_page_id?: string | null
          oauth_ig_business_id?: string | null
          oauth_token_expires_at?: string | null
          profile_picture_url?: string | null
          report_day?: number
          updated_at?: string
          username?: string
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_media_client_profiles_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      social_media_daily_snapshots: {
        Row: {
          accounts_engaged: number | null
          created_at: string
          followers_count: number | null
          following_count: number | null
          id: string
          impressions: number | null
          media_count: number | null
          profile_id: string
          profile_views: number | null
          reach: number | null
          snapshot_date: string
          source: string | null
          total_interactions: number | null
          website_clicks: number | null
        }
        Insert: {
          accounts_engaged?: number | null
          created_at?: string
          followers_count?: number | null
          following_count?: number | null
          id?: string
          impressions?: number | null
          media_count?: number | null
          profile_id: string
          profile_views?: number | null
          reach?: number | null
          snapshot_date?: string
          source?: string | null
          total_interactions?: number | null
          website_clicks?: number | null
        }
        Update: {
          accounts_engaged?: number | null
          created_at?: string
          followers_count?: number | null
          following_count?: number | null
          id?: string
          impressions?: number | null
          media_count?: number | null
          profile_id?: string
          profile_views?: number | null
          reach?: number | null
          snapshot_date?: string
          source?: string | null
          total_interactions?: number | null
          website_clicks?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "social_media_daily_snapshots_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "social_media_client_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_media_message_templates: {
        Row: {
          body: string
          channel: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          subject: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          channel: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          subject?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          subject?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      social_media_monthly_reports: {
        Row: {
          data: Json
          generated_at: string
          generated_by: string | null
          id: string
          month: string
          pdf_url: string | null
          profile_id: string
          send_email_error: string | null
          send_whatsapp_error: string | null
          sent_email_at: string | null
          sent_whatsapp_at: string | null
          share_token: string
        }
        Insert: {
          data?: Json
          generated_at?: string
          generated_by?: string | null
          id?: string
          month: string
          pdf_url?: string | null
          profile_id: string
          send_email_error?: string | null
          send_whatsapp_error?: string | null
          sent_email_at?: string | null
          sent_whatsapp_at?: string | null
          share_token?: string
        }
        Update: {
          data?: Json
          generated_at?: string
          generated_by?: string | null
          id?: string
          month?: string
          pdf_url?: string | null
          profile_id?: string
          send_email_error?: string | null
          send_whatsapp_error?: string | null
          sent_email_at?: string | null
          sent_whatsapp_at?: string | null
          share_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_media_monthly_reports_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "social_media_client_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_media_posts_collected: {
        Row: {
          caption: string | null
          comments_count: number | null
          hashtags: string[] | null
          id: string
          ig_media_id: string
          impressions: number | null
          insights_source: string | null
          like_count: number | null
          media_product_type: string | null
          media_type: string | null
          media_url: string | null
          permalink: string | null
          plays: number | null
          posted_at: string | null
          profile_id: string
          reach: number | null
          saved: number | null
          shares: number | null
          synced_at: string
          thumbnail_url: string | null
          total_interactions: number | null
          views_count: number | null
        }
        Insert: {
          caption?: string | null
          comments_count?: number | null
          hashtags?: string[] | null
          id?: string
          ig_media_id: string
          impressions?: number | null
          insights_source?: string | null
          like_count?: number | null
          media_product_type?: string | null
          media_type?: string | null
          media_url?: string | null
          permalink?: string | null
          plays?: number | null
          posted_at?: string | null
          profile_id: string
          reach?: number | null
          saved?: number | null
          shares?: number | null
          synced_at?: string
          thumbnail_url?: string | null
          total_interactions?: number | null
          views_count?: number | null
        }
        Update: {
          caption?: string | null
          comments_count?: number | null
          hashtags?: string[] | null
          id?: string
          ig_media_id?: string
          impressions?: number | null
          insights_source?: string | null
          like_count?: number | null
          media_product_type?: string | null
          media_type?: string | null
          media_url?: string | null
          permalink?: string | null
          plays?: number | null
          posted_at?: string | null
          profile_id?: string
          reach?: number | null
          saved?: number | null
          shares?: number | null
          synced_at?: string
          thumbnail_url?: string | null
          total_interactions?: number | null
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "social_media_posts_collected_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "social_media_client_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_media_report_config: {
        Row: {
          auto_send_enabled: boolean
          created_at: string
          email_from: string | null
          email_from_name: string | null
          email_provider: string | null
          email_smtp_host: string | null
          email_smtp_pass: string | null
          email_smtp_port: number | null
          email_smtp_user: string | null
          evolution_apikey: string | null
          evolution_instance_id: string | null
          evolution_instance_name: string | null
          evolution_phone_sender: string | null
          evolution_url: string | null
          id: string
          instagram_app_id: string | null
          instagram_app_secret: string | null
          instagram_oauth_enabled: boolean
          send_hour: number
          updated_at: string
        }
        Insert: {
          auto_send_enabled?: boolean
          created_at?: string
          email_from?: string | null
          email_from_name?: string | null
          email_provider?: string | null
          email_smtp_host?: string | null
          email_smtp_pass?: string | null
          email_smtp_port?: number | null
          email_smtp_user?: string | null
          evolution_apikey?: string | null
          evolution_instance_id?: string | null
          evolution_instance_name?: string | null
          evolution_phone_sender?: string | null
          evolution_url?: string | null
          id?: string
          instagram_app_id?: string | null
          instagram_app_secret?: string | null
          instagram_oauth_enabled?: boolean
          send_hour?: number
          updated_at?: string
        }
        Update: {
          auto_send_enabled?: boolean
          created_at?: string
          email_from?: string | null
          email_from_name?: string | null
          email_provider?: string | null
          email_smtp_host?: string | null
          email_smtp_pass?: string | null
          email_smtp_port?: number | null
          email_smtp_user?: string | null
          evolution_apikey?: string | null
          evolution_instance_id?: string | null
          evolution_instance_name?: string | null
          evolution_phone_sender?: string | null
          evolution_url?: string | null
          id?: string
          instagram_app_id?: string | null
          instagram_app_secret?: string | null
          instagram_oauth_enabled?: boolean
          send_hour?: number
          updated_at?: string
        }
        Relationships: []
      }
      system_activities: {
        Row: {
          action: string
          created_at: string
          details: string | null
          id: string
          resource_type: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: string | null
          id?: string
          resource_type?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: string | null
          id?: string
          resource_type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      system_permissions: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          id: string
          key: string
          name: string
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          key: string
          name: string
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          key?: string
          name?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
      }
      temporary_access_tokens: {
        Row: {
          created_at: string | null
          created_by: string | null
          expires_at: string
          id: string
          is_active: boolean | null
          max_uses: number | null
          permissions: string[] | null
          target_path: string
          token: string
          uses: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          expires_at: string
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          permissions?: string[] | null
          target_path: string
          token: string
          uses?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          permissions?: string[] | null
          target_path?: string
          token?: string
          uses?: number | null
        }
        Relationships: []
      }
      user_login_history: {
        Row: {
          browser: string | null
          city: string | null
          country: string | null
          device_name: string | null
          id: string
          ip_address: string | null
          is_active: boolean | null
          is_new_device: boolean | null
          last_seen_at: string
          logged_in_at: string
          logged_out_at: string | null
          os: string | null
          session_id: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          browser?: string | null
          city?: string | null
          country?: string | null
          device_name?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          is_new_device?: boolean | null
          last_seen_at?: string
          logged_in_at?: string
          logged_out_at?: string | null
          os?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          browser?: string | null
          city?: string | null
          country?: string | null
          device_name?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          is_new_device?: boolean | null
          last_seen_at?: string
          logged_in_at?: string
          logged_out_at?: string | null
          os?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      user_security_alerts: {
        Row: {
          alert_type: string
          created_at: string
          id: string
          is_read: boolean | null
          message: string
          metadata: Json | null
          title: string
          user_id: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          message: string
          metadata?: Json | null
          title: string
          user_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string
          metadata?: Json | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      webhooks: {
        Row: {
          created_at: string
          created_by: string | null
          events: string[]
          id: string
          is_active: boolean
          name: string
          secret_key: string | null
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          events?: string[]
          id?: string
          is_active?: boolean
          name: string
          secret_key?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          events?: string[]
          id?: string
          is_active?: boolean
          name?: string
          secret_key?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      weekly_renewals_report_config: {
        Row: {
          created_at: string
          day_of_week: number | null
          email_recipients: string[] | null
          gmail_app_password: string | null
          gmail_sender_name: string | null
          gmail_user: string | null
          id: string
          include_payments: boolean | null
          include_renewals: boolean | null
          is_active: boolean | null
          last_sent_at: string | null
          notify_email: boolean | null
          notify_whatsapp: boolean | null
          schedule_hour: number | null
          schedule_minute: number | null
          send_when_empty: boolean | null
          updated_at: string
          whatsapp_instance_id: string | null
          whatsapp_recipients: string[] | null
        }
        Insert: {
          created_at?: string
          day_of_week?: number | null
          email_recipients?: string[] | null
          gmail_app_password?: string | null
          gmail_sender_name?: string | null
          gmail_user?: string | null
          id?: string
          include_payments?: boolean | null
          include_renewals?: boolean | null
          is_active?: boolean | null
          last_sent_at?: string | null
          notify_email?: boolean | null
          notify_whatsapp?: boolean | null
          schedule_hour?: number | null
          schedule_minute?: number | null
          send_when_empty?: boolean | null
          updated_at?: string
          whatsapp_instance_id?: string | null
          whatsapp_recipients?: string[] | null
        }
        Update: {
          created_at?: string
          day_of_week?: number | null
          email_recipients?: string[] | null
          gmail_app_password?: string | null
          gmail_sender_name?: string | null
          gmail_user?: string | null
          id?: string
          include_payments?: boolean | null
          include_renewals?: boolean | null
          is_active?: boolean | null
          last_sent_at?: string | null
          notify_email?: boolean | null
          notify_whatsapp?: boolean | null
          schedule_hour?: number | null
          schedule_minute?: number | null
          send_when_empty?: boolean | null
          updated_at?: string
          whatsapp_instance_id?: string | null
          whatsapp_recipients?: string[] | null
        }
        Relationships: []
      }
      weekly_renewals_report_logs: {
        Row: {
          channel: string
          created_at: string
          error_message: string | null
          id: string
          is_test: boolean | null
          payload_snapshot: Json | null
          recipient: string
          status: string
          total_amount_brl: number | null
          total_amount_usd: number | null
          total_payments: number | null
          total_renewals: number | null
        }
        Insert: {
          channel: string
          created_at?: string
          error_message?: string | null
          id?: string
          is_test?: boolean | null
          payload_snapshot?: Json | null
          recipient: string
          status: string
          total_amount_brl?: number | null
          total_amount_usd?: number | null
          total_payments?: number | null
          total_renewals?: number | null
        }
        Update: {
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          is_test?: boolean | null
          payload_snapshot?: Json | null
          recipient?: string
          status?: string
          total_amount_brl?: number | null
          total_amount_usd?: number | null
          total_payments?: number | null
          total_renewals?: number | null
        }
        Relationships: []
      }
      whatsapp_group_config: {
        Row: {
          config_key: string
          config_value: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          config_key: string
          config_value?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          config_key?: string
          config_value?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_group_default_participants: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          phone_number: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          phone_number: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          phone_number?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_instances: {
        Row: {
          api_key: string
          api_url: string
          created_at: string
          id: string
          instance_name: string
          is_active: boolean
          last_used_at: string | null
          updated_at: string
        }
        Insert: {
          api_key: string
          api_url: string
          created_at?: string
          id?: string
          instance_name: string
          is_active?: boolean
          last_used_at?: string | null
          updated_at?: string
        }
        Update: {
          api_key?: string
          api_url?: string
          created_at?: string
          id?: string
          instance_name?: string
          is_active?: boolean
          last_used_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      buscar_investimentos_cliente: {
        Args: { p_email?: string; p_nome?: string; p_telefone?: string }
        Returns: Json
      }
      can_approve_order: { Args: { user_uuid: string }; Returns: boolean }
      check_profile_safe_update: { Args: never; Returns: boolean }
      check_temp_token_validity: {
        Args: { token_val: string }
        Returns: boolean
      }
      cleanup_cobranca_orphan_payments: {
        Args: { p_days_old?: number }
        Returns: Json
      }
      cleanup_old_billing_webhook_logs: { Args: never; Returns: number }
      create_password_reset_token: {
        Args: {
          p_email: string
          p_expires_at: string
          p_token: string
          p_user_id: string
        }
        Returns: boolean
      }
      disable_automations_cron: { Args: never; Returns: boolean }
      disable_calendar_notify_cron: { Args: never; Returns: boolean }
      disable_calendar_physical_summary_cron: {
        Args: never
        Returns: undefined
      }
      disable_calendar_sync_cron: { Args: never; Returns: boolean }
      disable_consulta_numeros_reminder_cron: { Args: never; Returns: boolean }
      disable_divulgador_cron: { Args: never; Returns: boolean }
      disable_reports_analysis_cron: { Args: never; Returns: boolean }
      disable_weekly_renewals_report_cron: { Args: never; Returns: boolean }
      execute_auto_remarketing: { Args: never; Returns: undefined }
      execute_billing_cron: { Args: never; Returns: undefined }
      execute_calendar_notify: { Args: never; Returns: undefined }
      execute_calendar_physical_summary: { Args: never; Returns: undefined }
      execute_calendar_sync: { Args: never; Returns: undefined }
      execute_cobranca_ligacoes_enqueue: { Args: never; Returns: undefined }
      execute_consulta_numeros_reminder: { Args: never; Returns: undefined }
      execute_divulgador_cron: { Args: never; Returns: undefined }
      execute_followups_cron: { Args: never; Returns: undefined }
      execute_gateway_abandoned_cart: { Args: never; Returns: undefined }
      execute_horario_bloqueios_cleanup: { Args: never; Returns: undefined }
      execute_instagram_spy_cron: { Args: never; Returns: undefined }
      execute_instagram_token_auto_refresh: { Args: never; Returns: undefined }
      execute_process_automations: { Args: never; Returns: undefined }
      execute_reports_analysis_cron: { Args: never; Returns: undefined }
      execute_scheduled_proposal_sends: { Args: never; Returns: undefined }
      execute_weekly_renewals_report: { Args: never; Returns: undefined }
      get_auth_access_code: { Args: never; Returns: string }
      get_automations_cron_schedule: {
        Args: never
        Returns: {
          job_name: string
          schedule: string
        }[]
      }
      get_billing_cron_schedule: {
        Args: never
        Returns: {
          job_name: string
          schedule: string
        }[]
      }
      get_calendar_notify_cron_schedule: {
        Args: never
        Returns: {
          job_name: string
          schedule: string
        }[]
      }
      get_calendar_sync_cron_schedule: {
        Args: never
        Returns: {
          job_name: string
          schedule: string
        }[]
      }
      get_consulta_numeros_reminder_cron_health: { Args: never; Returns: Json }
      get_consulta_numeros_reminder_cron_schedule: {
        Args: never
        Returns: {
          job_name: string
          schedule: string
        }[]
      }
      get_credentials_by_share_token: {
        Args: { p_token: string }
        Returns: Json
      }
      get_divulgador_cron_schedule: {
        Args: never
        Returns: {
          job_name: string
          schedule: string
        }[]
      }
      get_followup_cron_schedule: {
        Args: never
        Returns: {
          job_name: string
          schedule: string
        }[]
      }
      get_gateway_abandoned_cart_cron_schedule: {
        Args: never
        Returns: {
          job_name: string
          schedule: string
        }[]
      }
      get_horario_cleanup_config: { Args: never; Returns: Json }
      get_horario_cleanup_last_run: { Args: never; Returns: Json }
      get_instagram_spy_cron_schedule: {
        Args: never
        Returns: {
          job_name: string
          schedule: string
        }[]
      }
      get_pipeline_data_by_token: {
        Args: { link_token: string }
        Returns: Json
      }
      get_proposal_by_share_token: {
        Args: { p_share_token: string }
        Returns: Json
      }
      get_public_tables: {
        Args: never
        Returns: {
          table_name: string
        }[]
      }
      get_recaptcha_public_config: { Args: never; Returns: Json }
      get_reports_analysis_cron_schedule: {
        Args: never
        Returns: {
          job_name: string
          schedule: string
        }[]
      }
      get_sms_result_share: { Args: { p_token: string }; Returns: Json }
      get_social_media_report_by_token: {
        Args: { p_token: string }
        Returns: Json
      }
      get_user_id_by_email: { Args: { p_email: string }; Returns: string }
      get_weekly_renewals_report_cron_schedule: {
        Args: never
        Returns: {
          job_name: string
          schedule: string
        }[]
      }
      has_custom_role: {
        Args: { role_name: string; user_uuid: string }
        Returns: boolean
      }
      has_ligacoes_temp_perm: { Args: { p_perm: string }; Returns: boolean }
      has_permission: {
        Args: { _permission_key: string; _user_id: string }
        Returns: boolean
      }
      has_role:
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
        | { Args: { _role: string; _user_id: string }; Returns: boolean }
      has_sms_temp_perm: { Args: { p_perm: string }; Returns: boolean }
      increment_participant_count: {
        Args: { p_group_id: string }
        Returns: undefined
      }
      insert_audit_log: {
        Args: {
          p_action: string
          p_api_key_id?: string
          p_ip_address?: string
          p_request_body?: Json
          p_request_method?: string
          p_request_path?: string
          p_resource_id?: string
          p_resource_type: string
          p_response_body?: Json
          p_response_status?: number
          p_user_agent?: string
          p_webhook_id?: string
        }
        Returns: string
      }
      is_admin: { Args: never; Returns: boolean }
      is_approved: { Args: { _user_id: string }; Returns: boolean }
      is_gerente: { Args: never; Returns: boolean }
      is_operador: { Args: never; Returns: boolean }
      mark_password_reset_token_used: {
        Args: { p_token: string }
        Returns: boolean
      }
      normalize_phone: { Args: { p: string }; Returns: string }
      preview_cobranca_orphan_payments: {
        Args: { p_days_old?: number }
        Returns: {
          amount: number
          billing_date: string
          cliente_id: string
          cliente_nome: string
          created_at: string
          id: string
          payment_id: string
          payment_type: string
          reason: string
          status: string
        }[]
      }
      record_proposal_view: {
        Args: {
          p_event_data?: Json
          p_event_type: string
          p_proposal_id: string
          p_share_token: string
          p_user_agent?: string
        }
        Returns: boolean
      }
      set_horario_cleanup_schedule: {
        Args: { p_enabled: boolean; p_hour: number; p_minute: number }
        Returns: Json
      }
      set_horario_external_connection: {
        Args: { p_anon_key: string; p_url: string }
        Returns: boolean
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      sign_proposal: {
        Args: {
          p_client_signature?: string
          p_proposal_id: string
          p_rejection_reason?: string
          p_share_token: string
          p_signed_name?: string
          p_status: string
        }
        Returns: boolean
      }
      trigger_auto_sync_consulta_numeros: { Args: never; Returns: undefined }
      update_all_lead_scores: { Args: never; Returns: undefined }
      update_automations_cron_schedule: {
        Args: { p_hour: number; p_minute: number }
        Returns: boolean
      }
      update_billing_cron_schedule: {
        Args: { p_hour: number; p_minute: number }
        Returns: boolean
      }
      update_calendar_notify_cron: {
        Args: { p_interval_minutes: number }
        Returns: boolean
      }
      update_calendar_physical_summary_cron: {
        Args: { p_hour_brasilia: number; p_minute?: number }
        Returns: undefined
      }
      update_calendar_sync_cron: {
        Args: { p_interval_minutes: number }
        Returns: boolean
      }
      update_consulta_numeros_reminder_cron: {
        Args: { p_interval_hours: number }
        Returns: boolean
      }
      update_divulgador_cron_schedule: {
        Args: { p_interval_minutes: number }
        Returns: boolean
      }
      update_followup_cron_schedule: {
        Args: { p_hour: number; p_minute: number }
        Returns: boolean
      }
      update_gateway_abandoned_cart_cron: {
        Args: { p_interval_minutes: number }
        Returns: boolean
      }
      update_instagram_spy_cron: {
        Args: { p_frequency: string }
        Returns: boolean
      }
      update_remarketing_cron_schedule: {
        Args: { new_schedule: string }
        Returns: undefined
      }
      update_reports_analysis_cron: {
        Args: { p_frequency: string }
        Returns: boolean
      }
      update_weekly_renewals_report_cron: {
        Args: { p_day_of_week: number; p_hour: number; p_minute: number }
        Returns: boolean
      }
      validate_instagram_invite_token: {
        Args: { p_token: string }
        Returns: Json
      }
      validate_password_reset_token: {
        Args: { p_token: string }
        Returns: {
          email: string
          is_valid: boolean
          user_id: string
        }[]
      }
      validate_payment_link_token: { Args: { p_token: string }; Returns: Json }
      validate_shared_access_token: {
        Args: { p_token: string }
        Returns: {
          expires_at: string
          target_url: string
          valid: boolean
        }[]
      }
      validate_sms_share_token: { Args: { p_token: string }; Returns: Json }
      verify_email_exists: { Args: { p_email: string }; Returns: boolean }
      verify_proposal_password: {
        Args: { p_password: string; p_share_token: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "user" | "operador" | "gerente"
      chamado_prioridade: "baixa" | "media" | "alta" | "urgente"
      chamado_status:
        | "aberto"
        | "em_andamento"
        | "aguardando_cliente"
        | "resolvido"
        | "fechado"
      log_level: "info" | "success" | "error"
      post_status:
        | "draft"
        | "scheduled"
        | "publishing"
        | "published"
        | "failed"
        | "cancelled"
      post_type: "feed" | "reels" | "carousel" | "stories"
      proposal_status: "draft" | "sent" | "viewed" | "accepted" | "rejected"
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
      app_role: ["admin", "user", "operador", "gerente"],
      chamado_prioridade: ["baixa", "media", "alta", "urgente"],
      chamado_status: [
        "aberto",
        "em_andamento",
        "aguardando_cliente",
        "resolvido",
        "fechado",
      ],
      log_level: ["info", "success", "error"],
      post_status: [
        "draft",
        "scheduled",
        "publishing",
        "published",
        "failed",
        "cancelled",
      ],
      post_type: ["feed", "reels", "carousel", "stories"],
      proposal_status: ["draft", "sent", "viewed", "accepted", "rejected"],
    },
  },
} as const
