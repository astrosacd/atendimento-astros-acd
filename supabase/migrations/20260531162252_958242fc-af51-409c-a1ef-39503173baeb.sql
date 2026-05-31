-- SMS Campaigns Table
CREATE TABLE public.sms_campanhas (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL,
    template_id UUID REFERENCES public.sms_templates(id),
    status TEXT NOT NULL DEFAULT 'pendente',
    total INTEGER NOT NULL DEFAULT 0,
    criado_por UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    delay_minutes_override INTEGER,
    dia_alvo DATE
);

-- SMS Scheduled (Queue) Table
CREATE TABLE public.sms_agendados (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    cliente_id UUID REFERENCES public.clientes(id),
    template_id UUID REFERENCES public.sms_templates(id),
    dia_alvo DATE NOT NULL,
    tipo_d TEXT,
    status TEXT NOT NULL DEFAULT 'pendente',
    tentativas INTEGER NOT NULL DEFAULT 0,
    historico_id UUID REFERENCES public.sms_history(id),
    processada_em TIMESTAMP WITH TIME ZONE,
    erro TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    campanha_id UUID REFERENCES public.sms_campanhas(id) ON DELETE CASCADE,
    nome_manual TEXT,
    numero_manual TEXT
);

-- SMS Collection Config Table
CREATE TABLE public.sms_cobranca_config (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    enabled BOOLEAN NOT NULL DEFAULT false,
    template_id UUID REFERENCES public.sms_templates(id),
    delay_minutes INTEGER NOT NULL DEFAULT 5,
    dias_disparo INTEGER[] DEFAULT '{5}',
    horario_inicio TIME WITHOUT TIME ZONE DEFAULT '09:00',
    horario_fim TIME WITHOUT TIME ZONE DEFAULT '18:00',
    apenas_cobranca_ativa BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- SMS Collection Logs Table
CREATE TABLE public.sms_cobranca_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    status TEXT NOT NULL,
    message TEXT,
    enqueued INTEGER DEFAULT 0,
    scanned INTEGER DEFAULT 0,
    triggered_by TEXT DEFAULT 'system',
    dias_processados INTEGER[]
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_campanhas TO authenticated;
GRANT ALL ON public.sms_campanhas TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_agendados TO authenticated;
GRANT ALL ON public.sms_agendados TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_cobranca_config TO authenticated;
GRANT ALL ON public.sms_cobranca_config TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_cobranca_logs TO authenticated;
GRANT ALL ON public.sms_cobranca_logs TO service_role;

-- Row Level Security
ALTER TABLE public.sms_campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_agendados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_cobranca_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_cobranca_logs ENABLE ROW LEVEL SECURITY;

-- Temporary Access Function for SMS
CREATE OR REPLACE FUNCTION public.has_sms_temp_perm(p_perm text)
RETURNS boolean AS $$
DECLARE
  v_token text;
  v_perms text[];
BEGIN
  BEGIN
    v_token := nullif(current_setting('request.headers', true)::json->>'x-temp-access-token', '');
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;

  IF v_token IS NULL THEN
    RETURN false;
  END IF;

  SELECT permissions INTO v_perms
  FROM public.temporary_access_tokens
  WHERE token = v_token
    AND is_active = true
    AND expires_at > now()
    AND target_path = '/central-sms'
    AND (max_uses IS NULL OR uses < max_uses)
  LIMIT 1;

  RETURN v_perms IS NOT NULL AND p_perm = ANY(v_perms);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies for SMS Campaigns
CREATE POLICY "Admins manage sms_campanhas" ON public.sms_campanhas
    FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Temp access can view sms_campanhas" ON public.sms_campanhas
    FOR SELECT USING (has_sms_temp_perm('campanhas'));

CREATE POLICY "Users with manage_sms_campanhas can manage" ON public.sms_campanhas
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN role_permissions rp ON rp.role_name = ur.role
            WHERE ur.user_id = auth.uid() AND rp.permission_key = 'manage_sms_campanhas'
        )
    );

-- RLS Policies for SMS Scheduled
CREATE POLICY "Admins manage sms_agendados" ON public.sms_agendados
    FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Temp access can view sms_agendados" ON public.sms_agendados
    FOR SELECT USING (has_sms_temp_perm('fila') OR has_sms_temp_perm('campanhas'));

CREATE POLICY "Users with manage_sms_campanhas can manage agendados" ON public.sms_agendados
    FOR ALL USING (
        (campanha_id IS NOT NULL) AND
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN role_permissions rp ON rp.role_name = ur.role
            WHERE ur.user_id = auth.uid() AND rp.permission_key = 'manage_sms_campanhas'
        )
    );

-- RLS Policies for SMS Collection Config
CREATE POLICY "Admins manage sms_cobranca_config" ON public.sms_cobranca_config
    FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Temp access can view sms_cobranca_config" ON public.sms_cobranca_config
    FOR SELECT USING (has_sms_temp_perm('cobranca') OR has_sms_temp_perm('fila'));

-- RLS Policies for SMS Collection Logs
CREATE POLICY "Admins can view sms_cobranca_logs" ON public.sms_cobranca_logs
    FOR SELECT USING (is_admin());

-- System Permissions
INSERT INTO public.system_permissions (key, name, description, category) VALUES
('view_central_sms', 'Ver Central SMS', 'Acessar o módulo de Central de SMS (histórico, envio manual e fila)', 'Central SMS'),
('execute_sms_fila', 'Executar fila de SMS', 'Iniciar, pausar e parar a fila diária de envios de SMS automatizados', 'Central SMS'),
('manage_sms_cobranca_config', 'Configurar cobrança por SMS', 'Editar a configuração de cobrança automática por SMS (D-3, D0, D+5, etc.)', 'Central SMS'),
('manage_sms_campanhas', 'Gerenciar campanhas de SMS', 'Criar, executar e cancelar campanhas em massa de envio de SMS', 'Central SMS');

-- Triggers for updated_at
CREATE TRIGGER update_sms_campanhas_updated_at BEFORE UPDATE ON public.sms_campanhas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sms_agendados_updated_at BEFORE UPDATE ON public.sms_agendados FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sms_cobranca_config_updated_at BEFORE UPDATE ON public.sms_cobranca_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
