DROP TABLE IF EXISTS public.integration_status CASCADE;
DROP TABLE IF EXISTS public.api_quotas CASCADE;
DELETE FROM public.role_permissions WHERE permission_key = 'manage_system_health';
DELETE FROM public.system_permissions WHERE key = 'manage_system_health';