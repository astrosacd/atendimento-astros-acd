
-- Create enum for ticket status
CREATE TYPE public.chamado_status AS ENUM ('aberto', 'em_andamento', 'aguardando_cliente', 'resolvido', 'fechado');

-- Create enum for ticket priority
CREATE TYPE public.chamado_prioridade AS ENUM ('baixa', 'media', 'alta', 'urgente');

-- Main tickets table
CREATE TABLE public.chamados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  contato TEXT NOT NULL,
  motivo TEXT NOT NULL,
  status chamado_status NOT NULL DEFAULT 'aberto',
  prioridade chamado_prioridade NOT NULL DEFAULT 'media',
  tecnico_id UUID REFERENCES auth.users(id),
  hash_acesso TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE
);

-- Comments/interactions table
CREATE TABLE public.chamados_comentarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chamado_id UUID NOT NULL REFERENCES public.chamados(id) ON DELETE CASCADE,
  autor_nome TEXT NOT NULL,
  autor_email TEXT,
  autor_id UUID REFERENCES auth.users(id),
  tipo TEXT NOT NULL DEFAULT 'publico', -- 'publico' or 'interno'
  conteudo TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Configuration table
CREATE TABLE public.chamados_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_key TEXT NOT NULL UNIQUE,
  config_value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Webhooks configuration
CREATE TABLE public.chamados_webhooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  url TEXT NOT NULL,
  eventos TEXT[] NOT NULL DEFAULT '{}',
  secret_key TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Webhook delivery logs
CREATE TABLE public.chamados_webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_id UUID NOT NULL REFERENCES public.chamados_webhooks(id) ON DELETE CASCADE,
  chamado_id UUID REFERENCES public.chamados(id) ON DELETE SET NULL,
  evento TEXT NOT NULL,
  payload JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Verification codes for email access
CREATE TABLE public.chamados_codigos_verificacao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  codigo TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- History/audit table
CREATE TABLE public.chamados_historico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chamado_id UUID NOT NULL REFERENCES public.chamados(id) ON DELETE CASCADE,
  acao TEXT NOT NULL,
  dados_anteriores JSONB,
  dados_novos JSONB,
  usuario_id UUID REFERENCES auth.users(id),
  usuario_email TEXT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- API Keys for REST API
CREATE TABLE public.chamados_api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  api_key TEXT NOT NULL UNIQUE,
  descricao TEXT,
  permissions TEXT[] NOT NULL DEFAULT '{"read"}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chamados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chamados_comentarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chamados_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chamados_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chamados_webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chamados_codigos_verificacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chamados_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chamados_api_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chamados
CREATE POLICY "Admins can manage chamados" ON public.chamados FOR ALL USING (is_admin());
CREATE POLICY "Tecnicos can view and update chamados" ON public.chamados FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'operador'))
);
CREATE POLICY "Tecnicos can update chamados" ON public.chamados FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'operador'))
);
CREATE POLICY "Service can insert chamados" ON public.chamados FOR INSERT WITH CHECK (true);
CREATE POLICY "Service can update chamados" ON public.chamados FOR UPDATE USING (true);

-- RLS Policies for comentarios
CREATE POLICY "Admins can manage comentarios" ON public.chamados_comentarios FOR ALL USING (is_admin());
CREATE POLICY "Tecnicos can view comentarios" ON public.chamados_comentarios FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'operador'))
);
CREATE POLICY "Tecnicos can insert comentarios" ON public.chamados_comentarios FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'operador'))
);
CREATE POLICY "Service can insert comentarios" ON public.chamados_comentarios FOR INSERT WITH CHECK (true);

-- RLS Policies for config
CREATE POLICY "Admins can manage chamados_config" ON public.chamados_config FOR ALL USING (is_admin());
CREATE POLICY "Authenticated can view chamados_config" ON public.chamados_config FOR SELECT USING (auth.uid() IS NOT NULL);

-- RLS Policies for webhooks
CREATE POLICY "Admins can manage chamados_webhooks" ON public.chamados_webhooks FOR ALL USING (is_admin());

-- RLS Policies for webhook_logs
CREATE POLICY "Admins can view chamados_webhook_logs" ON public.chamados_webhook_logs FOR SELECT USING (is_admin());
CREATE POLICY "Service can insert webhook_logs" ON public.chamados_webhook_logs FOR INSERT WITH CHECK (true);

-- RLS Policies for codigos_verificacao
CREATE POLICY "Service can manage codigos_verificacao" ON public.chamados_codigos_verificacao FOR ALL USING (true);

-- RLS Policies for historico
CREATE POLICY "Admins can view chamados_historico" ON public.chamados_historico FOR SELECT USING (is_admin());
CREATE POLICY "Service can insert chamados_historico" ON public.chamados_historico FOR INSERT WITH CHECK (true);

-- RLS Policies for api_keys
CREATE POLICY "Admins can manage chamados_api_keys" ON public.chamados_api_keys FOR ALL USING (is_admin());

-- Insert default configurations
INSERT INTO public.chamados_config (config_key, config_value) VALUES
  ('verification_code_expiry_minutes', '5'),
  ('smtp_enabled', 'false'),
  ('smtp_sender_name', 'Sistema de Chamados'),
  ('smtp_gmail_user', ''),
  ('smtp_gmail_app_password', '');

-- Add permissions for chamados module
INSERT INTO public.system_permissions (key, name, description, category) VALUES
  ('chamados.view', 'Visualizar Chamados', 'Permite visualizar todos os chamados', 'Chamados'),
  ('chamados.manage', 'Gerenciar Chamados', 'Permite atualizar status e comentar em chamados', 'Chamados'),
  ('chamados.delete', 'Excluir Chamados', 'Permite excluir chamados', 'Chamados'),
  ('chamados.config', 'Configurar Chamados', 'Permite configurar o sistema de chamados', 'Chamados'),
  ('chamados.webhooks', 'Gerenciar Webhooks', 'Permite configurar webhooks de chamados', 'Chamados'),
  ('chamados.api_keys', 'Gerenciar API Keys', 'Permite gerenciar chaves de API', 'Chamados')
ON CONFLICT (key) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX idx_chamados_codigo ON public.chamados(codigo);
CREATE INDEX idx_chamados_email ON public.chamados(email);
CREATE INDEX idx_chamados_hash_acesso ON public.chamados(hash_acesso);
CREATE INDEX idx_chamados_status ON public.chamados(status);
CREATE INDEX idx_chamados_created_at ON public.chamados(created_at DESC);
CREATE INDEX idx_chamados_comentarios_chamado_id ON public.chamados_comentarios(chamado_id);
CREATE INDEX idx_chamados_codigos_verificacao_email ON public.chamados_codigos_verificacao(email);

-- Trigger for updated_at
CREATE TRIGGER update_chamados_updated_at
  BEFORE UPDATE ON public.chamados
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_chamados_config_updated_at
  BEFORE UPDATE ON public.chamados_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_chamados_webhooks_updated_at
  BEFORE UPDATE ON public.chamados_webhooks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_chamados_api_keys_updated_at
  BEFORE UPDATE ON public.chamados_api_keys
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
