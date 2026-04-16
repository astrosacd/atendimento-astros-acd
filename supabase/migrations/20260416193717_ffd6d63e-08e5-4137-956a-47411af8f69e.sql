-- Create system_activities table
CREATE TABLE public.system_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  resource_type TEXT,
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_activities ENABLE ROW LEVEL SECURITY;

-- Policies for system_activities
CREATE POLICY "Users can view system activities" 
ON public.system_activities 
FOR SELECT 
USING (true);

CREATE POLICY "Users can insert their own activities" 
ON public.system_activities 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Add the new permission to system_permissions
INSERT INTO public.system_permissions (key, name, description, category)
VALUES ('view_dashboard_charts', 'Visualizar Gráficos do Dashboard', 'Permite visualizar os gráficos e métricas avançadas no dashboard principal', 'dashboard')
ON CONFLICT (key) DO NOTHING;

-- Grant this permission to existing admin/manager roles by default
INSERT INTO public.role_permissions (role_name, permission_key)
VALUES 
  ('admin', 'view_dashboard_charts'),
  ('gerente', 'view_dashboard_charts')
ON CONFLICT (role_name, permission_key) DO NOTHING;
