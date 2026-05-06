
-- Cadastro de formulários monitorados
CREATE TABLE public.atomicat_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  identifier_type text NOT NULL CHECK (identifier_type IN ('form_id','name_url','both')),
  form_id text,
  form_name text,
  page_url text,
  message_template text NOT NULL,
  instance_name text,
  field_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_atomicat_forms_form_id ON public.atomicat_forms(form_id) WHERE form_id IS NOT NULL;
CREATE INDEX idx_atomicat_forms_form_name ON public.atomicat_forms(form_name) WHERE form_name IS NOT NULL;

ALTER TABLE public.atomicat_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage atomicat_forms" ON public.atomicat_forms
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Histórico de submissões
CREATE TABLE public.atomicat_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_config_id uuid REFERENCES public.atomicat_forms(id) ON DELETE SET NULL,
  atomicat_form_id text,
  atomicat_form_name text,
  page_url text,
  payload jsonb NOT NULL,
  extracted_nome text,
  extracted_email text,
  extracted_telefone text,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','sent','failed','skipped','no_match')),
  error_message text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_atomicat_subm_created ON public.atomicat_submissions(created_at DESC);
CREATE INDEX idx_atomicat_subm_form ON public.atomicat_submissions(form_config_id);

ALTER TABLE public.atomicat_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read atomicat_submissions" ON public.atomicat_submissions
  FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins delete atomicat_submissions" ON public.atomicat_submissions
  FOR DELETE USING (public.is_admin());

-- Configurações globais (single row)
CREATE TABLE public.atomicat_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  default_instance_name text,
  api_url text,
  api_key text,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.atomicat_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage atomicat_settings" ON public.atomicat_settings
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO public.atomicat_settings (default_instance_name, enabled) VALUES (NULL, true);

-- Trigger updated_at
CREATE TRIGGER trg_atomicat_forms_updated
  BEFORE UPDATE ON public.atomicat_forms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_atomicat_settings_updated
  BEFORE UPDATE ON public.atomicat_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
