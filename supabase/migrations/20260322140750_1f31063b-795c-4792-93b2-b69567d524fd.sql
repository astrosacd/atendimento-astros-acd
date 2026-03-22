
CREATE TABLE public.client_whatsapp_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  group_name text NOT NULL,
  group_description text,
  group_jid text,
  participants text[] NOT NULL DEFAULT '{}',
  image_url text,
  created_by uuid,
  created_by_email text,
  created_by_name text,
  motivo text,
  status text NOT NULL DEFAULT 'created',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_whatsapp_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view groups"
  ON public.client_whatsapp_groups FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert groups"
  ON public.client_whatsapp_groups FOR INSERT TO authenticated WITH CHECK (true);
