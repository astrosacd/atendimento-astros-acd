
CREATE TABLE public.baserow_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module TEXT NOT NULL, -- 'proposals' or 'followups'
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  api_url TEXT NOT NULL DEFAULT '',
  api_token TEXT NOT NULL DEFAULT '',
  table_id TEXT NOT NULL DEFAULT '',
  events TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(module)
);

ALTER TABLE public.baserow_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage baserow_integrations"
  ON public.baserow_integrations
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Insert default rows for each module
INSERT INTO public.baserow_integrations (module, events) VALUES
  ('proposals', ARRAY['proposta.enviada', 'proposta.aceita', 'proposta.recusada']),
  ('followups', ARRAY['followup.sent', 'followup.failed']);
