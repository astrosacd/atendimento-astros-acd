-- Tabela de aparelhos físicos
CREATE TABLE public.numeros_aquecimento_aparelhos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  apelido TEXT NOT NULL,
  modelo_id UUID REFERENCES public.numeros_aquecimento_modelos(id) ON DELETE SET NULL,
  capacidade_total INTEGER NOT NULL DEFAULT 1 CHECK (capacidade_total >= 1 AND capacidade_total <= 20),
  observacoes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.numeros_aquecimento_aparelhos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view aparelhos"
ON public.numeros_aquecimento_aparelhos FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Authenticated users can create aparelhos"
ON public.numeros_aquecimento_aparelhos FOR INSERT
TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update aparelhos"
ON public.numeros_aquecimento_aparelhos FOR UPDATE
TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete aparelhos"
ON public.numeros_aquecimento_aparelhos FOR DELETE
TO authenticated USING (true);

CREATE TRIGGER update_aparelhos_updated_at
BEFORE UPDATE ON public.numeros_aquecimento_aparelhos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar campos em numeros_aquecimento
ALTER TABLE public.numeros_aquecimento
ADD COLUMN aparelho_id UUID REFERENCES public.numeros_aquecimento_aparelhos(id) ON DELETE SET NULL,
ADD COLUMN tipo_whatsapp TEXT CHECK (tipo_whatsapp IN ('normal', 'business'));

CREATE INDEX idx_numeros_aquecimento_aparelho_id ON public.numeros_aquecimento(aparelho_id);