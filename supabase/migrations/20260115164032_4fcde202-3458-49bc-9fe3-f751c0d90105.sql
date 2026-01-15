-- =============================================
-- SISTEMA DE PROPOSTAS COMERCIAIS
-- =============================================

-- Enum para status de propostas
DO $$ BEGIN
  CREATE TYPE proposal_status AS ENUM ('draft', 'sent', 'viewed', 'accepted', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Tabela principal de propostas
CREATE TABLE IF NOT EXISTS public.proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  template_id UUID,
  title TEXT NOT NULL DEFAULT 'Nova Proposta',
  status proposal_status NOT NULL DEFAULT 'draft',
  share_token UUID NOT NULL DEFAULT gen_random_uuid(),
  valid_until DATE,
  total_value NUMERIC(12, 2) DEFAULT 0,
  notes TEXT,
  client_signature TEXT,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para proposals
CREATE INDEX IF NOT EXISTS idx_proposals_user_id ON public.proposals(user_id);
CREATE INDEX IF NOT EXISTS idx_proposals_client_id ON public.proposals(client_id);
CREATE INDEX IF NOT EXISTS idx_proposals_share_token ON public.proposals(share_token);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON public.proposals(status);

-- Tabela de seções da proposta
CREATE TABLE IF NOT EXISTS public.proposal_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  section_type TEXT NOT NULL,
  title TEXT,
  content JSONB DEFAULT '{}'::jsonb,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para proposal_sections
CREATE INDEX IF NOT EXISTS idx_proposal_sections_proposal_id ON public.proposal_sections(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_sections_order ON public.proposal_sections(proposal_id, order_index);

-- Tabela de logs de visualização
CREATE TABLE IF NOT EXISTS public.proposal_view_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  country TEXT,
  city TEXT
);

-- Índice para view_logs
CREATE INDEX IF NOT EXISTS idx_proposal_view_logs_proposal_id ON public.proposal_view_logs(proposal_id);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_proposal_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE TRIGGER trigger_proposals_updated_at
  BEFORE UPDATE ON public.proposals
  FOR EACH ROW
  EXECUTE FUNCTION update_proposal_updated_at();

CREATE OR REPLACE TRIGGER trigger_proposal_sections_updated_at
  BEFORE UPDATE ON public.proposal_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_proposal_updated_at();

-- =============================================
-- RLS POLICIES
-- =============================================

-- Habilitar RLS
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_view_logs ENABLE ROW LEVEL SECURITY;

-- Policies para proposals
CREATE POLICY "Users can view own proposals" 
  ON public.proposals FOR SELECT 
  TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can create own proposals" 
  ON public.proposals FOR INSERT 
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own proposals" 
  ON public.proposals FOR UPDATE 
  TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can delete own proposals" 
  ON public.proposals FOR DELETE 
  TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Policy para visualização pública via share_token (anon)
CREATE POLICY "Public can view proposals via share token" 
  ON public.proposals FOR SELECT 
  TO anon
  USING (true);

-- Policies para proposal_sections
CREATE POLICY "Users can view sections of own proposals" 
  ON public.proposal_sections FOR SELECT 
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.proposals 
    WHERE id = proposal_id 
    AND (user_id = auth.uid() OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'))
  ));

CREATE POLICY "Users can manage sections of own proposals" 
  ON public.proposal_sections FOR ALL 
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.proposals 
    WHERE id = proposal_id 
    AND (user_id = auth.uid() OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'))
  ));

-- Policy para sections públicas
CREATE POLICY "Public can view sections via share token" 
  ON public.proposal_sections FOR SELECT 
  TO anon
  USING (true);

-- Policies para view_logs
CREATE POLICY "Users can view logs of own proposals" 
  ON public.proposal_view_logs FOR SELECT 
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.proposals 
    WHERE id = proposal_id 
    AND (user_id = auth.uid() OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'))
  ));

CREATE POLICY "Anyone can insert view logs" 
  ON public.proposal_view_logs FOR INSERT 
  TO anon, authenticated
  WITH CHECK (true);

-- =============================================
-- PERMISSIONS
-- =============================================

-- Inserir permissões do módulo de propostas
INSERT INTO public.system_permissions (key, name, description, category) VALUES
  ('view_proposals', 'Ver Propostas', 'Permite visualizar propostas comerciais', 'Propostas'),
  ('create_proposals', 'Criar Propostas', 'Permite criar novas propostas comerciais', 'Propostas'),
  ('edit_proposals', 'Editar Propostas', 'Permite editar propostas existentes', 'Propostas'),
  ('delete_proposals', 'Excluir Propostas', 'Permite excluir propostas', 'Propostas'),
  ('share_proposals', 'Compartilhar Propostas', 'Permite gerar links de compartilhamento e exportar PDF', 'Propostas'),
  ('manage_proposal_templates', 'Gerenciar Templates', 'Permite criar e gerenciar templates de propostas', 'Propostas')
ON CONFLICT DO NOTHING;

-- Dar permissões ao admin
INSERT INTO public.role_permissions (role_name, permission_key) VALUES
  ('admin', 'view_proposals'),
  ('admin', 'create_proposals'),
  ('admin', 'edit_proposals'),
  ('admin', 'delete_proposals'),
  ('admin', 'share_proposals'),
  ('admin', 'manage_proposal_templates'),
  ('operador', 'view_proposals'),
  ('operador', 'create_proposals'),
  ('operador', 'edit_proposals'),
  ('operador', 'share_proposals'),
  ('gerente', 'view_proposals'),
  ('gerente', 'create_proposals'),
  ('gerente', 'edit_proposals'),
  ('gerente', 'share_proposals')
ON CONFLICT DO NOTHING;