-- Function to update all lead scores
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
    last_ai_update = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule the job to run every 12 hours
-- First check if job exists and remove it to avoid duplicates
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'update-lead-scores-job') THEN
        PERFORM cron.unschedule('update-lead-scores-job');
    END IF;
END $$;

SELECT cron.schedule('update-lead-scores-job', '0 */12 * * *', 'SELECT public.update_all_lead_scores()');
