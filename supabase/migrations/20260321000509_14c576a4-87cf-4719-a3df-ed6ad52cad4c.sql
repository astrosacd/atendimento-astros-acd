
-- Lead Hunter Module Tables

-- Main leads table
CREATE TABLE public.lead_hunter_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT,
  telefone TEXT NOT NULL,
  email TEXT,
  empresa TEXT,
  website TEXT,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  categoria TEXT,
  avaliacao NUMERIC,
  fonte TEXT DEFAULT 'manual',
  dados_extras JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'novo' CHECK (status IN ('novo', 'enviado', 'erro', 'respondeu', 'bloqueado')),
  erro_mensagem TEXT,
  enviado_at TIMESTAMPTZ,
  enviado_por_instancia TEXT,
  campanha_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Campaigns table
CREATE TABLE public.lead_hunter_campanhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  status TEXT DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'ativa', 'pausada', 'concluida')),
  tipo_mensagem TEXT DEFAULT 'personalizada' CHECK (tipo_mensagem IN ('personalizada', 'modelo_unico')),
  mensagem_modelo TEXT,
  prompt_ia TEXT,
  provedor_ia TEXT DEFAULT 'lovable' CHECK (provedor_ia IN ('lovable', 'openai', 'groq')),
  modelo_ia TEXT,
  total_leads INTEGER DEFAULT 0,
  total_enviados INTEGER DEFAULT 0,
  total_erros INTEGER DEFAULT 0,
  total_respondidos INTEGER DEFAULT 0,
  delay_entre_mensagens INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Add foreign key for campanha_id
ALTER TABLE public.lead_hunter_leads 
  ADD CONSTRAINT lead_hunter_leads_campanha_id_fkey 
  FOREIGN KEY (campanha_id) REFERENCES public.lead_hunter_campanhas(id) ON DELETE SET NULL;

-- Configuration table for APIs (SERP, Evolution, AI keys)
CREATE TABLE public.lead_hunter_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT NOT NULL UNIQUE,
  config_value TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- WhatsApp instances for this module (independent)
CREATE TABLE public.lead_hunter_whatsapp_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_name TEXT NOT NULL,
  api_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Baserow integration config
CREATE TABLE public.lead_hunter_baserow_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_url TEXT DEFAULT 'https://api.baserow.io',
  api_token TEXT DEFAULT '',
  table_id TEXT DEFAULT '',
  is_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Dispatch logs
CREATE TABLE public.lead_hunter_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.lead_hunter_leads(id) ON DELETE CASCADE,
  campanha_id UUID REFERENCES public.lead_hunter_campanhas(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL,
  mensagem TEXT,
  resultado TEXT,
  detalhes JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- SERP search history
CREATE TABLE public.lead_hunter_buscas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,
  localizacao TEXT,
  total_resultados INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'processando', 'concluida', 'erro')),
  erro_mensagem TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS on all tables
ALTER TABLE public.lead_hunter_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_hunter_campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_hunter_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_hunter_whatsapp_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_hunter_baserow_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_hunter_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_hunter_buscas ENABLE ROW LEVEL SECURITY;

-- RLS policies - authenticated users can read/write
CREATE POLICY "Authenticated users can manage leads" ON public.lead_hunter_leads FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage campanhas" ON public.lead_hunter_campanhas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage config" ON public.lead_hunter_config FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage whatsapp instances" ON public.lead_hunter_whatsapp_instances FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage baserow config" ON public.lead_hunter_baserow_config FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can read logs" ON public.lead_hunter_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage buscas" ON public.lead_hunter_buscas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Unique constraint on phone to prevent duplicate dispatches
CREATE UNIQUE INDEX lead_hunter_leads_telefone_unique ON public.lead_hunter_leads(telefone);

-- Triggers for updated_at
CREATE TRIGGER update_lead_hunter_leads_updated_at BEFORE UPDATE ON public.lead_hunter_leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_lead_hunter_campanhas_updated_at BEFORE UPDATE ON public.lead_hunter_campanhas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_lead_hunter_config_updated_at BEFORE UPDATE ON public.lead_hunter_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_lead_hunter_whatsapp_instances_updated_at BEFORE UPDATE ON public.lead_hunter_whatsapp_instances FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_lead_hunter_baserow_config_updated_at BEFORE UPDATE ON public.lead_hunter_baserow_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
