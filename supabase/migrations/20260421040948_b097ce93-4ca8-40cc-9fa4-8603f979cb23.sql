-- Add Manual PIX settings
INSERT INTO public.gateway_settings (key, value)
VALUES ('pix_manual', '{
  "enabled": true,
  "pix_key": "sua-chave-pix-aqui",
  "receiver_name": "Seu Nome ou Empresa",
  "instructions": "Faça o PIX para a chave acima e anexe o comprovante abaixo para processamento automático.",
  "qr_code_url": null
}')
ON CONFLICT (key) DO NOTHING;

-- Update approval_config to ensure all fields are present
UPDATE public.gateway_settings
SET value = jsonb_set(
  jsonb_set(
    value, 
    '{workflow}', 
    '"admin_only"'
  ),
  '{ocr_enabled}',
  'true'
)
WHERE key = 'approval_config';
