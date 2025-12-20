-- Adicionar permissões do Guia de Configuração
INSERT INTO public.system_permissions (key, name, description, category) VALUES
-- Permissão geral para acessar o guia
('view_guia', 'Visualizar Guia', 'Permite acessar o Guia de Configuração', 'Guia'),

-- Permissões por categoria do guia
('view_guia_comunicacao', 'Guia - Comunicação', 'Acesso às seções Gmail, Evolution e Boas-vindas', 'Guia'),
('view_guia_integracoes', 'Guia - Integrações', 'Acesso às seções Webhooks, API e MercadoPago', 'Guia'),
('view_guia_usuarios', 'Guia - Usuários', 'Acesso às seções Usuários e Permissões', 'Guia'),
('view_guia_cobranca', 'Guia - Cobrança', 'Acesso às seções Cobrança e Verificação de Pagamento', 'Guia'),
('view_guia_clientes', 'Guia - Clientes', 'Acesso às seções Tags, Registro de Clientes e Restauração', 'Guia'),
('view_guia_divulgador', 'Guia - Divulgador', 'Acesso à seção do Divulgador', 'Guia'),
('view_guia_numeros', 'Guia - Status de Números', 'Acesso à seção de Status de Números', 'Guia'),
('view_guia_avancado', 'Guia - Avançado', 'Acesso às seções Chat, Dashboard, Logs, Notificações, Backup e Troubleshooting', 'Guia')
ON CONFLICT (key) DO NOTHING;