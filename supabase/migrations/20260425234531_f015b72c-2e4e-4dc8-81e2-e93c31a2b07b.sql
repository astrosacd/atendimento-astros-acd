
-- ============================================
-- MÓDULO 1: SCORE DE CLIENTE (tipo Serasa interno)
-- ============================================

CREATE TABLE IF NOT EXISTS public.client_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL UNIQUE REFERENCES public.clientes(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 500 CHECK (score >= 0 AND score <= 1000),
  faixa TEXT NOT NULL DEFAULT 'bronze' CHECK (faixa IN ('ouro', 'prata', 'bronze', 'risco')),
  justificativa TEXT,
  desconto_sugerido NUMERIC(5,2) DEFAULT 0,
  fatores JSONB DEFAULT '{}'::jsonb,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_scores_cliente ON public.client_scores(cliente_id);
CREATE INDEX idx_client_scores_faixa ON public.client_scores(faixa);
CREATE INDEX idx_client_scores_score ON public.client_scores(score DESC);

ALTER TABLE public.client_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all scores"
  ON public.client_scores FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can manage scores"
  ON public.client_scores FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "System can insert scores"
  ON public.client_scores FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE TRIGGER update_client_scores_updated_at
  BEFORE UPDATE ON public.client_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Histórico de alterações de score
CREATE TABLE IF NOT EXISTS public.client_score_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  score_anterior INTEGER,
  score_novo INTEGER NOT NULL,
  faixa_anterior TEXT,
  faixa_nova TEXT NOT NULL,
  motivo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_score_history_cliente ON public.client_score_history(cliente_id, created_at DESC);

ALTER TABLE public.client_score_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view score history"
  ON public.client_score_history FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "System can insert history"
  ON public.client_score_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Função e trigger para registrar histórico automaticamente
CREATE OR REPLACE FUNCTION public.track_client_score_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só registra se houve mudança real de score ou faixa
  IF (TG_OP = 'UPDATE' AND (OLD.score IS DISTINCT FROM NEW.score OR OLD.faixa IS DISTINCT FROM NEW.faixa)) THEN
    INSERT INTO public.client_score_history (
      cliente_id, score_anterior, score_novo, faixa_anterior, faixa_nova, motivo
    ) VALUES (
      NEW.cliente_id, OLD.score, NEW.score, OLD.faixa, NEW.faixa, NEW.justificativa
    );
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO public.client_score_history (
      cliente_id, score_anterior, score_novo, faixa_anterior, faixa_nova, motivo
    ) VALUES (
      NEW.cliente_id, NULL, NEW.score, NULL, NEW.faixa, NEW.justificativa
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_track_score_changes
  AFTER INSERT OR UPDATE ON public.client_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.track_client_score_changes();

-- ============================================
-- MÓDULO 2: HISTÓRICO DE LOGIN E SESSÕES
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_login_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  device_name TEXT,
  browser TEXT,
  os TEXT,
  city TEXT,
  country TEXT,
  is_new_device BOOLEAN DEFAULT false,
  session_id TEXT,
  logged_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  logged_out_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_login_history_user ON public.user_login_history(user_id, logged_in_at DESC);
CREATE INDEX idx_login_history_active ON public.user_login_history(user_id, is_active) WHERE is_active = true;

ALTER TABLE public.user_login_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own login history"
  ON public.user_login_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own login history"
  ON public.user_login_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own login history"
  ON public.user_login_history FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all login history"
  ON public.user_login_history FOR SELECT
  TO authenticated
  USING (is_admin());

-- Alertas de segurança para o dashboard
CREATE TABLE IF NOT EXISTS public.user_security_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('new_device_login', 'new_location_login', 'suspicious_activity', 'score_drop')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_security_alerts_user ON public.user_security_alerts(user_id, is_read, created_at DESC);

ALTER TABLE public.user_security_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alerts"
  ON public.user_security_alerts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own alerts"
  ON public.user_security_alerts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own alerts"
  ON public.user_security_alerts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all alerts"
  ON public.user_security_alerts FOR SELECT
  TO authenticated
  USING (is_admin());

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.client_scores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_security_alerts;
