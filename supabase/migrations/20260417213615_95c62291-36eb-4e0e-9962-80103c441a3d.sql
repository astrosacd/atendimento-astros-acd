-- 1. Fix Chatwoot API key exposure: restrict SELECT to admins only
DROP POLICY IF EXISTS "Users can view their own chatwoot config" ON public.pipeline_chatwoot_config;

CREATE POLICY "Admins can view chatwoot config"
ON public.pipeline_chatwoot_config
FOR SELECT
TO authenticated
USING (public.is_admin());

-- 2. Fix mutable search_path on remaining functions
CREATE OR REPLACE FUNCTION public.get_pipeline_data_by_token(link_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    link_record RECORD;
    result JSONB;
BEGIN
    SELECT * INTO link_record 
    FROM public.pipeline_temporary_links 
    WHERE token = link_token 
    AND (expires_at IS NULL OR expires_at > now());

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    WITH stages AS (
        SELECT * FROM public.pipeline_stages ORDER BY order_index
    ),
    pipeline AS (
        SELECT 
            cp.*,
            jsonb_build_object(
                'id', c.id,
                'nome', c.nome,
                'produto', c.produto,
                'valor', c.valor,
                'moeda', c.moeda,
                'data_renovacao', c.data_renovacao,
                'email', c.email,
                'numero', c.numero,
                'tags', c.tags
            ) as cliente
        FROM public.client_pipeline cp
        LEFT JOIN public.clientes c ON cp.cliente_id = c.id
    )
    SELECT jsonb_build_object(
        'stages', (SELECT jsonb_agg(stages) FROM stages),
        'clients', (SELECT jsonb_agg(pipeline) FROM pipeline)
    ) INTO result;

    RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_all_lead_scores()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;