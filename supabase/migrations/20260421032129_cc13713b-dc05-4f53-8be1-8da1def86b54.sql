-- Initialize approval configuration in gateway_settings
INSERT INTO public.gateway_settings (key, value)
VALUES ('approval_config', '{
  "workflow": "admin_only",
  "ocr_enabled": true,
  "whatsapp_notifications": true,
  "duplicate_id_check": true,
  "required_proof": true
}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Add approval_flow_step to gateway_orders to track multi-step approvals if needed
ALTER TABLE public.gateway_orders 
ADD COLUMN IF NOT EXISTS approval_flow_step TEXT DEFAULT 'pending';

-- Update RLS policies for gateway_orders to include manager and finance roles
-- First, let's create a function to check if a user has a specific role from custom_roles
CREATE OR REPLACE FUNCTION public.has_custom_role(user_uuid UUID, role_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.custom_roles cr ON ur.role = cr.name
    WHERE ur.user_id = user_uuid AND cr.name = role_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the main RLS policy for gateway_orders
-- We need to check the current configuration in gateway_settings
CREATE OR REPLACE FUNCTION public.can_approve_order(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  workflow_config TEXT;
BEGIN
  -- Get the current workflow configuration
  SELECT (value->>'workflow') INTO workflow_config 
  FROM public.gateway_settings 
  WHERE key = 'approval_config';
  
  -- If not configured, default to admin only
  IF workflow_config IS NULL THEN
    workflow_config := 'admin_only';
  END IF;

  -- Admin always has access
  IF has_custom_role(user_uuid, 'admin') THEN
    RETURN TRUE;
  END IF;

  -- Manager access
  IF (workflow_config = 'admin_manager' OR workflow_config = 'admin_manager_finance') 
     AND has_custom_role(user_uuid, 'gerente') THEN
    RETURN TRUE;
  END IF;

  -- Finance access
  IF workflow_config = 'admin_manager_finance' 
     AND has_custom_role(user_uuid, 'financeiro') THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply the new policy
DROP POLICY IF EXISTS "Managers and Finance can update orders for approval" ON public.gateway_orders;
CREATE POLICY "Managers and Finance can update orders for approval" 
ON public.gateway_orders 
FOR UPDATE 
USING (can_approve_order(auth.uid()));

-- Add a trigger to prevent duplicate pix_transaction_id if enabled
CREATE OR REPLACE FUNCTION public.check_duplicate_pix_transaction()
RETURNS TRIGGER AS $$
DECLARE
  duplicate_check_enabled BOOLEAN;
BEGIN
  -- Check if duplicate check is enabled in settings
  SELECT (value->>'duplicate_id_check')::BOOLEAN INTO duplicate_check_enabled
  FROM public.gateway_settings
  WHERE key = 'approval_config';

  IF duplicate_check_enabled AND NEW.pix_transaction_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.gateway_orders 
      WHERE pix_transaction_id = NEW.pix_transaction_id 
      AND id != NEW.id
      AND status != 'rejected'
    ) THEN
      RAISE EXCEPTION 'ID de transação PIX já existe no sistema: %', NEW.pix_transaction_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_duplicate_pix_transaction
BEFORE INSERT OR UPDATE OF pix_transaction_id ON public.gateway_orders
FOR EACH ROW
EXECUTE FUNCTION public.check_duplicate_pix_transaction();