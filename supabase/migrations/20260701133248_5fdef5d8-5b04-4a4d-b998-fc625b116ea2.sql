
CREATE OR REPLACE FUNCTION public.get_horario_cleanup_last_run()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'last_run_at', last_run_at,
    'last_run_deleted', last_run_deleted
  )
  FROM public.horario_cleanup_config
  WHERE id = 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_horario_cleanup_last_run() TO authenticated;
