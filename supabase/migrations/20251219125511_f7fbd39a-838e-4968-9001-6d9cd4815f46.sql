-- =====================================================
-- MÓDULO: CONSULTA DE NÚMEROS (BASEROW INTEGRATION)
-- =====================================================

-- Tabela de configuração do Baserow
CREATE TABLE public.consulta_numeros_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key text NOT NULL UNIQUE,
    config_value text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Tabela de mapeamento de campos do Baserow
CREATE TABLE public.consulta_numeros_field_mappings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    field_name text NOT NULL,
    baserow_field_id text NOT NULL,
    baserow_field_name text NOT NULL,
    is_required boolean DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE(field_name)
);

-- Tabela de histórico e auditoria
CREATE TABLE public.consulta_numeros_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    numero text NOT NULL,
    baserow_row_id text,
    acao text NOT NULL,
    origem text NOT NULL,
    dados_anteriores jsonb,
    dados_novos jsonb,
    campos_alterados text[],
    usuario_id uuid,
    usuario_email text,
    api_key_id uuid,
    webhook_id uuid,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Tabela de API Keys
CREATE TABLE public.consulta_numeros_api_keys (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL,
    api_key text NOT NULL UNIQUE,
    descricao text,
    is_active boolean NOT NULL DEFAULT true,
    permissions text[] NOT NULL DEFAULT '{}',
    created_by uuid,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Tabela de Webhooks
CREATE TABLE public.consulta_numeros_webhooks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL,
    url text NOT NULL,
    secret_key text,
    eventos text[] NOT NULL DEFAULT '{}',
    is_active boolean NOT NULL DEFAULT true,
    created_by uuid,
    last_triggered_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_consulta_numeros_history_numero ON public.consulta_numeros_history(numero);
CREATE INDEX idx_consulta_numeros_history_created_at ON public.consulta_numeros_history(created_at DESC);
CREATE INDEX idx_consulta_numeros_history_acao ON public.consulta_numeros_history(acao);
CREATE INDEX idx_consulta_numeros_history_origem ON public.consulta_numeros_history(origem);

-- Enable RLS
ALTER TABLE public.consulta_numeros_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consulta_numeros_field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consulta_numeros_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consulta_numeros_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consulta_numeros_webhooks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for consulta_numeros_config
CREATE POLICY "Admins can manage consulta_numeros_config"
ON public.consulta_numeros_config FOR ALL
USING (is_admin());

CREATE POLICY "Authenticated can view consulta_numeros_config"
ON public.consulta_numeros_config FOR SELECT
USING (auth.uid() IS NOT NULL);

-- RLS Policies for consulta_numeros_field_mappings
CREATE POLICY "Admins can manage consulta_numeros_field_mappings"
ON public.consulta_numeros_field_mappings FOR ALL
USING (is_admin());

CREATE POLICY "Authenticated can view consulta_numeros_field_mappings"
ON public.consulta_numeros_field_mappings FOR SELECT
USING (auth.uid() IS NOT NULL);

-- RLS Policies for consulta_numeros_history
CREATE POLICY "Admins can manage consulta_numeros_history"
ON public.consulta_numeros_history FOR ALL
USING (is_admin());

CREATE POLICY "Authenticated can view consulta_numeros_history"
ON public.consulta_numeros_history FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service can insert consulta_numeros_history"
ON public.consulta_numeros_history FOR INSERT
WITH CHECK (true);

-- RLS Policies for consulta_numeros_api_keys
CREATE POLICY "Admins can manage consulta_numeros_api_keys"
ON public.consulta_numeros_api_keys FOR ALL
USING (is_admin());

-- RLS Policies for consulta_numeros_webhooks
CREATE POLICY "Admins can manage consulta_numeros_webhooks"
ON public.consulta_numeros_webhooks FOR ALL
USING (is_admin());

-- Trigger for updated_at
CREATE TRIGGER update_consulta_numeros_config_updated_at
    BEFORE UPDATE ON public.consulta_numeros_config
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_consulta_numeros_field_mappings_updated_at
    BEFORE UPDATE ON public.consulta_numeros_field_mappings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_consulta_numeros_api_keys_updated_at
    BEFORE UPDATE ON public.consulta_numeros_api_keys
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_consulta_numeros_webhooks_updated_at
    BEFORE UPDATE ON public.consulta_numeros_webhooks
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default configuration
INSERT INTO public.consulta_numeros_config (config_key, config_value) VALUES
    ('baserow_api_url', ''),
    ('baserow_api_token', ''),
    ('baserow_table_id', ''),
    ('baserow_database_id', '');

-- Insert default field mappings
INSERT INTO public.consulta_numeros_field_mappings (field_name, baserow_field_id, baserow_field_name, is_required) VALUES
    ('numero', '', 'Número', true),
    ('status', '', 'Status', true),
    ('observacoes', '', 'Observações', false),
    ('origem', '', 'Origem', false),
    ('data_cadastro', '', 'Data de Cadastro', false),
    ('ultima_atualizacao', '', 'Última Atualização', false);

-- Add new permissions for the module
INSERT INTO public.system_permissions (key, name, description, category) VALUES
    ('view_consulta_numeros', 'Visualizar Consulta de Números', 'Permite acessar o módulo Consulta de Números', 'Consulta de Números'),
    ('query_consulta_numeros', 'Consultar Números', 'Permite consultar números no Baserow', 'Consulta de Números'),
    ('update_status_consulta_numeros', 'Atualizar Status', 'Permite atualizar o status de números', 'Consulta de Números'),
    ('update_obs_consulta_numeros', 'Atualizar Observações', 'Permite atualizar observações de números', 'Consulta de Números'),
    ('update_both_consulta_numeros', 'Atualizar Status + Observações', 'Permite atualizar status e observações simultaneamente', 'Consulta de Números'),
    ('view_history_consulta_numeros', 'Visualizar Histórico', 'Permite visualizar o histórico de ações', 'Consulta de Números'),
    ('export_consulta_numeros', 'Exportar Dados', 'Permite exportar dados de consulta e histórico', 'Consulta de Números'),
    ('api_consulta_numeros', 'Acessar API Externa', 'Permite utilizar a API REST do módulo', 'Consulta de Números'),
    ('manage_webhooks_consulta_numeros', 'Gerenciar Webhooks', 'Permite configurar webhooks do módulo', 'Consulta de Números'),
    ('manage_config_consulta_numeros', 'Gerenciar Configurações', 'Permite configurar a integração com Baserow', 'Consulta de Números')
ON CONFLICT (key) DO NOTHING;