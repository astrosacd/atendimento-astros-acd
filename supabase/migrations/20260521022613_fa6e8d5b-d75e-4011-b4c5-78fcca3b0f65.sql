
-- ============================================================
-- MVP Relatórios de Social Media para Clientes
-- ============================================================

-- 1) PERFIS MONITORADOS (clientes que você gerencia social media)
CREATE TABLE public.social_media_client_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  display_name TEXT,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  profile_picture_url TEXT,
  ig_business_id TEXT,
  followers_count INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- Configurações de envio do relatório
  notify_whatsapp BOOLEAN NOT NULL DEFAULT false,
  notify_email BOOLEAN NOT NULL DEFAULT false,
  whatsapp_number TEXT,
  email TEXT,
  report_day INTEGER NOT NULL DEFAULT 1 CHECK (report_day BETWEEN 1 AND 28),
  auto_send_enabled BOOLEAN NOT NULL DEFAULT false,
  -- Sync
  last_synced_at TIMESTAMPTZ,
  last_sync_status TEXT,
  last_sync_error TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (username)
);

CREATE INDEX idx_smcp_active ON public.social_media_client_profiles(is_active);
CREATE INDEX idx_smcp_cliente ON public.social_media_client_profiles(cliente_id);

-- 2) SNAPSHOT DIÁRIO (1 linha por perfil/dia)
CREATE TABLE public.social_media_daily_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.social_media_client_profiles(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  followers_count INTEGER,
  media_count INTEGER,
  following_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, snapshot_date)
);

CREATE INDEX idx_smds_profile_date ON public.social_media_daily_snapshots(profile_id, snapshot_date DESC);

-- 3) POSTS COLETADOS (incremental por perfil)
CREATE TABLE public.social_media_posts_collected (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.social_media_client_profiles(id) ON DELETE CASCADE,
  ig_media_id TEXT NOT NULL,
  media_type TEXT,
  media_product_type TEXT,
  caption TEXT,
  permalink TEXT,
  media_url TEXT,
  thumbnail_url TEXT,
  like_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  views_count INTEGER,
  hashtags TEXT[],
  posted_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, ig_media_id)
);

CREATE INDEX idx_smpc_profile_date ON public.social_media_posts_collected(profile_id, posted_at DESC);

-- 4) RELATÓRIOS MENSAIS GERADOS
CREATE TABLE public.social_media_monthly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.social_media_client_profiles(id) ON DELETE CASCADE,
  month TEXT NOT NULL, -- formato YYYY-MM
  data JSONB NOT NULL DEFAULT '{}'::jsonb, -- métricas calculadas
  share_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  pdf_url TEXT,
  sent_whatsapp_at TIMESTAMPTZ,
  sent_email_at TIMESTAMPTZ,
  send_whatsapp_error TEXT,
  send_email_error TEXT,
  generated_by UUID,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, month)
);

CREATE INDEX idx_smmr_profile_month ON public.social_media_monthly_reports(profile_id, month DESC);
CREATE INDEX idx_smmr_share_token ON public.social_media_monthly_reports(share_token);

-- 5) CONFIG GLOBAL (envio automático)
CREATE TABLE public.social_media_report_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evolution_instance_id UUID, -- referência a evolution_instances se existir
  evolution_instance_name TEXT,
  evolution_phone_sender TEXT,
  email_from TEXT,
  email_from_name TEXT,
  email_provider TEXT DEFAULT 'gmail', -- gmail | smtp | lovable
  email_smtp_host TEXT,
  email_smtp_port INTEGER,
  email_smtp_user TEXT,
  email_smtp_pass TEXT,
  auto_send_enabled BOOLEAN NOT NULL DEFAULT false,
  send_hour INTEGER NOT NULL DEFAULT 9 CHECK (send_hour BETWEEN 0 AND 23),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Linha única
INSERT INTO public.social_media_report_config (id) VALUES (gen_random_uuid());

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.social_media_client_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_media_daily_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_media_posts_collected ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_media_monthly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_media_report_config ENABLE ROW LEVEL SECURITY;

-- Admin tem acesso completo
CREATE POLICY "Admin full access profiles" ON public.social_media_client_profiles
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Admin full access snapshots" ON public.social_media_daily_snapshots
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Admin full access posts" ON public.social_media_posts_collected
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Admin full access reports" ON public.social_media_monthly_reports
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Admin full access config" ON public.social_media_report_config
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Public (anon) pode LER relatório via share_token (link público)
CREATE POLICY "Public read by share_token" ON public.social_media_monthly_reports
  FOR SELECT TO anon USING (true);

-- E ler perfil associado (pra mostrar nome/avatar na página pública)
CREATE POLICY "Public read profile via report" ON public.social_media_client_profiles
  FOR SELECT TO anon USING (true);

-- ============================================================
-- Triggers updated_at
-- ============================================================
CREATE TRIGGER trg_smcp_updated_at
  BEFORE UPDATE ON public.social_media_client_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_smrc_updated_at
  BEFORE UPDATE ON public.social_media_report_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Storage bucket pra PDFs
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('social-media-reports', 'social-media-reports', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Admin upload social reports" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'social-media-reports' AND is_admin());

CREATE POLICY "Admin update social reports" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'social-media-reports' AND is_admin());

CREATE POLICY "Admin delete social reports" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'social-media-reports' AND is_admin());

CREATE POLICY "Public read social reports" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'social-media-reports');

-- ============================================================
-- RPC pra leitura pública de relatório por share_token
-- (retorna dados do relatório + perfil em uma chamada)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_social_media_report_by_token(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report RECORD;
  v_profile RECORD;
  v_result JSONB;
BEGIN
  SELECT * INTO v_report
  FROM public.social_media_monthly_reports
  WHERE share_token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT id, username, display_name, profile_picture_url
  INTO v_profile
  FROM public.social_media_client_profiles
  WHERE id = v_report.profile_id;

  v_result := jsonb_build_object(
    'report', jsonb_build_object(
      'id', v_report.id,
      'month', v_report.month,
      'data', v_report.data,
      'pdf_url', v_report.pdf_url,
      'generated_at', v_report.generated_at
    ),
    'profile', jsonb_build_object(
      'username', v_profile.username,
      'display_name', v_profile.display_name,
      'profile_picture_url', v_profile.profile_picture_url
    )
  );

  RETURN v_result;
END;
$$;
