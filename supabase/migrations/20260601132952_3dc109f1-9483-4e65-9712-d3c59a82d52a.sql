-- Create RCS Templates table
CREATE TABLE public.rcs_templates (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL,
    conteudo TEXT NOT NULL,
    botoes JSONB DEFAULT '[]'::jsonb, -- Array of {label, url/phone}
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    user_id UUID REFERENCES auth.users(id)
);

-- Add template_id to rcs_messages to track which template was used
ALTER TABLE public.rcs_messages ADD COLUMN template_id UUID REFERENCES public.rcs_templates(id);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rcs_templates TO authenticated;
GRANT ALL ON public.rcs_templates TO service_role;

-- Enable RLS
ALTER TABLE public.rcs_templates ENABLE ROW LEVEL SECURITY;

-- Policies for rcs_templates
CREATE POLICY "Users can manage their own rcs_templates"
ON public.rcs_templates
FOR ALL
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_rcs_templates_updated_at
BEFORE UPDATE ON public.rcs_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
