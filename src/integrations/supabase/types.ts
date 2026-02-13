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
      billing_stripe_config: {
        Row: {
          created_at: string
          id: string
          stripe_enabled: boolean | null
          stripe_secret_key: string | null
          stripe_tax_percent: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          stripe_enabled?: boolean | null
          stripe_secret_key?: string | null
          stripe_tax_percent?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          stripe_enabled?: boolean | null
          stripe_secret_key?: string | null
          stripe_tax_percent?: number | null
          updated_at?: string
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
      chamados: {
        Row: {
          closed_at: string | null
          codigo: string
          contato: string
          created_at: string
          email: string
          hash_acesso: string
          id: string
          motivo: string
          nome: string
          prioridade: Database["public"]["Enums"]["chamado_prioridade"]
          status: Database["public"]["Enums"]["chamado_status"]
          tecnico_id: string | null
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          codigo: string
          contato: string
          created_at?: string
          email: string
          hash_acesso: string
          id?: string
          motivo: string
          nome: string
          prioridade?: Database["public"]["Enums"]["chamado_prioridade"]
          status?: Database["public"]["Enums"]["chamado_status"]
          tecnico_id?: string | null
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          codigo?: string
          contato?: string
          created_at?: string
          email?: string
          hash_acesso?: string
          id?: string
          motivo?: string
          nome?: string
          prioridade?: Database["public"]["Enums"]["chamado_prioridade"]
          status?: Database["public"]["Enums"]["chamado_status"]
          tecnico_id?: string | null
          updated_at?: string
        }
        Relationships: []
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
          receipt_number: string | null
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
          receipt_number?: string | null
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
          receipt_number?: string | null
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
      clientes: {
        Row: {
          ciclo_cobranca: string
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
          moeda: string
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
          ciclo_cobranca?: string
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
          moeda?: string
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
          ciclo_cobranca?: string
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
          moeda?: string
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
          baserow_row_id: number
          created_at: string
          id: string
          row_data: Json
          updated_at: string
        }
        Insert: {
          baserow_row_id: number
          created_at?: string
          id?: string
          row_data: Json
          updated_at?: string
        }
        Update: {
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
          coupon_id: string | null
          created_at: string
          currency: string
          customer_cpf: string | null
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
          customer_cpf?: string | null
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
          customer_cpf?: string | null
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
          email_body_template: string | null
          email_enabled: boolean | null
          email_remarketing_body_template: string | null
          email_remarketing_subject_template: string | null
          email_subject_template: string | null
          evolution_api_key: string | null
          evolution_api_url: string | null
          evolution_instance_name: string | null
          gmail_app_password: string | null
          gmail_sender_name: string | null
          gmail_user: string | null
          id: string
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
          email_body_template?: string | null
          email_enabled?: boolean | null
          email_remarketing_body_template?: string | null
          email_remarketing_subject_template?: string | null
          email_subject_template?: string | null
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          evolution_instance_name?: string | null
          gmail_app_password?: string | null
          gmail_sender_name?: string | null
          gmail_user?: string | null
          id?: string
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
          email_body_template?: string | null
          email_enabled?: boolean | null
          email_remarketing_body_template?: string | null
          email_remarketing_subject_template?: string | null
          email_subject_template?: string | null
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          evolution_instance_name?: string | null
          gmail_app_password?: string | null
          gmail_sender_name?: string | null
          gmail_user?: string | null
          id?: string
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
      check_profile_safe_update: { Args: never; Returns: boolean }
      create_password_reset_token: {
        Args: {
          p_email: string
          p_expires_at: string
          p_token: string
          p_user_id: string
        }
        Returns: boolean
      }
      disable_consulta_numeros_reminder_cron: { Args: never; Returns: boolean }
      disable_divulgador_cron: { Args: never; Returns: boolean }
      execute_auto_remarketing: { Args: never; Returns: undefined }
      execute_billing_cron: { Args: never; Returns: undefined }
      execute_consulta_numeros_reminder: { Args: never; Returns: undefined }
      execute_divulgador_cron: { Args: never; Returns: undefined }
      execute_followups_cron: { Args: never; Returns: undefined }
      execute_gateway_abandoned_cart: { Args: never; Returns: undefined }
      execute_scheduled_proposal_sends: { Args: never; Returns: undefined }
      get_auth_access_code: { Args: never; Returns: string }
      get_billing_cron_schedule: {
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
      get_proposal_by_share_token: {
        Args: { p_share_token: string }
        Returns: Json
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
      update_billing_cron_schedule: {
        Args: { p_hour: number; p_minute: number }
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
      update_remarketing_cron_schedule: {
        Args: { new_schedule: string }
        Returns: undefined
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
      proposal_status: ["draft", "sent", "viewed", "accepted", "rejected"],
    },
  },
} as const
