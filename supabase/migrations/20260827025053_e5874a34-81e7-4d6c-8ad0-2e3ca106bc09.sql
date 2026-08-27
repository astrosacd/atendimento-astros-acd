REVOKE ALL ON FUNCTION public.execute_minute_automations_dispatcher() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.execute_minute_automations_dispatcher() FROM anon;
REVOKE ALL ON FUNCTION public.execute_minute_automations_dispatcher() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.execute_minute_automations_dispatcher() TO service_role;