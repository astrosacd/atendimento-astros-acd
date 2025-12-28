-- Criar tabela de tarefas vinculadas a clientes
CREATE TABLE public.client_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  priority TEXT NOT NULL DEFAULT 'media' CHECK (priority IN ('baixa', 'media', 'alta', 'urgente')),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluida', 'cancelada')),
  assigned_to UUID,
  assigned_to_email TEXT,
  created_by UUID,
  created_by_email TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_tasks ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage client_tasks"
ON public.client_tasks FOR ALL
USING (is_admin());

CREATE POLICY "Operadores can manage client_tasks"
ON public.client_tasks FOR ALL
USING (is_operador());

CREATE POLICY "Gerentes can manage their client tasks"
ON public.client_tasks FOR ALL
USING (is_gerente() AND (
  created_by = auth.uid() OR 
  assigned_to = auth.uid() OR
  EXISTS (SELECT 1 FROM clientes c WHERE c.id = client_tasks.cliente_id AND c.created_by = auth.uid())
));

-- Trigger for updated_at
CREATE TRIGGER update_client_tasks_updated_at
BEFORE UPDATE ON public.client_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add permission for tasks
INSERT INTO system_permissions (key, name, description, category) VALUES
('manage_tasks', 'Gerenciar Tarefas', 'Permite criar, editar e excluir tarefas vinculadas a clientes', 'Clientes')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_name, permission_key) VALUES
('admin', 'manage_tasks'),
('operador', 'manage_tasks')
ON CONFLICT DO NOTHING;