-- Create table for consulta_numeros observation tags
CREATE TABLE public.consulta_numeros_obs_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  cor TEXT DEFAULT '#10b981',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.consulta_numeros_obs_tags ENABLE ROW LEVEL SECURITY;

-- Policies - allow all authenticated users to view
CREATE POLICY "Users can view obs tags" 
ON public.consulta_numeros_obs_tags 
FOR SELECT 
TO authenticated
USING (true);

-- Only admins can insert/update/delete
CREATE POLICY "Admins can insert obs tags" 
ON public.consulta_numeros_obs_tags 
FOR INSERT 
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admins can update obs tags" 
ON public.consulta_numeros_obs_tags 
FOR UPDATE 
TO authenticated
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admins can delete obs tags" 
ON public.consulta_numeros_obs_tags 
FOR DELETE 
TO authenticated
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Insert default tag
INSERT INTO public.consulta_numeros_obs_tags (nome, cor) VALUES ('SIM não aprovisionado', '#ef4444');