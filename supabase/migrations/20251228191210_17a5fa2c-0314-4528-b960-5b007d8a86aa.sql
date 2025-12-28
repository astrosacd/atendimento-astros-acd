
-- Tabela de planos revendedor
CREATE TABLE public.planos_revendedor (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  valor NUMERIC NOT NULL DEFAULT 0,
  descricao TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de ferramentas por plano
CREATE TABLE public.plano_ferramentas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plano_id UUID NOT NULL REFERENCES public.planos_revendedor(id) ON DELETE CASCADE,
  ferramenta TEXT NOT NULL,
  quantidade_licencas INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(plano_id, ferramenta)
);

-- Tabela de licenças entregues
CREATE TABLE public.licencas_entregues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  ferramenta TEXT NOT NULL,
  codigo_licenca TEXT NOT NULL,
  data_entrega TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  origem TEXT NOT NULL DEFAULT 'manual',
  observacao TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.planos_revendedor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plano_ferramentas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licencas_entregues ENABLE ROW LEVEL SECURITY;

-- Policies para planos_revendedor
CREATE POLICY "Admins can manage planos_revendedor" 
ON public.planos_revendedor FOR ALL 
USING (is_admin());

CREATE POLICY "Authenticated can view planos_revendedor" 
ON public.planos_revendedor FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Policies para plano_ferramentas
CREATE POLICY "Admins can manage plano_ferramentas" 
ON public.plano_ferramentas FOR ALL 
USING (is_admin());

CREATE POLICY "Authenticated can view plano_ferramentas" 
ON public.plano_ferramentas FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Policies para licencas_entregues
CREATE POLICY "Admins can manage licencas_entregues" 
ON public.licencas_entregues FOR ALL 
USING (is_admin());

CREATE POLICY "Operadores can manage licencas_entregues" 
ON public.licencas_entregues FOR ALL 
USING (is_operador());

CREATE POLICY "Gerentes can manage their client licencas" 
ON public.licencas_entregues FOR ALL 
USING (is_gerente() AND EXISTS (
  SELECT 1 FROM clientes c WHERE c.id = licencas_entregues.cliente_id AND c.created_by = auth.uid()
));

CREATE POLICY "Service can insert licencas_entregues" 
ON public.licencas_entregues FOR INSERT 
WITH CHECK (true);

-- Triggers para updated_at
CREATE TRIGGER update_planos_revendedor_updated_at
BEFORE UPDATE ON public.planos_revendedor
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_plano_ferramentas_updated_at
BEFORE UPDATE ON public.plano_ferramentas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir dados iniciais dos planos
INSERT INTO public.planos_revendedor (nome, valor, descricao) VALUES
('Plano Starter', 147.90, 'Plano inicial com 5 licenças por ferramenta'),
('Plano Pro', 177.90, 'Plano intermediário com 10 licenças por ferramenta'),
('Plano Agência', 299.90, 'Plano completo com 20 licenças por ferramenta');

-- Inserir ferramentas do Plano Starter (5 licenças)
INSERT INTO public.plano_ferramentas (plano_id, ferramenta, quantidade_licencas)
SELECT id, ferramenta, 5
FROM public.planos_revendedor, 
LATERAL (VALUES ('WA Marketing'), ('ZapChat'), ('MultSender'), ('PushZap'), ('OLX Extractor'), ('Turbo Filter'), ('Prospector')) AS t(ferramenta)
WHERE nome = 'Plano Starter';

-- Inserir ferramentas do Plano Pro (10 licenças)
INSERT INTO public.plano_ferramentas (plano_id, ferramenta, quantidade_licencas)
SELECT id, ferramenta, 10
FROM public.planos_revendedor, 
LATERAL (VALUES ('WA Marketing'), ('ZapChat'), ('MultSender'), ('PushZap'), ('OLX Extractor'), ('Turbo Filter'), ('Prospector'), ('SMS RCS'), ('CRMZap')) AS t(ferramenta)
WHERE nome = 'Plano Pro';

-- Inserir ferramentas do Plano Agência (20 licenças)
INSERT INTO public.plano_ferramentas (plano_id, ferramenta, quantidade_licencas)
SELECT id, ferramenta, 20
FROM public.planos_revendedor, 
LATERAL (VALUES ('WA Marketing'), ('ZapChat'), ('MultSender'), ('PushZap'), ('OLX Extractor'), ('Turbo Filter'), ('Prospector'), ('SMS RCS'), ('CRMZap'), ('ZapDefender'), ('WA Group'), ('ChatPulse')) AS t(ferramenta)
WHERE nome = 'Plano Agência';
