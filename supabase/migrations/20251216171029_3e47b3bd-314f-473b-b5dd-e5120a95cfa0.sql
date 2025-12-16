-- Backfill divulgador_instances from legacy divulgador_whatsapp_instance
INSERT INTO public.divulgador_instances (
  instance_name,
  api_url,
  api_key,
  is_active,
  is_connected,
  last_connected_at,
  created_at,
  updated_at
)
SELECT
  w.instance_name,
  w.api_url,
  w.api_key,
  true as is_active,
  COALESCE(w.is_connected, false) as is_connected,
  w.last_connected_at,
  COALESCE(w.created_at, now()) as created_at,
  COALESCE(w.updated_at, now()) as updated_at
FROM public.divulgador_whatsapp_instance w
WHERE NOT EXISTS (
  SELECT 1
  FROM public.divulgador_instances i
  WHERE i.instance_name = w.instance_name
);
