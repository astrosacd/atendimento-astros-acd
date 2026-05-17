
-- ============ CONFIG ============
CREATE TABLE public.ligacoes_ia_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key text NOT NULL UNIQUE,
  config_value text,
  description text,
  is_secret boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ligacoes_ia_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage ligacoes_ia_config"
  ON public.ligacoes_ia_config FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER trg_ligacoes_ia_config_updated
  BEFORE UPDATE ON public.ligacoes_ia_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default keys (empty values - user fills later)
INSERT INTO public.ligacoes_ia_config (config_key, config_value, description, is_secret) VALUES
  ('wavoip_token', '', 'Token da API Wavoip', true),
  ('wavoip_dialer_number', '', 'Número WhatsApp Business que disca (com DDI, ex: 5511999999999)', false),
  ('elevenlabs_default_voice_id', 'pNInz6obpgDQGcFmaJgB', 'Voice ID padrão do ElevenLabs', false),
  ('elevenlabs_model', 'eleven_multilingual_v2', 'Modelo ElevenLabs', false),
  ('voice_stability', '0.5', 'Estabilidade da voz (0-1)', false),
  ('voice_similarity', '0.75', 'Similaridade (0-1)', false),
  ('voice_speed', '1.0', 'Velocidade de fala (0.7-1.2)', false),
  ('call_attempts', '2', 'Tentativas em caso de não atender', false),
  ('retry_interval_minutes', '30', 'Minutos entre tentativas', false);

-- ============ ROTEIROS ============
CREATE TABLE public.ligacoes_ia_roteiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  categoria text NOT NULL DEFAULT 'geral',
  descricao text,
  texto text NOT NULL,
  variaveis text[] NOT NULL DEFAULT '{}',
  voice_id text,
  voice_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ligacoes_ia_roteiros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage roteiros"
  ON public.ligacoes_ia_roteiros FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER trg_ligacoes_ia_roteiros_updated
  BEFORE UPDATE ON public.ligacoes_ia_roteiros
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_roteiros_categoria ON public.ligacoes_ia_roteiros(categoria) WHERE ativo;

-- ============ CACHE DE ÁUDIOS ============
CREATE TABLE public.ligacoes_ia_audios_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_hash text NOT NULL UNIQUE,
  roteiro_id uuid REFERENCES public.ligacoes_ia_roteiros(id) ON DELETE CASCADE,
  texto_final text NOT NULL,
  voice_id text NOT NULL,
  storage_path text NOT NULL,
  duration_seconds numeric,
  size_bytes bigint,
  characters_count int,
  hit_count int NOT NULL DEFAULT 0,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ligacoes_ia_audios_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage audios_cache"
  ON public.ligacoes_ia_audios_cache FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE INDEX idx_audios_cache_roteiro ON public.ligacoes_ia_audios_cache(roteiro_id);

-- ============ HISTÓRICO ============
CREATE TABLE public.ligacoes_ia_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  roteiro_id uuid REFERENCES public.ligacoes_ia_roteiros(id) ON DELETE SET NULL,
  audio_cache_id uuid REFERENCES public.ligacoes_ia_audios_cache(id) ON DELETE SET NULL,
  numero_destino text NOT NULL,
  numero_origem text,
  status text NOT NULL DEFAULT 'pendente',
  wavoip_call_id text,
  attempt_number int NOT NULL DEFAULT 1,
  duration_seconds int,
  cost_cents int,
  started_at timestamptz,
  answered_at timestamptz,
  ended_at timestamptz,
  error_message text,
  raw_payload jsonb,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  triggered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ligacoes_ia_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage historico"
  ON public.ligacoes_ia_historico FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Users view own triggered calls"
  ON public.ligacoes_ia_historico FOR SELECT
  USING (triggered_by = auth.uid());
CREATE TRIGGER trg_ligacoes_ia_historico_updated
  BEFORE UPDATE ON public.ligacoes_ia_historico
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_historico_cliente ON public.ligacoes_ia_historico(cliente_id);
CREATE INDEX idx_historico_status ON public.ligacoes_ia_historico(status);
CREATE INDEX idx_historico_created ON public.ligacoes_ia_historico(created_at DESC);
CREATE INDEX idx_historico_wavoip ON public.ligacoes_ia_historico(wavoip_call_id) WHERE wavoip_call_id IS NOT NULL;

-- ============ STORAGE BUCKET ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('ligacoes-ia-audios', 'ligacoes-ia-audios', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins read audios"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'ligacoes-ia-audios' AND public.is_admin());
CREATE POLICY "Admins write audios"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'ligacoes-ia-audios' AND public.is_admin());
CREATE POLICY "Admins update audios"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'ligacoes-ia-audios' AND public.is_admin());
CREATE POLICY "Admins delete audios"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'ligacoes-ia-audios' AND public.is_admin());
