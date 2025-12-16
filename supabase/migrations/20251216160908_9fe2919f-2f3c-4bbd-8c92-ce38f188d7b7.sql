-- Tabela para múltiplas instâncias WhatsApp do Divulgador
CREATE TABLE IF NOT EXISTS public.divulgador_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_name TEXT NOT NULL,
  api_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  is_connected BOOLEAN DEFAULT false,
  last_connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Adicionar campo de última atividade aos participantes
ALTER TABLE public.divulgador_participants 
ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_inactive BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS message_count INTEGER DEFAULT 0;

-- Vincular campanhas a instâncias específicas
ALTER TABLE public.divulgador_campaigns 
ADD COLUMN IF NOT EXISTS instance_id UUID REFERENCES public.divulgador_instances(id);

-- RLS para divulgador_instances
ALTER TABLE public.divulgador_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage divulgador_instances"
ON public.divulgador_instances FOR ALL
USING (public.is_admin());

-- Trigger para atualizar updated_at
CREATE OR REPLACE TRIGGER update_divulgador_instances_updated_at
BEFORE UPDATE ON public.divulgador_instances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();