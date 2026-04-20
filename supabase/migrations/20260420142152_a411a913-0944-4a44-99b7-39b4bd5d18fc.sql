-- Tabela para cadastrar ferramentas/servidores customizados reutilizáveis
CREATE TABLE IF NOT EXISTS public.client_server_tool_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  value TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'Server',
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_server_tool_types ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado pode ler
CREATE POLICY "Authenticated users can view server tool types"
  ON public.client_server_tool_types
  FOR SELECT
  TO authenticated
  USING (true);

-- Apenas usuários com permissão de gerenciar credenciais podem criar/editar
CREATE POLICY "Users can create server tool types"
  ON public.client_server_tool_types
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update non-system tool types"
  ON public.client_server_tool_types
  FOR UPDATE
  TO authenticated
  USING (NOT is_system)
  WITH CHECK (NOT is_system);

CREATE POLICY "Users can delete non-system tool types"
  ON public.client_server_tool_types
  FOR DELETE
  TO authenticated
  USING (NOT is_system AND (created_by = auth.uid() OR public.is_admin()));

-- Trigger updated_at
CREATE TRIGGER update_client_server_tool_types_updated_at
  BEFORE UPDATE ON public.client_server_tool_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed das ferramentas pré-existentes do sistema
INSERT INTO public.client_server_tool_types (value, label, icon, is_system) VALUES
  ('evolution', 'Evolution', 'Bot', true),
  ('chatwoot', 'Chatwoot', 'Bot', true),
  ('n8n', 'n8n', 'Workflow', true),
  ('servidor', 'Servidor / VPS', 'Server', true)
ON CONFLICT (value) DO NOTHING;