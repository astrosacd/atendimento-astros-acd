DELETE FROM public.role_permissions
WHERE permission_key IN (
  'view_pipeline_ai',
  'manage_pipeline_ai',
  'view_sales_forecast',
  'manage_sales_forecast'
);

DELETE FROM public.system_permissions
WHERE key IN (
  'view_pipeline_ai',
  'manage_pipeline_ai',
  'view_sales_forecast',
  'manage_sales_forecast'
);