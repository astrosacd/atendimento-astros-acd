-- =========================================
-- INSTAGRAM ESPIONAGE MODULE
-- =========================================

-- 1) Perfis monitorados
CREATE TABLE public.instagram_competitors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  ig_business_id TEXT,
  display_name TEXT,
  profile_picture_url TEXT,
  followers_count INTEGER,
  category TEXT NOT NULL DEFAULT 'concorrente_direto',
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  last_sync_status TEXT,
  last_sync_error TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ig_competitors_active ON public.instagram_competitors(is_active);
CREATE INDEX idx_ig_competitors_username ON public.instagram_competitors(LOWER(username));

ALTER TABLE public.instagram_competitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage competitors"
ON public.instagram_competitors
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE TRIGGER trg_ig_competitors_updated
BEFORE UPDATE ON public.instagram_competitors
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 2) Posts coletados
CREATE TABLE public.instagram_competitor_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  competitor_id UUID NOT NULL REFERENCES public.instagram_competitors(id) ON DELETE CASCADE,
  ig_media_id TEXT NOT NULL,
  media_type TEXT NOT NULL,
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
  UNIQUE (competitor_id, ig_media_id)
);

CREATE INDEX idx_ig_posts_competitor ON public.instagram_competitor_posts(competitor_id);
CREATE INDEX idx_ig_posts_posted_at ON public.instagram_competitor_posts(posted_at DESC);
CREATE INDEX idx_ig_posts_likes ON public.instagram_competitor_posts(like_count DESC);

ALTER TABLE public.instagram_competitor_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage competitor posts"
ON public.instagram_competitor_posts
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- 3) Analises geradas pela IA
CREATE TABLE public.instagram_competitor_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  competitor_id UUID REFERENCES public.instagram_competitors(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL CHECK (analysis_type IN ('insights', 'sugestoes')),
  period_days INTEGER NOT NULL DEFAULT 30,
  content JSONB NOT NULL,
  posts_analyzed_count INTEGER NOT NULL DEFAULT 0,
  model_used TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ig_analyses_competitor ON public.instagram_competitor_analyses(competitor_id);
CREATE INDEX idx_ig_analyses_created ON public.instagram_competitor_analyses(created_at DESC);
CREATE INDEX idx_ig_analyses_type ON public.instagram_competitor_analyses(analysis_type);

ALTER TABLE public.instagram_competitor_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage competitor analyses"
ON public.instagram_competitor_analyses
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- 4) Configuracao global do modulo
CREATE TABLE public.instagram_espionage_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auto_sync_enabled BOOLEAN NOT NULL DEFAULT false,
  sync_frequency TEXT NOT NULL DEFAULT 'manual' CHECK (sync_frequency IN ('daily', '3days', 'weekly', 'manual')),
  auto_analysis_enabled BOOLEAN NOT NULL DEFAULT false,
  default_analysis_type TEXT NOT NULL DEFAULT 'insights' CHECK (default_analysis_type IN ('insights', 'sugestoes')),
  default_analysis_period_days INTEGER NOT NULL DEFAULT 30,
  max_competitors INTEGER NOT NULL DEFAULT 25,
  last_auto_run_at TIMESTAMPTZ,
  last_auto_run_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.instagram_espionage_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage espionage config"
ON public.instagram_espionage_config
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE TRIGGER trg_ig_espionage_config_updated
BEFORE UPDATE ON public.instagram_espionage_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed da config global (linha unica)
INSERT INTO public.instagram_espionage_config (auto_sync_enabled, sync_frequency)
VALUES (false, 'manual');


-- 5) Funcao auxiliar de cron (sera usada depois pelo pg_cron)
CREATE OR REPLACE FUNCTION public.execute_instagram_spy_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://udxaxemoozddkwpitngq.supabase.co/functions/v1/instagram-spy-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkeGF4ZW1vb3pkZGt3cGl0bmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NjQ1MTQsImV4cCI6MjA4MTA0MDUxNH0.d8F3I7PofiAkTm0qKpu3k1pTGqSFpHPmsl0nMdghvYM'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
END;
$$;


-- 6) Funcao para atualizar o schedule do cron
CREATE OR REPLACE FUNCTION public.update_instagram_spy_cron(p_frequency TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_schedule TEXT;
BEGIN
  BEGIN
    PERFORM cron.unschedule('instagram-spy-cron');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  IF p_frequency = 'manual' THEN
    RETURN true;
  END IF;

  -- Sempre roda 11:00 UTC (08:00 Brasilia)
  IF p_frequency = 'daily' THEN
    v_schedule := '0 11 * * *';
  ELSIF p_frequency = '3days' THEN
    v_schedule := '0 11 */3 * *';
  ELSIF p_frequency = 'weekly' THEN
    v_schedule := '0 11 * * 1';
  ELSE
    RAISE EXCEPTION 'Frequencia invalida: %', p_frequency;
  END IF;

  PERFORM cron.schedule(
    'instagram-spy-cron',
    v_schedule,
    'SELECT public.execute_instagram_spy_cron();'
  );

  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Erro: %', SQLERRM;
  RETURN false;
END;
$$;


-- 7) Funcao para consultar schedule atual
CREATE OR REPLACE FUNCTION public.get_instagram_spy_cron_schedule()
RETURNS TABLE(schedule TEXT, job_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT c.schedule::text, c.jobname::text
  FROM cron.job c
  WHERE c.jobname = 'instagram-spy-cron'
  LIMIT 1;
END;
$$;