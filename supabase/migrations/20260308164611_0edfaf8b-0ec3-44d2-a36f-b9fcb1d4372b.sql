
-- Table to store client social media credentials
CREATE TABLE public.client_social_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
  platform TEXT NOT NULL,
  login TEXT NOT NULL,
  encrypted_password TEXT NOT NULL,
  notes TEXT,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by client
CREATE INDEX idx_client_social_credentials_cliente_id ON public.client_social_credentials(cliente_id);

-- Enable RLS
ALTER TABLE public.client_social_credentials ENABLE ROW LEVEL SECURITY;

-- Only authenticated users with proper permissions can access
CREATE POLICY "Authenticated users can view social credentials"
  ON public.client_social_credentials
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert social credentials"
  ON public.client_social_credentials
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update social credentials"
  ON public.client_social_credentials
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete social credentials"
  ON public.client_social_credentials
  FOR DELETE
  TO authenticated
  USING (true);

-- Updated_at trigger
CREATE TRIGGER update_client_social_credentials_updated_at
  BEFORE UPDATE ON public.client_social_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add permissions for the module
INSERT INTO public.system_permissions (key, name, description, category) VALUES
  ('view_social_credentials', 'Ver Credenciais Social Media', 'Permite visualizar credenciais de redes sociais dos clientes', 'Social Media'),
  ('manage_social_credentials', 'Gerenciar Credenciais Social Media', 'Permite criar, editar e excluir credenciais de redes sociais', 'Social Media')
ON CONFLICT (key) DO NOTHING;

-- Give admin role these permissions
INSERT INTO public.role_permissions (role_name, permission_key)
SELECT 'admin', key FROM public.system_permissions WHERE key IN ('view_social_credentials', 'manage_social_credentials')
ON CONFLICT DO NOTHING;
