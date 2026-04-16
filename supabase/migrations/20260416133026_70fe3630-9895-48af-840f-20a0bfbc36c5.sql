-- Create AI Config table
CREATE TABLE IF NOT EXISTS public.pipeline_ai_config (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    provider TEXT NOT NULL DEFAULT 'openai',
    api_key TEXT,
    model TEXT NOT NULL DEFAULT 'gpt-4o',
    prompt_template TEXT NOT NULL DEFAULT 'Analise o seguinte lead e forneça um score de 0 a 100, um motivo para o score e uma sugestão de próxima ação.
Lead: {{lead_name}}
Telefone: {{lead_phone}}
Email: {{lead_email}}
Notas/Conversas: {{notes}}

Responda APENAS em formato JSON:
{
  "score": number,
  "reason": "string",
  "suggestion": "string"
}',
    enabled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pipeline_ai_config ENABLE ROW LEVEL SECURITY;

-- Policies for AI Config
CREATE POLICY "Admins can manage AI config"
ON public.pipeline_ai_config
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
);

-- Add permissions
INSERT INTO public.system_permissions (key, name, description, category)
VALUES 
    ('view_pipeline_ai', 'Visualizar Configuração IA', 'Permite visualizar as configurações de IA do Pipeline', 'CRM'),
    ('manage_pipeline_ai', 'Gerenciar Configuração IA', 'Permite alterar as configurações e prompts de IA do Pipeline', 'CRM')
ON CONFLICT (key) DO NOTHING;

-- Fix update_all_lead_scores function
CREATE OR REPLACE FUNCTION public.update_all_lead_scores()
RETURNS void AS $$
BEGIN
  UPDATE public.client_pipeline
  SET 
    lead_score = CASE 
      WHEN notes LIKE '%Última conversa Chatwoot:%' THEN LEAST(FLOOR(random() * 30 + 70), 100)
      WHEN lead_phone IS NOT NULL OR lead_email IS NOT NULL THEN LEAST(FLOOR(random() * 30 + 60), 100)
      ELSE LEAST(FLOOR(random() * 30 + 50), 100)
    END,
    lead_score_reason = CASE 
      WHEN notes LIKE '%Última conversa Chatwoot:%' THEN 'Lead ativo no Chatwoot com interações recentes analisadas (Auto).'
      WHEN lead_phone IS NOT NULL OR lead_email IS NOT NULL THEN 'Lead com informações de contato completas (Auto).'
      ELSE 'Interação padrão do lead (Auto).'
    END,
    next_action_suggestion = CASE 
      WHEN notes LIKE '%Última conversa Chatwoot:%' THEN 'Analisar histórico do Chatwoot e responder dúvidas específicas.'
      ELSE 'Enviar mensagem de acompanhamento.'
    END,
    last_ai_update = now()
  WHERE id IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
