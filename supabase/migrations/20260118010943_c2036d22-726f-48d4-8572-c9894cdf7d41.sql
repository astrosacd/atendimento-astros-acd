-- Create table to store proposal branding/configuration
CREATE TABLE public.proposal_branding (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  logo_url TEXT,
  company_name TEXT,
  primary_color TEXT DEFAULT '#3B82F6',
  secondary_color TEXT DEFAULT '#1E40AF',
  accent_color TEXT DEFAULT '#F59E0B',
  font_family TEXT DEFAULT 'Inter',
  show_logo_on_cover BOOLEAN DEFAULT true,
  show_logo_on_pages BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.proposal_branding ENABLE ROW LEVEL SECURITY;

-- Create policies - allow all authenticated users to manage branding
CREATE POLICY "Authenticated users can view branding" 
ON public.proposal_branding 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert branding" 
ON public.proposal_branding 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update branding" 
ON public.proposal_branding 
FOR UPDATE 
TO authenticated
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_proposal_branding_updated_at
BEFORE UPDATE ON public.proposal_branding
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();