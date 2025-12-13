-- Adicionar configurações de boas-vindas na tabela recovery_config
INSERT INTO public.recovery_config (config_key, config_value)
VALUES 
  ('welcome_email_enabled', 'false'),
  ('welcome_whatsapp_enabled', 'false'),
  ('welcome_email_subject', 'Bem-vindo ao Sistema Astros!'),
  ('welcome_email_template', 'Olá {nome},

Sua conta foi criada com sucesso no Sistema Astros!

Seus dados de acesso:
- E-mail: {email}
- Senha: {senha}

Acesse o sistema em: {url}

Atenciosamente,
Equipe Astros'),
  ('welcome_whatsapp_template', 'Olá {nome}! 👋

Sua conta foi criada no Sistema Astros!

📧 E-mail: {email}
🔐 Senha: {senha}

Acesse: {url}')
ON CONFLICT (config_key) DO NOTHING;