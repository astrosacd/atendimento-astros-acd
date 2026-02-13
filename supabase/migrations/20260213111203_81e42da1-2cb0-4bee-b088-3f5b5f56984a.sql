
-- Tabela de configuração de follow-ups (delay e cron)
CREATE TABLE public.followup_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT NOT NULL UNIQUE,
  config_value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.followup_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view followup config"
ON public.followup_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage followup config"
ON public.followup_config FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO public.followup_config (config_key, config_value) VALUES
  ('delay_seconds', '10'),
  ('cron_hour', '9'),
  ('cron_minute', '0');

-- Tabela de webhooks de follow-up
CREATE TABLE public.followup_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  url TEXT NOT NULL,
  secret_key TEXT,
  eventos TEXT[] NOT NULL DEFAULT ARRAY['followup.sent', 'followup.failed'],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.followup_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view followup webhooks"
ON public.followup_webhooks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage followup webhooks"
ON public.followup_webhooks FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Logs de webhooks de follow-up
CREATE TABLE public.followup_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES public.followup_webhooks(id) ON DELETE CASCADE,
  followup_id UUID REFERENCES public.client_followups(id) ON DELETE SET NULL,
  evento TEXT NOT NULL,
  payload JSONB NOT NULL,
  response_status INT,
  response_body TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.followup_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view followup webhook logs"
ON public.followup_webhook_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can insert followup webhook logs"
ON public.followup_webhook_logs FOR INSERT TO service_role WITH CHECK (true);

-- Funções de cron configurável
CREATE OR REPLACE FUNCTION public.update_followup_cron_schedule(p_hour integer, p_minute integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_schedule TEXT;
  v_utc_hour INTEGER;
BEGIN
  v_utc_hour := p_hour + 3;
  IF v_utc_hour >= 24 THEN
    v_utc_hour := v_utc_hour - 24;
  END IF;
  
  v_schedule := p_minute || ' ' || v_utc_hour || ' * * *';
  
  BEGIN
    PERFORM cron.unschedule('process-followups-cron');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  PERFORM cron.schedule(
    'process-followups-cron',
    v_schedule,
    'SELECT public.execute_followups_cron();'
  );
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Erro ao atualizar cron: %', SQLERRM;
    RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_followup_cron_schedule()
RETURNS TABLE(schedule text, job_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT c.schedule::text, c.jobname::text as job_name
  FROM cron.job c
  WHERE c.jobname = 'process-followups-cron'
  LIMIT 1;
END;
$$;

-- Permissões: Follow-ups
INSERT INTO public.system_permissions (key, name, description, category) VALUES
  ('view_followups', 'Visualizar Follow-ups', 'Permite visualizar a lista de follow-ups', 'Follow-ups'),
  ('create_followups', 'Criar Follow-ups', 'Permite criar novos follow-ups', 'Follow-ups'),
  ('edit_followups', 'Editar Follow-ups', 'Permite editar follow-ups existentes', 'Follow-ups'),
  ('delete_followups', 'Excluir Follow-ups', 'Permite excluir follow-ups', 'Follow-ups'),
  ('manage_followup_config', 'Gerenciar Configurações', 'Permite configurar delay, cron e webhooks', 'Follow-ups'),
  ('manage_followup_webhooks', 'Gerenciar Webhooks', 'Permite gerenciar webhooks de follow-ups', 'Follow-ups');

-- Permissões: Propostas (apenas as que não existem)
INSERT INTO public.system_permissions (key, name, description, category) VALUES
  ('view_proposals', 'Visualizar Propostas', 'Permite visualizar propostas', 'Propostas'),
  ('create_proposals', 'Criar Propostas', 'Permite criar novas propostas', 'Propostas'),
  ('edit_proposals', 'Editar Propostas', 'Permite editar propostas existentes', 'Propostas'),
  ('delete_proposals', 'Excluir Propostas', 'Permite excluir propostas', 'Propostas'),
  ('share_proposals', 'Compartilhar Propostas', 'Permite enviar/compartilhar propostas', 'Propostas'),
  ('manage_proposal_templates', 'Gerenciar Templates', 'Permite gerenciar templates de propostas', 'Propostas'),
  ('view_proposal_history', 'Visualizar Histórico', 'Permite ver histórico de propostas', 'Propostas'),
  ('view_proposals_dashboard', 'Visualizar Dashboard', 'Permite ver dashboard de propostas', 'Propostas')
ON CONFLICT (key) DO UPDATE SET category = EXCLUDED.category, name = EXCLUDED.name, description = EXCLUDED.description;

-- Dar permissões ao admin
INSERT INTO public.role_permissions (role_name, permission_key)
SELECT 'admin', key FROM public.system_permissions 
WHERE category IN ('Follow-ups', 'Propostas')
ON CONFLICT DO NOTHING;
