-- 1. Cron jobs
DO $$
DECLARE v_job text;
BEGIN
  FOREACH v_job IN ARRAY ARRAY['process-automations-cron','chatwoot-sync-job','chatwoot-sync-cron','process-automations'] LOOP
    BEGIN PERFORM cron.unschedule(v_job); EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END; $$;

-- 2. Funções
DROP FUNCTION IF EXISTS public.execute_process_automations() CASCADE;
DROP FUNCTION IF EXISTS public.get_pipeline_data_by_token(text) CASCADE;
-- 3. Permissões
DELETE FROM public.role_permissions
WHERE permission_key IN (
  'view_pipeline','manage_pipeline_stages','manage_pipeline_automations',
  'manage_pipeline_chatwoot','share_pipeline','view_automation_logs','view_guia_pipeline'
);
DELETE FROM public.system_permissions
WHERE key IN (
  'view_pipeline','manage_pipeline_stages','manage_pipeline_automations',
  'manage_pipeline_chatwoot','share_pipeline','view_automation_logs','view_guia_pipeline'
);

-- 4. Tabelas
DROP TABLE IF EXISTS public.automation_logs CASCADE;
DROP TABLE IF EXISTS public.automation_rules CASCADE;
DROP TABLE IF EXISTS public.pipeline_temporary_links CASCADE;
DROP TABLE IF EXISTS public.pipeline_chatwoot_config CASCADE;
DROP TABLE IF EXISTS public.client_pipeline CASCADE;
DROP TABLE IF EXISTS public.pipeline_stages CASCADE;