-- Criar tabela de roles customizáveis
CREATE TABLE public.custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  color text DEFAULT 'gray',
  is_system_role boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar tabela de permissões do sistema
CREATE TABLE public.system_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  category text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Criar tabela de relacionamento role-permissão
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name text NOT NULL,
  permission_key text NOT NULL REFERENCES public.system_permissions(key) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(role_name, permission_key)
);

-- Habilitar RLS
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Policies para admin gerenciar
CREATE POLICY "Admins can manage custom_roles" ON public.custom_roles FOR ALL USING (is_admin());
CREATE POLICY "Anyone can view custom_roles" ON public.custom_roles FOR SELECT USING (true);

CREATE POLICY "Admins can manage system_permissions" ON public.system_permissions FOR ALL USING (is_admin());
CREATE POLICY "Anyone can view system_permissions" ON public.system_permissions FOR SELECT USING (true);

CREATE POLICY "Admins can manage role_permissions" ON public.role_permissions FOR ALL USING (is_admin());
CREATE POLICY "Anyone can view role_permissions" ON public.role_permissions FOR SELECT USING (true);

-- Inserir roles padrão do sistema
INSERT INTO public.custom_roles (name, display_name, description, color, is_system_role) VALUES
('admin', 'Administrador', 'Acesso completo ao sistema. Pode gerenciar usuários, configurações, webhooks, API e todos os clientes.', 'emerald', true),
('operador', 'Operador', 'Pode cadastrar e atualizar clientes, mas não pode excluir. Não tem acesso às configurações administrativas.', 'orange', true),
('gerente', 'Gerente', 'Gerencia apenas os clientes que ele mesmo cadastrou. Tem controle total sobre seus próprios clientes.', 'purple', true),
('user', 'Visualizador', 'Acesso somente leitura. Pode consultar clientes e exportar dados, mas não pode criar ou modificar.', 'gray', true);

-- Inserir permissões do sistema
INSERT INTO public.system_permissions (key, name, description, category) VALUES
-- Dashboard
('view_dashboard', 'Visualizar Dashboard', 'Permite ver o dashboard principal', 'dashboard'),
-- Clientes
('view_clients', 'Consultar Clientes', 'Permite consultar e visualizar clientes', 'clientes'),
('create_clients', 'Cadastrar Clientes', 'Permite cadastrar novos clientes', 'clientes'),
('update_clients', 'Atualizar Clientes', 'Permite atualizar dados de clientes', 'clientes'),
('delete_clients', 'Excluir Clientes', 'Permite excluir clientes do sistema', 'clientes'),
('export_clients', 'Exportar Clientes', 'Permite exportar dados de clientes', 'clientes'),
-- Admin
('manage_users', 'Gerenciar Usuários', 'Permite aprovar, editar e excluir usuários', 'admin'),
('manage_permissions', 'Gerenciar Permissões', 'Permite editar e criar roles e permissões', 'admin'),
('manage_billing', 'Gerenciar Cobrança', 'Permite acessar e configurar o sistema de cobrança', 'admin'),
('manage_webhooks', 'Gerenciar Webhooks', 'Permite criar e editar webhooks', 'admin'),
('manage_api', 'Gerenciar API REST', 'Permite gerenciar chaves de API', 'admin'),
('view_logs', 'Visualizar Logs', 'Permite visualizar logs de auditoria', 'admin'),
('manage_settings', 'Configurações Gerais', 'Permite acessar configurações do sistema', 'admin');

-- Inserir permissões padrão para cada role
-- Admin - todas as permissões
INSERT INTO public.role_permissions (role_name, permission_key) 
SELECT 'admin', key FROM public.system_permissions;

-- Operador - dashboard, clientes (sem excluir)
INSERT INTO public.role_permissions (role_name, permission_key) VALUES
('operador', 'view_dashboard'),
('operador', 'view_clients'),
('operador', 'create_clients'),
('operador', 'update_clients'),
('operador', 'export_clients');

-- Gerente - dashboard, clientes próprios
INSERT INTO public.role_permissions (role_name, permission_key) VALUES
('gerente', 'view_dashboard'),
('gerente', 'view_clients'),
('gerente', 'create_clients'),
('gerente', 'update_clients'),
('gerente', 'delete_clients'),
('gerente', 'export_clients');

-- Visualizador - apenas consulta
INSERT INTO public.role_permissions (role_name, permission_key) VALUES
('user', 'view_dashboard'),
('user', 'view_clients'),
('user', 'export_clients');

-- Trigger para updated_at
CREATE TRIGGER update_custom_roles_updated_at
BEFORE UPDATE ON public.custom_roles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();