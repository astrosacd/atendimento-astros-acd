INSERT INTO public.system_permissions (key, name, description, category) VALUES
  ('configure_proposal_ghost_mode', 'Configurar Modo Ghost', 'Acesso à aba Modo Ghost (envio automático de áudio/vídeo)', 'Propostas'),
  ('configure_proposal_ai_voices', 'Configurar Vozes IA', 'Acesso à aba Vozes IA (ElevenLabs TTS)', 'Propostas')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role_name, permission_key)
SELECT 'admin', key FROM public.system_permissions
WHERE key IN ('configure_proposal_ghost_mode', 'configure_proposal_ai_voices')
ON CONFLICT DO NOTHING;