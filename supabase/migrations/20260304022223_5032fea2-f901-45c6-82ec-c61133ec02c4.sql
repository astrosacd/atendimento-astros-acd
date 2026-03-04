
-- Pipeline stages for Kanban
CREATE TABLE public.pipeline_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  order_index INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Client-stage mapping
CREATE TABLE public.client_pipeline (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
  stage_id UUID REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  moved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  moved_by UUID,
  notes TEXT,
  UNIQUE(cliente_id)
);

-- Automation rules table
CREATE TABLE public.automation_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL, -- 'renewal_delay', 'proposal_accepted', 'payment_confirmed', 'client_created'
  trigger_config JSONB DEFAULT '{}',
  action_type TEXT NOT NULL, -- 'create_task', 'move_pipeline', 'send_notification'
  action_config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Automation execution logs
CREATE TABLE public.automation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id UUID REFERENCES public.automation_rules(id) ON DELETE CASCADE NOT NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
  action_taken TEXT NOT NULL,
  result TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_pipeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

-- Policies - authenticated users can read, admins can write
CREATE POLICY "Authenticated users can read pipeline_stages" ON public.pipeline_stages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage pipeline_stages" ON public.pipeline_stages FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Authenticated users can read client_pipeline" ON public.client_pipeline FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage client_pipeline" ON public.client_pipeline FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read automation_rules" ON public.automation_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage automation_rules" ON public.automation_rules FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Authenticated users can read automation_logs" ON public.automation_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert automation_logs" ON public.automation_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Insert default pipeline stages
INSERT INTO public.pipeline_stages (name, color, order_index, is_default) VALUES
  ('Lead', '#3b82f6', 0, true),
  ('Negociação', '#f59e0b', 1, false),
  ('Ativo', '#10b981', 2, false),
  ('Inadimplente', '#ef4444', 3, false),
  ('Churn', '#6b7280', 4, false);

-- Insert the default automation rule: 30-day delay
INSERT INTO public.automation_rules (name, description, trigger_type, trigger_config, action_type, action_config, is_active) VALUES
  ('Atraso 30 dias → Criar tarefa', 'Quando um cliente não renova há 30 dias, cria uma tarefa automática para contato', 'renewal_delay', '{"days": 30}', 'create_task', '{"title": "Cliente não renovou - entrar em contato", "priority": "high", "description": "O cliente {nome} não renovou há mais de 30 dias. Data de renovação: {data_renovacao}. Produto: {produto}. Valor: R$ {valor}."}', true);
