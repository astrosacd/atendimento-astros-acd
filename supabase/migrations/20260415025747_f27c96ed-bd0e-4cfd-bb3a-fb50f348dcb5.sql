
-- Add payment tracking columns to payment_links
ALTER TABLE public.payment_links
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS mp_payment_id text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- Fix the finalize_whatsapp_groups category from 'Clientes' to 'clientes'
UPDATE public.system_permissions
SET category = 'clientes'
WHERE key = 'finalize_whatsapp_groups' AND category = 'Clientes';

-- Add new permissions for payment link status checking
INSERT INTO public.system_permissions (key, name, description, category) VALUES
  ('check_payment_link_status', 'Consultar Status de Pagamento', 'Permite consultar o status de pagamento dos links gerados', 'Link de Pagamento'),
  ('manage_payment_link_webhook', 'Gerenciar Webhook de Pagamento', 'Permite configurar e visualizar webhook de notificações de pagamento', 'Link de Pagamento')
ON CONFLICT (key) DO NOTHING;
