-- Add manual PIX approval fields to gateway_orders
ALTER TABLE public.gateway_orders 
ADD COLUMN IF NOT EXISTS proof_url TEXT,
ADD COLUMN IF NOT EXISTS pix_transaction_id TEXT,
ADD COLUMN IF NOT EXISTS ocr_amount NUMERIC,
ADD COLUMN IF NOT EXISTS ocr_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Add index for status and pix_transaction_id
CREATE INDEX IF NOT EXISTS idx_gateway_orders_pix_tid ON public.gateway_orders(pix_transaction_id);
CREATE INDEX IF NOT EXISTS idx_gateway_orders_status ON public.gateway_orders(status);

-- Create a storage bucket for receipts if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for receipts
CREATE POLICY "Receipts are publicly accessible" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'receipts');

CREATE POLICY "Anyone can upload receipts" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'receipts');

-- Approval History Table (Optional but good for tracking)
CREATE TABLE IF NOT EXISTS public.gateway_order_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.gateway_orders(id) ON DELETE CASCADE NOT NULL,
    approved_by UUID REFERENCES public.profiles(id) NOT NULL,
    previous_status TEXT,
    new_status TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.gateway_order_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can view approval history" 
ON public.gateway_order_approvals FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'manager', 'financeiro')
    )
);

CREATE POLICY "Admins and managers can insert approval history" 
ON public.gateway_order_approvals FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'manager', 'financeiro')
    )
);