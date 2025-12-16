-- Tabelas para o módulo Divulgador Interno

-- Instância WhatsApp exclusiva do Divulgador
CREATE TABLE public.divulgador_whatsapp_instance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_name TEXT NOT NULL,
  api_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  is_connected BOOLEAN DEFAULT false,
  last_connected_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Campanhas
CREATE TABLE public.divulgador_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  min_empty_groups INTEGER DEFAULT 3,
  max_participants_per_group INTEGER DEFAULT 250,
  auto_create_groups BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Grupos
CREATE TABLE public.divulgador_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES public.divulgador_campaigns(id) ON DELETE CASCADE,
  whatsapp_group_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  invite_link TEXT,
  participant_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Mensagens agendadas
CREATE TABLE public.divulgador_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES public.divulgador_campaigns(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  media_type TEXT, -- text, image, video, audio, document
  media_url TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending', -- pending, sending, sent, failed
  mention_all BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Participantes
CREATE TABLE public.divulgador_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES public.divulgador_groups(id) ON DELETE CASCADE,
  whatsapp_number TEXT NOT NULL,
  name TEXT,
  is_admin BOOLEAN DEFAULT false,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  left_at TIMESTAMP WITH TIME ZONE,
  welcome_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Mensagem de boas-vindas
CREATE TABLE public.divulgador_welcome_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES public.divulgador_campaigns(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  delay_seconds INTEGER DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Logs de envio
CREATE TABLE public.divulgador_send_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES public.divulgador_messages(id) ON DELETE SET NULL,
  group_id UUID REFERENCES public.divulgador_groups(id) ON DELETE SET NULL,
  status TEXT NOT NULL, -- sent, failed
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Configurações gerais do módulo
CREATE TABLE public.divulgador_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_key TEXT NOT NULL UNIQUE,
  config_value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.divulgador_whatsapp_instance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.divulgador_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.divulgador_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.divulgador_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.divulgador_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.divulgador_welcome_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.divulgador_send_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.divulgador_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Apenas admins podem gerenciar
CREATE POLICY "Admins can manage divulgador_whatsapp_instance" ON public.divulgador_whatsapp_instance FOR ALL USING (is_admin());
CREATE POLICY "Admins can manage divulgador_campaigns" ON public.divulgador_campaigns FOR ALL USING (is_admin());
CREATE POLICY "Admins can manage divulgador_groups" ON public.divulgador_groups FOR ALL USING (is_admin());
CREATE POLICY "Admins can manage divulgador_messages" ON public.divulgador_messages FOR ALL USING (is_admin());
CREATE POLICY "Admins can manage divulgador_participants" ON public.divulgador_participants FOR ALL USING (is_admin());
CREATE POLICY "Admins can manage divulgador_welcome_config" ON public.divulgador_welcome_config FOR ALL USING (is_admin());
CREATE POLICY "Admins can manage divulgador_send_logs" ON public.divulgador_send_logs FOR ALL USING (is_admin());
CREATE POLICY "Admins can manage divulgador_config" ON public.divulgador_config FOR ALL USING (is_admin());

-- Triggers para updated_at
CREATE TRIGGER update_divulgador_whatsapp_instance_updated_at BEFORE UPDATE ON public.divulgador_whatsapp_instance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_divulgador_campaigns_updated_at BEFORE UPDATE ON public.divulgador_campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_divulgador_groups_updated_at BEFORE UPDATE ON public.divulgador_groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_divulgador_messages_updated_at BEFORE UPDATE ON public.divulgador_messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_divulgador_welcome_config_updated_at BEFORE UPDATE ON public.divulgador_welcome_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_divulgador_config_updated_at BEFORE UPDATE ON public.divulgador_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_divulgador_groups_campaign ON public.divulgador_groups(campaign_id);
CREATE INDEX idx_divulgador_messages_campaign ON public.divulgador_messages(campaign_id);
CREATE INDEX idx_divulgador_messages_scheduled ON public.divulgador_messages(scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_divulgador_participants_group ON public.divulgador_participants(group_id);
CREATE INDEX idx_divulgador_participants_number ON public.divulgador_participants(whatsapp_number);
CREATE INDEX idx_divulgador_send_logs_message ON public.divulgador_send_logs(message_id);