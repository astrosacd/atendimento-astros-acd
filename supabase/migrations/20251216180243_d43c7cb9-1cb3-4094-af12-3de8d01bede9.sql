-- Tabela de logs dedicada ao módulo Divulgador
CREATE TABLE IF NOT EXISTS public.divulgador_operation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NULL,
  operation text NOT NULL,
  status text NOT NULL DEFAULT 'info',
  message text NULL,
  metadata jsonb NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_divulgador_operation_logs_created_at
  ON public.divulgador_operation_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_divulgador_operation_logs_operation
  ON public.divulgador_operation_logs (operation);

CREATE INDEX IF NOT EXISTS idx_divulgador_operation_logs_user_id
  ON public.divulgador_operation_logs (user_id);

-- RLS
ALTER TABLE public.divulgador_operation_logs ENABLE ROW LEVEL SECURITY;

-- Somente admins podem visualizar
DROP POLICY IF EXISTS "Admins can view divulgador logs" ON public.divulgador_operation_logs;
CREATE POLICY "Admins can view divulgador logs"
ON public.divulgador_operation_logs
FOR SELECT
USING (public.is_admin());

-- Qualquer usuário autenticado pode inserir logs (gravaremos user_id no app)
DROP POLICY IF EXISTS "Authenticated can insert divulgador logs" ON public.divulgador_operation_logs;
CREATE POLICY "Authenticated can insert divulgador logs"
ON public.divulgador_operation_logs
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Ninguém atualiza/deleta via client
DROP POLICY IF EXISTS "No updates divulgador logs" ON public.divulgador_operation_logs;
CREATE POLICY "No updates divulgador logs"
ON public.divulgador_operation_logs
FOR UPDATE
USING (false);

DROP POLICY IF EXISTS "No deletes divulgador logs" ON public.divulgador_operation_logs;
CREATE POLICY "No deletes divulgador logs"
ON public.divulgador_operation_logs
FOR DELETE
USING (false);