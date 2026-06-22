
CREATE TABLE IF NOT EXISTS public.consulta_numeros_obs_presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label TEXT NOT NULL,
  texto_observacao TEXT NOT NULL,
  status_padrao TEXT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consulta_numeros_obs_presets TO authenticated;
GRANT ALL ON public.consulta_numeros_obs_presets TO service_role;

ALTER TABLE public.consulta_numeros_obs_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read obs presets"
  ON public.consulta_numeros_obs_presets FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage obs presets - insert"
  ON public.consulta_numeros_obs_presets FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_permission(auth.uid(), 'manage_consulta_numeros_obs_presets'));

CREATE POLICY "Admins manage obs presets - update"
  ON public.consulta_numeros_obs_presets FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_permission(auth.uid(), 'manage_consulta_numeros_obs_presets'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_permission(auth.uid(), 'manage_consulta_numeros_obs_presets'));

CREATE POLICY "Admins manage obs presets - delete"
  ON public.consulta_numeros_obs_presets FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_permission(auth.uid(), 'manage_consulta_numeros_obs_presets'));

CREATE TRIGGER update_consulta_numeros_obs_presets_updated_at
  BEFORE UPDATE ON public.consulta_numeros_obs_presets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.consulta_numeros_obs_presets (label, texto_observacao, status_padrao, ordem)
VALUES ('SIM não aprovisionado', 'SIM não aprovisionado', 'EXCLUIDO', 1)
ON CONFLICT DO NOTHING;

INSERT INTO public.system_permissions (key, name, description, category)
VALUES (
  'manage_consulta_numeros_obs_presets',
  'Gerenciar Presets de Observação',
  'Permite criar, editar e excluir os atalhos rápidos do campo de observações',
  'Consulta de Números'
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role_name, permission_key)
SELECT 'admin', 'manage_consulta_numeros_obs_presets'
ON CONFLICT (role_name, permission_key) DO NOTHING;
