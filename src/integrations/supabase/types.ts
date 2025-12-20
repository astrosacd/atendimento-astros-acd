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
          error_message: string | null
          id: string
          message_type: string
          sent_at: string
          status: string
        }
        Insert: {
          channel: string
          cliente_email?: string | null
          cliente_id?: string | null
          cliente_nome: string
          cliente_numero?: string | null
          error_message?: string | null
          id?: string
          message_type: string
          sent_at?: string
          status?: string
        }
        Update: {
          channel?: string
          cliente_email?: string | null
          cliente_id?: string | null
          cliente_nome?: string
          cliente_numero?: string | null
          error_message?: string | null
          id?: string
          message_type?: string
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
      client_payments: {
        Row: {
          amount: number
          billing_date: string
          cliente_id: string | null
          created_at: string
          id: string
          paid_at: string | null
          payment_id: string
          payment_type: string
          preference_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          billing_date: string
          cliente_id?: string | null
          created_at?: string
          id?: string
          paid_at?: string | null
          payment_id: string
          payment_type: string
          preference_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_date?: string
          cliente_id?: string | null
          created_at?: string
          id?: string
          paid_at?: string | null
          payment_id?: string
          payment_type?: string
          preference_id?: string | null
          status?: string
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
      clientes: {
        Row: {
          cobranca_ativa: boolean
          cpf: string
          created_at: string
          created_by: string | null
          data_d_mais_1: string | null
          data_d_mais_15: string | null
          data_d_mais_2: string | null
          data_d_mais_30: string | null
          data_d_menos_3: string | null
          data_renovacao: string
          email: string
          id: string
          nome: string
          numero: string
          observacao: string | null
          plano: string | null
          produto: string
          tags: string[] | null
          updated_at: string
          valor: number
        }
        Insert: {
          cobranca_ativa?: boolean
          cpf: string
          created_at?: string
          created_by?: string | null
          data_d_mais_1?: string | null
          data_d_mais_15?: string | null
          data_d_mais_2?: string | null
          data_d_mais_30?: string | null
          data_d_menos_3?: string | null
          data_renovacao: string
          email: string
          id?: string
          nome: string
          numero: string
          observacao?: string | null
          plano?: string | null
          produto: string
          tags?: string[] | null
          updated_at?: string
          valor: number
        }
        Update: {
          cobranca_ativa?: boolean
          cpf?: string
          created_at?: string
          created_by?: string | null
          data_d_mais_1?: string | null
          data_d_mais_15?: string | null
          data_d_mais_2?: string | null
          data_d_mais_30?: string | null
          data_d_menos_3?: string | null
          data_renovacao?: string
          email?: string
          id?: string
          nome?: string
          numero?: string
          observacao?: string | null
          plano?: string | null
          produto?: string
          tags?: string[] | null
          updated_at?: string
          valor?: number
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
      gateway_orders: {
        Row: {
          abandoned_email_sent: boolean
          coupon_id: string | null
          created_at: string
          currency: string
          customer_email: string
          customer_name: string
          customer_phone: string | null
          discount_amount: number
          id: string
          order_bump_id: string | null
          payment_gateway: string | null
          payment_id: string | null
          product_id: string | null
          status: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          abandoned_email_sent?: boolean
          coupon_id?: string | null
          created_at?: string
          currency?: string
          customer_email: string
          customer_name: string
          customer_phone?: string | null
          discount_amount?: number
          id?: string
          order_bump_id?: string | null
          payment_gateway?: string | null
          payment_id?: string | null
          product_id?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          abandoned_email_sent?: boolean
          coupon_id?: string | null
          created_at?: string
          currency?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string | null
          discount_amount?: number
          id?: string
          order_bump_id?: string | null
          payment_gateway?: string | null
          payment_id?: string | null
          product_id?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
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
      numeros_aquecimento: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          modelo_id: string | null
          numero: string
          observacoes: string | null
          status_id: string | null
          ultima_atividade: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          modelo_id?: string | null
          numero: string
          observacoes?: string | null
          status_id?: string | null
          ultima_atividade: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          modelo_id?: string | null
          numero?: string
          observacoes?: string | null
          status_id?: string | null
          ultima_atividade?: string
          updated_at?: string
        }
        Relationships: [
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
          created_at: string
          descricao: string | null
          id: string
          marca: string | null
          nome: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          marca?: string | null
          nome: string
          updated_at?: string
        }
        Update: {
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
          name?: string
          phone?: string | null
          rejection_reason?: string | null
          updated_at?: string
          user_id?: string
          user_response?: string | null
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
      create_password_reset_token: {
        Args: {
          p_email: string
          p_expires_at: string
          p_token: string
          p_user_id: string
        }
        Returns: boolean
      }
      disable_divulgador_cron: { Args: never; Returns: boolean }
      execute_billing_cron: { Args: never; Returns: undefined }
      execute_divulgador_cron: { Args: never; Returns: undefined }
      execute_gateway_abandoned_cart: { Args: never; Returns: undefined }
      get_billing_cron_schedule: {
        Args: never
        Returns: {
          job_name: string
          schedule: string
        }[]
      }
      get_divulgador_cron_schedule: {
        Args: never
        Returns: {
          job_name: string
          schedule: string
        }[]
      }
      get_user_id_by_email: { Args: { p_email: string }; Returns: string }
      has_role:
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
        | { Args: { _role: string; _user_id: string }; Returns: boolean }
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
      update_billing_cron_schedule: {
        Args: { p_hour: number; p_minute: number }
        Returns: boolean
      }
      update_divulgador_cron_schedule: {
        Args: { p_interval_minutes: number }
        Returns: boolean
      }
      validate_password_reset_token: {
        Args: { p_token: string }
        Returns: {
          email: string
          is_valid: boolean
          user_id: string
        }[]
      }
      verify_email_exists: { Args: { p_email: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user" | "operador" | "gerente"
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
    },
  },
} as const
