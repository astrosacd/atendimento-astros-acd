import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Settings, Mail, Clock, Save, Eye, EyeOff, ExternalLink } from "lucide-react";

const AdminChamadosConfig = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ['chamados-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chamados_config')
        .select('*');
      
      if (error) throw error;
      
      const configMap: Record<string, string> = {};
      data?.forEach(c => { configMap[c.config_key] = c.config_value; });
      return configMap;
    },
  });

  const [formData, setFormData] = useState<Record<string, string>>({});

  // Initialize form when config loads
  useState(() => {
    if (config) {
      setFormData(config);
    }
  });

  const currentConfig = { ...config, ...formData };

  const saveMutation = useMutation({
    mutationFn: async (updates: Record<string, string>) => {
      for (const [key, value] of Object.entries(updates)) {
        const { error } = await supabase
          .from('chamados_config')
          .upsert({ config_key: key, config_value: value }, { onConflict: 'config_key' });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chamados-config'] });
      toast.success('Configurações salvas com sucesso');
    },
    onError: (error) => {
      console.error('Error saving config:', error);
      toast.error('Erro ao salvar configurações');
    },
  });

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  const updateField = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  // Usar o domínio correto do Lovable app
  const getPublicUrl = () => {
    const hostname = window.location.hostname;
    // Se estiver em ambiente de desenvolvimento ou preview, usar o origin
    if (hostname.includes('localhost') || hostname.includes('lovableproject.com')) {
      return `https://crm-astros-acd.lovable.app/chamados`;
    }
    // Se já estiver no domínio correto, usar o origin
    return `${window.location.origin}/chamados`;
  };
  
  const publicUrl = getPublicUrl();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/admin/chamados')}
              className="hover:bg-primary/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                <Settings className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Configurações</h1>
                <p className="text-sm text-muted-foreground">Sistema de Chamados</p>
              </div>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            Salvar Configurações
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* URL Pública */}
        <Card className="border-border/40 bg-card/50 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5 text-primary" />
              URL Pública para Clientes
            </CardTitle>
            <CardDescription>
              Compartilhe este link com seus clientes para que possam abrir e acompanhar chamados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Input 
                value={publicUrl}
                readOnly 
                className="font-mono text-sm"
              />
              <Button 
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(publicUrl);
                  toast.success('URL copiada!');
                }}
              >
                Copiar
              </Button>
              <Button 
                variant="outline"
                onClick={() => window.open(publicUrl, '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Código de Verificação */}
        <Card className="border-border/40 bg-card/50 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Código de Verificação
            </CardTitle>
            <CardDescription>
              Configure o tempo de expiração do código de verificação enviado por email
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Tempo de Expiração (minutos): {currentConfig.verification_code_expiry_minutes || 5}</Label>
              <Slider
                value={[parseInt(currentConfig.verification_code_expiry_minutes || '5')]}
                min={1}
                max={60}
                step={1}
                className="mt-2"
                onValueChange={([value]) => updateField('verification_code_expiry_minutes', String(value))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Mínimo: 1 minuto | Máximo: 60 minutos
              </p>
            </div>
          </CardContent>
        </Card>

        {/* SMTP Gmail */}
        <Card className="border-border/40 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Configuração SMTP (Gmail)
            </CardTitle>
            <CardDescription>
              Configure o envio de emails para notificações e códigos de verificação
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Habilitar Envio de Email</Label>
                <p className="text-xs text-muted-foreground">Ative para enviar notificações por email</p>
              </div>
              <Switch
                checked={currentConfig.smtp_enabled === 'true'}
                onCheckedChange={(checked) => updateField('smtp_enabled', String(checked))}
              />
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div>
                <Label htmlFor="smtp_sender_name">Nome do Remetente</Label>
                <Input
                  id="smtp_sender_name"
                  placeholder="Sistema de Chamados"
                  value={currentConfig.smtp_sender_name || ''}
                  onChange={(e) => updateField('smtp_sender_name', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="smtp_gmail_user">Email Gmail</Label>
                <Input
                  id="smtp_gmail_user"
                  type="email"
                  placeholder="seu-email@gmail.com"
                  value={currentConfig.smtp_gmail_user || ''}
                  onChange={(e) => updateField('smtp_gmail_user', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="smtp_gmail_app_password">Senha de App (16 caracteres)</Label>
                <div className="relative">
                  <Input
                    id="smtp_gmail_app_password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="xxxx xxxx xxxx xxxx"
                    value={currentConfig.smtp_gmail_app_password || ''}
                    onChange={(e) => updateField('smtp_gmail_app_password', e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Crie uma senha de app em: Conta Google → Segurança → Senhas de app
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminChamadosConfig;
