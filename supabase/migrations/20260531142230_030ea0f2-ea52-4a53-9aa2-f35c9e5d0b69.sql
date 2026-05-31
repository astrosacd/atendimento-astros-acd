-- Create sms_history table
CREATE TABLE public.sms_history (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    cliente_id UUID REFERENCES public.clientes(id),
    numero_destino TEXT NOT NULL,
    conteudo TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente',
    provider_message_id TEXT,
    error_message TEXT,
    source TEXT DEFAULT 'manual',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Create sms_templates table
CREATE TABLE public.sms_templates (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL,
    conteudo TEXT NOT NULL,
    categoria TEXT DEFAULT 'geral',
    ativo BOOLEAN DEFAULT true,
    variaveis TEXT[],
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_history TO authenticated;
GRANT ALL ON public.sms_history TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_templates TO authenticated;
GRANT ALL ON public.sms_templates TO service_role;

-- Enable RLS
ALTER TABLE public.sms_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;

-- Policies for sms_history
CREATE POLICY "Users can view their own sms history" 
ON public.sms_history FOR SELECT 
USING (auth.uid() = created_by);

CREATE POLICY "Users can insert their own sms history" 
ON public.sms_history FOR INSERT 
WITH CHECK (auth.uid() = created_by);

-- Policies for sms_templates
CREATE POLICY "Users can view their own sms templates" 
ON public.sms_templates FOR SELECT 
USING (auth.uid() = created_by);

CREATE POLICY "Users can insert their own sms templates" 
ON public.sms_templates FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own sms templates" 
ON public.sms_templates FOR UPDATE 
USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own sms templates" 
ON public.sms_templates FOR DELETE 
USING (auth.uid() = created_by);

-- Trigger for updated_at
CREATE TRIGGER update_sms_history_updated_at BEFORE UPDATE ON public.sms_history FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sms_templates_updated_at BEFORE UPDATE ON public.sms_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
