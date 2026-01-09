-- Tabela para guardar o tipo de número (EX = Externo, IN = Interno)
-- Detectado apenas na primeira consulta e nunca mais alterado
CREATE TABLE public.consulta_numeros_tipo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  baserow_row_id TEXT NOT NULL UNIQUE,
  tipo TEXT NOT NULL CHECK (tipo IN ('EX', 'IN')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.consulta_numeros_tipo ENABLE ROW LEVEL SECURITY;

-- Política: usuários autenticados podem ver todos
CREATE POLICY "Usuarios autenticados podem ver tipos" 
ON public.consulta_numeros_tipo 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Política: usuários autenticados podem inserir
CREATE POLICY "Usuarios autenticados podem inserir tipos" 
ON public.consulta_numeros_tipo 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Índice para busca rápida
CREATE INDEX idx_consulta_numeros_tipo_baserow_row_id ON public.consulta_numeros_tipo(baserow_row_id);