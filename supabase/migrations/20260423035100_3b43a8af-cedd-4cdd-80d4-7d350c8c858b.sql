-- Create table for AI upsell/cross-sell suggestions
CREATE TABLE public.client_ai_upsell_suggestions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    suggestions JSONB NOT NULL, -- Array of suggestion objects: { product_id, reason, type (upsell/cross-sell), confidence }
    status TEXT NOT NULL DEFAULT 'pending', -- pending, viewed, accepted, rejected
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    last_analysis_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_ai_upsell_suggestions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view suggestions" 
ON public.client_ai_upsell_suggestions 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert/update suggestions" 
ON public.client_ai_upsell_suggestions 
FOR ALL 
USING (auth.role() = 'authenticated');

-- Create trigger for updated_at
CREATE TRIGGER update_client_ai_upsell_suggestions_updated_at
BEFORE UPDATE ON public.client_ai_upsell_suggestions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for performance
CREATE INDEX idx_client_ai_upsell_suggestions_cliente_id ON public.client_ai_upsell_suggestions(cliente_id);
