-- =============================================
-- HISTÓRICO DE PROPOSTAS + CONFIGURAÇÕES DE ENVIO
-- =============================================

-- Tabela de histórico de propostas (quem criou, editou, etc.)
CREATE TABLE IF NOT EXISTS public.proposal_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'created', 'updated', 'sent', 'viewed', 'accepted', 'rejected'
  user_id UUID,
  user_email TEXT,
  user_name TEXT,
  changes JSONB, -- campos que foram alterados
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para proposal_history
CREATE INDEX IF NOT EXISTS idx_proposal_history_proposal_id ON public.proposal_history(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_history_created_at ON public.proposal_history(created_at DESC);

-- Habilitar RLS
ALTER TABLE public.proposal_history ENABLE ROW LEVEL SECURITY;

-- Policies para proposal_history
CREATE POLICY "Users can view history of own proposals" 
  ON public.proposal_history FOR SELECT 
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.proposals 
    WHERE id = proposal_id 
    AND (user_id = auth.uid() OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'))
  ));

CREATE POLICY "Users can insert history for own proposals" 
  ON public.proposal_history FOR INSERT 
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.proposals 
    WHERE id = proposal_id 
    AND (user_id = auth.uid() OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'))
  ));

-- Tabela de configuração de envio de propostas
CREATE TABLE IF NOT EXISTS public.proposal_send_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gmail_user TEXT,
  gmail_app_password TEXT,
  gmail_sender_name TEXT,
  evolution_api_url TEXT,
  evolution_api_key TEXT,
  evolution_instance_name TEXT,
  email_enabled BOOLEAN DEFAULT false,
  whatsapp_enabled BOOLEAN DEFAULT false,
  email_subject_template TEXT DEFAULT 'Proposta Comercial - {{titulo}}',
  email_body_template TEXT DEFAULT '<h1>Olá {{cliente_nome}},</h1><p>Segue sua proposta comercial.</p><p><a href="{{link}}">Clique aqui para visualizar</a></p>',
  whatsapp_message_template TEXT DEFAULT 'Olá {{cliente_nome}}! 📋 Sua proposta comercial está pronta. Acesse aqui: {{link}}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.proposal_send_config ENABLE ROW LEVEL SECURITY;

-- Policies para proposal_send_config (somente admin)
CREATE POLICY "Only admins can view send config" 
  ON public.proposal_send_config FOR SELECT 
  TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Only admins can manage send config" 
  ON public.proposal_send_config FOR ALL 
  TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Tabela de logs de envio de propostas
CREATE TABLE IF NOT EXISTS public.proposal_send_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  channel TEXT NOT NULL, -- 'email' ou 'whatsapp'
  recipient TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'error'
  error_message TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_by UUID,
  sent_by_email TEXT
);

-- Índice para send_logs
CREATE INDEX IF NOT EXISTS idx_proposal_send_logs_proposal_id ON public.proposal_send_logs(proposal_id);

-- Habilitar RLS
ALTER TABLE public.proposal_send_logs ENABLE ROW LEVEL SECURITY;

-- Policies para proposal_send_logs
CREATE POLICY "Users can view send logs of own proposals" 
  ON public.proposal_send_logs FOR SELECT 
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.proposals 
    WHERE id = proposal_id 
    AND (user_id = auth.uid() OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'))
  ));

CREATE POLICY "Users can insert send logs for own proposals" 
  ON public.proposal_send_logs FOR INSERT 
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.proposals 
    WHERE id = proposal_id 
    AND (user_id = auth.uid() OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'))
  ));

-- Adicionar campo de cliente manual na proposta
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS manual_client_name TEXT;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS manual_client_email TEXT;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS manual_client_phone TEXT;

-- Inserir permissão de configurar envio
INSERT INTO public.system_permissions (key, name, description, category) VALUES
  ('configure_proposal_sending', 'Configurar Envio de Propostas', 'Permite configurar Gmail e WhatsApp para envio de propostas', 'Propostas')
ON CONFLICT DO NOTHING;

-- Dar permissão ao admin
INSERT INTO public.role_permissions (role_name, permission_key) VALUES
  ('admin', 'configure_proposal_sending')
ON CONFLICT DO NOTHING;

-- Inserir configuração padrão
INSERT INTO public.proposal_send_config (id) VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;