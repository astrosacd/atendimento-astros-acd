-- Create RCS Sessions table
CREATE TABLE public.rcs_sessions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'disconnected', -- 'connected', 'disconnected', 'pairing'
    session_data TEXT, -- Stores auth tokens/state for the gateway
    qr_code TEXT, -- Stores the current QR code for pairing
    last_connected_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    user_id UUID REFERENCES auth.users(id)
);

-- Create RCS Messages table (History)
CREATE TABLE public.rcs_messages (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES public.rcs_sessions(id) ON DELETE CASCADE,
    numero_destino TEXT NOT NULL,
    conteudo TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente', -- 'pendente', 'enviado', 'erro'
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    user_id UUID REFERENCES auth.users(id)
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rcs_sessions TO authenticated;
GRANT ALL ON public.rcs_sessions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rcs_messages TO authenticated;
GRANT ALL ON public.rcs_messages TO service_role;

-- Enable RLS
ALTER TABLE public.rcs_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rcs_messages ENABLE ROW LEVEL SECURITY;

-- Policies for rcs_sessions
CREATE POLICY "Users can manage their own rcs_sessions"
ON public.rcs_sessions
FOR ALL
USING (auth.uid() = user_id);

-- Policies for rcs_messages
CREATE POLICY "Users can manage their own rcs_messages"
ON public.rcs_messages
FOR ALL
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_rcs_sessions_updated_at
BEFORE UPDATE ON public.rcs_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rcs_messages_updated_at
BEFORE UPDATE ON public.rcs_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
