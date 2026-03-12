INSERT INTO public.baserow_integrations (module, is_enabled, api_url, api_token, table_id, events)
VALUES ('billing', false, '', '', '', ARRAY['billing.d_menos_3', 'billing.d_zero', 'billing.d_mais_1', 'billing.d_mais_2', 'billing.d_mais_15', 'billing.d_mais_30'])
ON CONFLICT DO NOTHING;