-- Create storage bucket for client files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('client-files', 'client-files', false);

-- Create RLS policies for client files bucket
CREATE POLICY "Authenticated users can upload client files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'client-files');

CREATE POLICY "Authenticated users can view client files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'client-files');

CREATE POLICY "Authenticated users can delete client files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'client-files');

-- Create table to track client files
CREATE TABLE public.client_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Enable RLS
ALTER TABLE public.client_files ENABLE ROW LEVEL SECURITY;

-- RLS policies for client_files
CREATE POLICY "Admins can manage client_files"
ON public.client_files FOR ALL
USING (is_admin());

CREATE POLICY "Operadores can manage client_files"
ON public.client_files FOR ALL
USING (is_operador());

CREATE POLICY "Gerentes can manage their own client files"
ON public.client_files FOR ALL
USING (is_gerente() AND EXISTS (
  SELECT 1 FROM public.clientes c 
  WHERE c.id = client_files.cliente_id AND c.created_by = auth.uid()
));