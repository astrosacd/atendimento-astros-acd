-- Tabela para armazenar produtos predefinidos
CREATE TABLE public.predefined_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.predefined_products ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Leitura pública para produtos predefinidos" 
ON public.predefined_products FOR SELECT TO authenticated USING (true);

CREATE POLICY "Acesso total para administradores em produtos" 
ON public.predefined_products FOR ALL TO authenticated USING (true);

-- Inserir alguns produtos de exemplo (baseado no contexto do usuário)
INSERT INTO public.predefined_products (name, description) VALUES
('Disparador Start', 'Plano básico de disparador em nuvem'),
('Disparador Pro', 'Plano profissional de disparador em nuvem'),
('Disparador Enterprise', 'Plano corporativo de disparador em nuvem'),
('Social Media', 'Gestão de redes sociais'),
('Chatbot IA', 'Atendimento automatizado com inteligência artificial'),
('Consultoria VIP', 'Mentoria e suporte exclusivo');

-- Trigger para updated_at
CREATE TRIGGER set_predefined_products_updated_at
BEFORE UPDATE ON public.predefined_products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();