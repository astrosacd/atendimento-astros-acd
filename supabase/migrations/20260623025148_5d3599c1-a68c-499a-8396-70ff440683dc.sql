
-- Fix RLS error "operator does not exist: text = app_role" caused by app_role overload of has_role()
DROP POLICY IF EXISTS "Admins manage obs presets - insert" ON public.consulta_numeros_obs_presets;
DROP POLICY IF EXISTS "Admins manage obs presets - update" ON public.consulta_numeros_obs_presets;
DROP POLICY IF EXISTS "Admins manage obs presets - delete" ON public.consulta_numeros_obs_presets;

CREATE POLICY "Admins manage obs presets - insert"
  ON public.consulta_numeros_obs_presets FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.has_permission(auth.uid(), 'manage_consulta_numeros_obs_presets'));

CREATE POLICY "Admins manage obs presets - update"
  ON public.consulta_numeros_obs_presets FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.has_permission(auth.uid(), 'manage_consulta_numeros_obs_presets'))
  WITH CHECK (public.is_admin() OR public.has_permission(auth.uid(), 'manage_consulta_numeros_obs_presets'));

CREATE POLICY "Admins manage obs presets - delete"
  ON public.consulta_numeros_obs_presets FOR DELETE TO authenticated
  USING (public.is_admin() OR public.has_permission(auth.uid(), 'manage_consulta_numeros_obs_presets'));

-- Add visual customization columns
ALTER TABLE public.consulta_numeros_obs_presets
  ADD COLUMN IF NOT EXISTS cor TEXT NULL,
  ADD COLUMN IF NOT EXISTS icone TEXT NULL;
