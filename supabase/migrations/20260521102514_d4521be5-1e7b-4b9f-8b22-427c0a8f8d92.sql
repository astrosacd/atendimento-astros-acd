
-- 1. Ajustar tabela de configuração: Evolution API com URL + Instance Name + API Key
ALTER TABLE public.social_media_report_config
  ADD COLUMN IF NOT EXISTS evolution_url TEXT,
  ADD COLUMN IF NOT EXISTS evolution_instance_name TEXT,
  ADD COLUMN IF NOT EXISTS evolution_apikey TEXT,
  ADD COLUMN IF NOT EXISTS instagram_oauth_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS instagram_app_id TEXT,
  ADD COLUMN IF NOT EXISTS instagram_app_secret TEXT;

-- 2. Adicionar colunas OAuth no perfil do cliente
ALTER TABLE public.social_media_client_profiles
  ADD COLUMN IF NOT EXISTS oauth_connected BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS oauth_access_token TEXT,
  ADD COLUMN IF NOT EXISTS oauth_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS oauth_ig_business_id TEXT,
  ADD COLUMN IF NOT EXISTS oauth_fb_page_id TEXT,
  ADD COLUMN IF NOT EXISTS oauth_connected_at TIMESTAMPTZ;

-- 3. Templates de mensagem por usuário
CREATE TABLE IF NOT EXISTS public.social_media_message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  name TEXT NOT NULL DEFAULT 'Padrão',
  subject TEXT,
  body TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.social_media_message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem seus próprios templates"
  ON public.social_media_message_templates FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Usuários gerenciam seus próprios templates"
  ON public.social_media_message_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários atualizam seus próprios templates"
  ON public.social_media_message_templates FOR UPDATE
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Usuários deletam seus próprios templates"
  ON public.social_media_message_templates FOR DELETE
  USING (auth.uid() = user_id OR public.is_admin());

CREATE TRIGGER trg_social_templates_updated_at
  BEFORE UPDATE ON public.social_media_message_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_social_templates_user ON public.social_media_message_templates(user_id, channel);
