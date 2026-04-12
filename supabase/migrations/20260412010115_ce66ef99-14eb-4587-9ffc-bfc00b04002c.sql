-- Add missing permissions
INSERT INTO public.system_permissions (key, name, description, category) VALUES
  ('view_agenda_history', 'Visualizar Histórico da Agenda', 'Permite visualizar o histórico de movimentações da agenda', 'Agenda'),
  ('view_reports_ai', 'Análise IA dos Relatórios', 'Permite acessar a análise por IA nos relatórios avançados', 'Relatórios'),
  ('manage_reports_schedule', 'Gerenciar Análise Agendada', 'Permite configurar análises automáticas dos relatórios', 'Relatórios'),
  ('view_client_timeline', 'Visualizar Timeline do Cliente', 'Permite visualizar a timeline unificada do cliente', 'clientes'),
  ('manage_client_logos', 'Gerenciar Logos do Cliente', 'Permite adicionar e remover logos do cliente', 'clientes'),
  ('manage_client_licenses', 'Gerenciar Licenças do Cliente', 'Permite gerenciar licenças entregues ao cliente', 'clientes'),
  ('view_client_files', 'Visualizar Arquivos do Cliente', 'Permite visualizar arquivos do cliente', 'clientes'),
  ('view_client_purchases', 'Visualizar Compras do Cliente', 'Permite visualizar compras do cliente', 'clientes'),
  ('view_client_payments', 'Visualizar Pagamentos do Cliente', 'Permite visualizar pagamentos do cliente', 'clientes')
ON CONFLICT (key) DO NOTHING;

-- Grant all new permissions to admin role
INSERT INTO public.role_permissions (role_name, permission_key) VALUES
  ('admin', 'view_agenda_history'),
  ('admin', 'view_reports_ai'),
  ('admin', 'manage_reports_schedule'),
  ('admin', 'view_client_timeline'),
  ('admin', 'manage_client_logos'),
  ('admin', 'manage_client_licenses'),
  ('admin', 'view_client_files'),
  ('admin', 'view_client_purchases'),
  ('admin', 'view_client_payments')
ON CONFLICT (role_name, permission_key) DO NOTHING;

-- Create reports analysis config table
CREATE TABLE IF NOT EXISTS public.reports_analysis_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_active BOOLEAN DEFAULT false,
  frequency TEXT DEFAULT 'weekly', -- 'daily' or 'weekly'
  schedule_hour INTEGER DEFAULT 8,
  schedule_minute INTEGER DEFAULT 0,
  ai_provider TEXT DEFAULT 'lovable', -- 'lovable', 'openai', 'grok'
  ai_model TEXT DEFAULT 'google/gemini-3-flash-preview',
  openai_api_key TEXT,
  grok_api_key TEXT,
  custom_prompt TEXT,
  whatsapp_recipients TEXT[] DEFAULT '{}',
  email_recipients TEXT[] DEFAULT '{}',
  notify_whatsapp BOOLEAN DEFAULT false,
  notify_email BOOLEAN DEFAULT false,
  last_analysis_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reports_analysis_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view reports config"
  ON public.reports_analysis_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage reports config"
  ON public.reports_analysis_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create reports analysis history table
CREATE TABLE IF NOT EXISTS public.reports_analysis_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_text TEXT NOT NULL,
  ai_provider TEXT NOT NULL,
  ai_model TEXT,
  prompt_used TEXT,
  metrics_snapshot JSONB,
  created_by TEXT,
  notification_sent BOOLEAN DEFAULT false,
  notification_channels TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reports_analysis_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view analysis history"
  ON public.reports_analysis_history FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert analysis history"
  ON public.reports_analysis_history FOR INSERT TO authenticated WITH CHECK (true);