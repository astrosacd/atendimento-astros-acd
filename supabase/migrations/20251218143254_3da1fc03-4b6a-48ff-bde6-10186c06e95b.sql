-- =============================================
-- MÓDULO STATUS DE NÚMEROS - ESTRUTURA COMPLETA
-- =============================================

-- Tabela de Status (Tags dinâmicas)
CREATE TABLE public.numeros_aquecimento_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  cor TEXT DEFAULT 'gray',
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de Modelos de Aparelho
CREATE TABLE public.numeros_aquecimento_modelos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  marca TEXT,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela principal de Números
CREATE TABLE public.numeros_aquecimento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL UNIQUE,
  modelo_id UUID REFERENCES public.numeros_aquecimento_modelos(id) ON DELETE SET NULL,
  status_id UUID REFERENCES public.numeros_aquecimento_status(id) ON DELETE SET NULL,
  ultima_atividade TEXT NOT NULL,
  observacoes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de Histórico (Auditoria completa)
CREATE TABLE public.numeros_aquecimento_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_id UUID REFERENCES public.numeros_aquecimento(id) ON DELETE CASCADE,
  numero_valor TEXT NOT NULL,
  acao TEXT NOT NULL,
  dados_anteriores JSONB,
  dados_novos JSONB,
  campos_alterados TEXT[],
  usuario_id UUID,
  usuario_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de Webhooks do módulo
CREATE TABLE public.numeros_aquecimento_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  url TEXT NOT NULL,
  eventos TEXT[] NOT NULL DEFAULT '{}',
  secret_key TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de API Keys do módulo
CREATE TABLE public.numeros_aquecimento_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  api_key TEXT NOT NULL UNIQUE,
  descricao TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger para updated_at
CREATE TRIGGER update_numeros_aquecimento_updated_at
  BEFORE UPDATE ON public.numeros_aquecimento
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_numeros_aquecimento_status_updated_at
  BEFORE UPDATE ON public.numeros_aquecimento_status
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_numeros_aquecimento_modelos_updated_at
  BEFORE UPDATE ON public.numeros_aquecimento_modelos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_numeros_aquecimento_webhooks_updated_at
  BEFORE UPDATE ON public.numeros_aquecimento_webhooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_numeros_aquecimento_api_keys_updated_at
  BEFORE UPDATE ON public.numeros_aquecimento_api_keys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE public.numeros_aquecimento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.numeros_aquecimento_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.numeros_aquecimento_modelos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.numeros_aquecimento_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.numeros_aquecimento_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.numeros_aquecimento_api_keys ENABLE ROW LEVEL SECURITY;

-- Políticas para numeros_aquecimento
CREATE POLICY "Admins can manage numeros_aquecimento" ON public.numeros_aquecimento
  FOR ALL USING (is_admin());

CREATE POLICY "Authenticated can view numeros_aquecimento" ON public.numeros_aquecimento
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can insert numeros_aquecimento" ON public.numeros_aquecimento
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can update numeros_aquecimento" ON public.numeros_aquecimento
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Políticas para status
CREATE POLICY "Admins can manage numeros_aquecimento_status" ON public.numeros_aquecimento_status
  FOR ALL USING (is_admin());

CREATE POLICY "Authenticated can view numeros_aquecimento_status" ON public.numeros_aquecimento_status
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Políticas para modelos
CREATE POLICY "Admins can manage numeros_aquecimento_modelos" ON public.numeros_aquecimento_modelos
  FOR ALL USING (is_admin());

CREATE POLICY "Authenticated can view numeros_aquecimento_modelos" ON public.numeros_aquecimento_modelos
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Políticas para histórico
CREATE POLICY "Admins can manage numeros_aquecimento_history" ON public.numeros_aquecimento_history
  FOR ALL USING (is_admin());

CREATE POLICY "Authenticated can view numeros_aquecimento_history" ON public.numeros_aquecimento_history
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can insert numeros_aquecimento_history" ON public.numeros_aquecimento_history
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Service can insert numeros_aquecimento_history" ON public.numeros_aquecimento_history
  FOR INSERT WITH CHECK (true);

-- Políticas para webhooks
CREATE POLICY "Admins can manage numeros_aquecimento_webhooks" ON public.numeros_aquecimento_webhooks
  FOR ALL USING (is_admin());

-- Políticas para API keys
CREATE POLICY "Admins can manage numeros_aquecimento_api_keys" ON public.numeros_aquecimento_api_keys
  FOR ALL USING (is_admin());

-- =============================================
-- DADOS INICIAIS
-- =============================================

-- Status padrão
INSERT INTO public.numeros_aquecimento_status (nome, cor, descricao) VALUES
  ('Ativo', 'green', 'Número ativo e funcionando'),
  ('Em Aquecimento', 'amber', 'Número em processo de aquecimento'),
  ('Pausado', 'slate', 'Número temporariamente pausado'),
  ('Bloqueado', 'red', 'Número bloqueado'),
  ('Vendido', 'blue', 'Número vendido');

-- Modelos padrão
INSERT INTO public.numeros_aquecimento_modelos (nome, marca, descricao) VALUES
  ('iPhone 12', 'Apple', 'iPhone 12 64GB'),
  ('iPhone 13', 'Apple', 'iPhone 13 128GB'),
  ('iPhone 14', 'Apple', 'iPhone 14 128GB'),
  ('Galaxy S21', 'Samsung', 'Samsung Galaxy S21'),
  ('Galaxy S22', 'Samsung', 'Samsung Galaxy S22'),
  ('Redmi Note 11', 'Xiaomi', 'Xiaomi Redmi Note 11'),
  ('Redmi Note 12', 'Xiaomi', 'Xiaomi Redmi Note 12'),
  ('Moto G52', 'Motorola', 'Motorola Moto G52'),
  ('Outro', 'Genérico', 'Modelo não especificado');

-- =============================================
-- PERMISSÕES DO MÓDULO
-- =============================================

INSERT INTO public.system_permissions (key, name, category, description) VALUES
  ('view_numeros_aquecimento', 'Visualizar Números', 'Status de Números', 'Permite visualizar a lista de números'),
  ('create_numeros_aquecimento', 'Cadastrar Números', 'Status de Números', 'Permite cadastrar novos números'),
  ('edit_numeros_aquecimento', 'Editar Números', 'Status de Números', 'Permite editar dados dos números'),
  ('change_status_numeros', 'Alterar Status', 'Status de Números', 'Permite alterar o status dos números'),
  ('change_obs_numeros', 'Alterar Observações', 'Status de Números', 'Permite alterar observações dos números'),
  ('delete_numeros_aquecimento', 'Excluir Números', 'Status de Números', 'Permite excluir números'),
  ('export_numeros_aquecimento', 'Exportar CSV', 'Status de Números', 'Permite exportar dados em CSV'),
  ('view_history_numeros', 'Visualizar Histórico', 'Status de Números', 'Permite visualizar histórico de alterações'),
  ('manage_webhooks_numeros', 'Gerenciar Webhooks', 'Status de Números', 'Permite configurar webhooks'),
  ('manage_api_numeros', 'Gerenciar API REST', 'Status de Números', 'Permite gerenciar API keys e consumir API'),
  ('manage_status_numeros', 'Gerenciar Status', 'Status de Números', 'Permite criar/editar/excluir status'),
  ('manage_modelos_numeros', 'Gerenciar Modelos', 'Status de Números', 'Permite criar/editar/excluir modelos');

-- Dar todas as permissões ao admin
INSERT INTO public.role_permissions (role_name, permission_key)
SELECT 'admin', key FROM public.system_permissions WHERE category = 'Status de Números';