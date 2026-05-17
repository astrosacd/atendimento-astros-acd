
-- Função que valida o token provisório enviado no header x-temp-access-token
CREATE OR REPLACE FUNCTION public.has_ligacoes_temp_perm(p_perm text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
  v_perms text[];
BEGIN
  BEGIN
    v_token := nullif(current_setting('request.headers', true)::json->>'x-temp-access-token', '');
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;

  IF v_token IS NULL THEN
    RETURN false;
  END IF;

  SELECT permissions INTO v_perms
  FROM public.temporary_access_tokens
  WHERE token = v_token
    AND is_active = true
    AND expires_at > now()
    AND target_path = '/ligacoes-ia'
    AND (max_uses IS NULL OR uses < max_uses)
  LIMIT 1;

  RETURN v_perms IS NOT NULL AND p_perm = ANY(v_perms);
END;
$$;

-- Roteiros: leitura quando o link tem qualquer permissão que use roteiros
CREATE POLICY "Temp access can view roteiros"
ON public.ligacoes_ia_roteiros
FOR SELECT
TO anon, authenticated
USING (
  public.has_ligacoes_temp_perm('roteiros')
  OR public.has_ligacoes_temp_perm('disparo')
  OR public.has_ligacoes_temp_perm('campanhas')
  OR public.has_ligacoes_temp_perm('cobranca')
  OR public.has_ligacoes_temp_perm('fila')
);

-- Campanhas
CREATE POLICY "Temp access can view campanhas"
ON public.ligacoes_campanhas
FOR SELECT
TO anon, authenticated
USING (public.has_ligacoes_temp_perm('campanhas'));

-- Clientes (apenas leitura para montar listas)
CREATE POLICY "Temp access can view clientes"
ON public.clientes
FOR SELECT
TO anon, authenticated
USING (
  public.has_ligacoes_temp_perm('campanhas')
  OR public.has_ligacoes_temp_perm('disparo')
  OR public.has_ligacoes_temp_perm('fila')
);

-- Histórico
CREATE POLICY "Temp access can view historico"
ON public.ligacoes_ia_historico
FOR SELECT
TO anon, authenticated
USING (public.has_ligacoes_temp_perm('historico'));

-- Fila (ligacoes_agendadas)
CREATE POLICY "Temp access can view ligacoes_agendadas"
ON public.ligacoes_agendadas
FOR SELECT
TO anon, authenticated
USING (
  public.has_ligacoes_temp_perm('fila')
  OR public.has_ligacoes_temp_perm('campanhas')
);

-- Config do módulo (Wavoip/ElevenLabs) — o link provisório usa as credenciais do admin
CREATE POLICY "Temp access can view ligacoes_ia_config"
ON public.ligacoes_ia_config
FOR SELECT
TO anon, authenticated
USING (
  public.has_ligacoes_temp_perm('historico')
  OR public.has_ligacoes_temp_perm('fila')
  OR public.has_ligacoes_temp_perm('roteiros')
  OR public.has_ligacoes_temp_perm('disparo')
  OR public.has_ligacoes_temp_perm('campanhas')
  OR public.has_ligacoes_temp_perm('cobranca')
);

-- Configuração de cobrança (leitura)
CREATE POLICY "Temp access can view cobranca_ligacao_config"
ON public.cobranca_ligacao_config
FOR SELECT
TO anon, authenticated
USING (
  public.has_ligacoes_temp_perm('cobranca')
  OR public.has_ligacoes_temp_perm('fila')
);
