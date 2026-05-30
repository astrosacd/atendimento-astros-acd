-- Create table for insurance usage tracking
CREATE TABLE IF NOT EXISTS public.qr_scan_insurance_usage (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    baserow_row_id INTEGER NOT NULL,
    numero TEXT NOT NULL,
    cliente_nome TEXT,
    used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    operador_id UUID REFERENCES auth.users(id),
    observacao TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qr_scan_insurance_usage TO authenticated;
GRANT ALL ON public.qr_scan_insurance_usage TO service_role;

-- RLS
ALTER TABLE public.qr_scan_insurance_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all insurance usage" 
ON public.qr_scan_insurance_usage FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert insurance usage" 
ON public.qr_scan_insurance_usage FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- Index for performance on monthly lookups
CREATE INDEX idx_qr_scan_insurance_usage_row_date ON public.qr_scan_insurance_usage (baserow_row_id, used_at);
