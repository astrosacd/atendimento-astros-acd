-- Expose cron status safely to the app via a SECURITY DEFINER function in public schema
CREATE OR REPLACE FUNCTION public.get_consulta_numeros_reminder_cron_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_job record;
  v_runs jsonb;
  v_net jsonb;
BEGIN
  -- Find the cron job that triggers the reminder
  SELECT jobid, schedule, command, active
    INTO v_job
  FROM cron.job
  WHERE command ILIKE '%execute_consulta_numeros_reminder%'
  ORDER BY jobid DESC
  LIMIT 1;

  IF v_job IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'job', NULL,
      'lastRuns', '[]'::jsonb,
      'lastNetResponses', '[]'::jsonb,
      'nowUtc', now()
    );
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'jobid', jobid,
        'status', status,
        'start_time', start_time,
        'end_time', end_time,
        'return_message', return_message
      )
      ORDER BY start_time DESC
    ),
    '[]'::jsonb
  )
  INTO v_runs
  FROM (
    SELECT jobid, status, start_time, end_time, return_message
    FROM cron.job_run_details
    WHERE jobid = v_job.jobid
    ORDER BY start_time DESC
    LIMIT 10
  ) t;

  -- Show recent net responses (useful for diagnosing timeouts/502s)
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'status_code', status_code,
        'timed_out', timed_out,
        'error_msg', error_msg,
        'created', created
      )
      ORDER BY id DESC
    ),
    '[]'::jsonb
  )
  INTO v_net
  FROM (
    SELECT id, status_code, timed_out, error_msg, created
    FROM net._http_response
    ORDER BY id DESC
    LIMIT 20
  ) n;

  RETURN jsonb_build_object(
    'success', true,
    'job', jsonb_build_object(
      'jobid', v_job.jobid,
      'schedule', v_job.schedule,
      'command', v_job.command,
      'active', v_job.active
    ),
    'lastRuns', v_runs,
    'lastNetResponses', v_net,
    'nowUtc', now()
  );
END;
$$;

-- Lock down: only authenticated users should be able to call it
REVOKE ALL ON FUNCTION public.get_consulta_numeros_reminder_cron_health() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_consulta_numeros_reminder_cron_health() TO authenticated;