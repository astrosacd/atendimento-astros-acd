-- We don't need to change the schema, just ensure the data exists for the new module.
-- However, it's good practice to ensure the table exists and has RLS.
-- Since it already exists, we just insert the 'agenda' configuration.

INSERT INTO public.baserow_integrations (module, is_enabled, events)
VALUES ('agenda', false, ARRAY['agenda.online', 'agenda.presencial'])
ON CONFLICT (module) DO NOTHING;
