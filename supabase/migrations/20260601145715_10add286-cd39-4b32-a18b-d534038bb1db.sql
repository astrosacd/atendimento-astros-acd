-- Ensure RCS category permissions exist (already there but double check)
-- No changes needed if they already exist, but we can add 'Central SMS' permissions to the UI later.

-- Example of adding missing ones if any were needed:
-- INSERT INTO public.system_permissions (key, name, description, category) 
-- VALUES ('manage_sms_gateway', 'Configurar Gateway SMS', 'Configura credenciais de API para SMS', 'Central SMS')
-- ON CONFLICT (key) DO NOTHING;
