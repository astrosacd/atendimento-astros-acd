
-- Tabela principal de follow-ups
CREATE TABLE public.client_followups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Cliente (pode ser cadastrado ou manual)
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  manual_name TEXT,
  manual_email TEXT,
  manual_phone TEXT,
  -- Produto/interesse
  produto TEXT NOT NULL,
  -- Mensagem
  message_template TEXT,
  custom_message TEXT,
  -- Agendamento
  channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'email', 'both')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  -- Recorrência
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurrence_interval_days INTEGER DEFAULT NULL,
  max_attempts INTEGER DEFAULT 1,
  current_attempt INTEGER NOT NULL DEFAULT 0,
  next_dispatch_at TIMESTAMPTZ,
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'completed', 'cancelled', 'failed')),
  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de logs de envio
CREATE TABLE public.client_followup_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  followup_id UUID NOT NULL REFERENCES public.client_followups(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger para updated_at
CREATE TRIGGER update_client_followups_updated_at
  BEFORE UPDATE ON public.client_followups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.client_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_followup_logs ENABLE ROW LEVEL SECURITY;

-- Policies para client_followups (usuários autenticados podem gerenciar)
CREATE POLICY "Authenticated users can view followups"
  ON public.client_followups FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create followups"
  ON public.client_followups FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update followups"
  ON public.client_followups FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete followups"
  ON public.client_followups FOR DELETE TO authenticated
  USING (true);

-- Policies para logs
CREATE POLICY "Authenticated users can view followup logs"
  ON public.client_followup_logs FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Service can insert followup logs"
  ON public.client_followup_logs FOR INSERT TO service_role
  WITH CHECK (true);

-- Índices
CREATE INDEX idx_followups_status ON public.client_followups(status);
CREATE INDEX idx_followups_next_dispatch ON public.client_followups(next_dispatch_at) WHERE status = 'pending';
CREATE INDEX idx_followup_logs_followup_id ON public.client_followup_logs(followup_id);

-- Função para executar o cron de follow-ups
CREATE OR REPLACE FUNCTION public.execute_followups_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://udxaxemoozddkwpitngq.supabase.co/functions/v1/process-followups',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkeGF4ZW1vb3pkZGt3cGl0bmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NjQ1MTQsImV4cCI6MjA4MTA0MDUxNH0.d8F3I7PofiAkTm0qKpu3k1pTGqSFpHPmsl0nMdghvYM'
    ),
    body := '{}'::jsonb
  );
END;
$$;
