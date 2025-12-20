-- Add email configuration keys for desbanimento OK feature
INSERT INTO consulta_numeros_config (config_key, config_value)
VALUES 
  ('email_gmail_user', ''),
  ('email_gmail_app_password', ''),
  ('email_subject_template', 'Número {{numero}} - Desbanimento Concluído'),
  ('email_body_template', 'Olá {{nome}},

Informamos que o seu número {{numero}} foi desbanido com sucesso!

Segue em anexo a imagem comprovando o desbanimento.

Atenciosamente,
Equipe de Suporte'),
  ('email_enabled', 'true')
ON CONFLICT (config_key) DO NOTHING;