DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'update-lead-scores-job') THEN
    PERFORM cron.unschedule('update-lead-scores-job');
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.update_all_lead_scores();
DROP TABLE IF EXISTS public.pipeline_ai_config;
DROP TABLE IF EXISTS public.sales_forecasts;

ALTER TABLE public.client_pipeline
  DROP COLUMN IF EXISTS lead_score,
  DROP COLUMN IF EXISTS lead_score_reason,
  DROP COLUMN IF EXISTS next_action_suggestion,
  DROP COLUMN IF EXISTS last_ai_update;