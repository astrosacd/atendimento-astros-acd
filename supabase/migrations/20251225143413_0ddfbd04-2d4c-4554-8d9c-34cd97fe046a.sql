-- Create billing_stripe_config table for Stripe configuration in the Billing module
-- This is completely separate from the Gateway module's Stripe configuration

CREATE TABLE public.billing_stripe_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_secret_key TEXT, -- API key stored in the panel
  stripe_tax_percent NUMERIC(5,2) DEFAULT 2.99, -- Fee percentage for Stripe payments
  stripe_enabled BOOLEAN DEFAULT false, -- Whether Stripe is enabled for USD billing
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.billing_stripe_config ENABLE ROW LEVEL SECURITY;

-- Only admins can view and manage Stripe config
CREATE POLICY "Admins can view billing stripe config" 
ON public.billing_stripe_config 
FOR SELECT 
USING (public.is_admin());

CREATE POLICY "Admins can insert billing stripe config" 
ON public.billing_stripe_config 
FOR INSERT 
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update billing stripe config" 
ON public.billing_stripe_config 
FOR UPDATE 
USING (public.is_admin());

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_billing_stripe_config_updated_at
BEFORE UPDATE ON public.billing_stripe_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default row
INSERT INTO public.billing_stripe_config (stripe_secret_key, stripe_tax_percent, stripe_enabled)
VALUES (NULL, 2.99, false);

-- Add comment for documentation
COMMENT ON TABLE public.billing_stripe_config IS 'Configuration for Stripe payment gateway in the Billing module (separate from Gateway module)';
COMMENT ON COLUMN public.billing_stripe_config.stripe_secret_key IS 'Stripe secret API key configured in the admin panel';
COMMENT ON COLUMN public.billing_stripe_config.stripe_tax_percent IS 'Fee percentage to add to USD payments via Stripe';