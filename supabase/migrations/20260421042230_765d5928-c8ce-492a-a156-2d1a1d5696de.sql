-- Adiciona a nova permissão
INSERT INTO public.system_permissions (key, name, description, category) 
VALUES ('view_payment_security', 'Segurança de Pagamento', 'Permite visualizar e gerenciar o módulo de Segurança de Pagamento (PixPague)', 'Financeiro')
ON CONFLICT (key) DO NOTHING;

-- Associa a permissão aos administradores
INSERT INTO public.role_permissions (role_name, permission_key)
VALUES ('admin', 'view_payment_security')
ON CONFLICT DO NOTHING;

-- Adiciona índice para busca rápida de duplicados se não existir
CREATE INDEX IF NOT EXISTS idx_client_payments_pix_tx_id 
ON public.client_payments(pix_transaction_id) 
WHERE pix_transaction_id IS NOT NULL;

-- Garante que a configuração do PixPague existe
INSERT INTO public.billing_config (config_key, config_value)
VALUES ('pixpague_config', '{"ocr_enabled":true,"duplicate_check":true,"whatsapp_notifications":false,"approver_phones":"","ai_provider":"gemini"}')
ON CONFLICT (config_key) DO NOTHING;
