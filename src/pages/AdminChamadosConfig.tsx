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
import { ArrowLeft, Settings, Mail, Clock, Save, Eye, EyeOff, ExternalLink, Globe, ShieldCheck, Server } from "lucide-react";
import { useSiteUrl } from "@/hooks/useSiteUrl";
import { copyToClipboard as __copyToClipboard } from '@/utils/clipboard';
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";

const AdminChamadosConfig = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const siteUrl = useSiteUrl();
  const [showPassword, setShowPassword] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ['chamados-config'],
    queryFn: async () => {
      const { data, error } = await supabase.from('chamados_config').select('*');
      if (error) throw error;
      const configMap: Record<string, string> = {};
      data?.forEach(c => { configMap[c.config_key] = c.config_value; });
      return configMap;
    },
  });

  const [formData, setFormData] = useState<Record<string, string>>({});

  useState(() => {
    if (config) setFormData(config);
  });

  const currentConfig = { ...config, ...formData };

  const saveMutation = useMutation({
    mutationFn: async (updates: Record<string, string>) => {
      for (const [key, value] of Object.entries(updates)) {
        const { error } = await supabase.from('chamados_config').upsert({ config_key: key, config_value: value }, { onConflict: 'config_key' });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chamados-config'] });
      toast.success('Configurações salvas');
    },
  });

  const updateField = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const publicUrl = `${siteUrl}/chamados`;

  const handleCopyPublicUrl = async () => {
    await __copyToClipboard(publicUrl);
    toast.success('URL copiada!');
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-8 space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin/chamados')} className="rounded-full hover:bg-primary/10 transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20">
                <Settings className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground tracking-tight">Configurações</h1>
                <p className="text-sm text-muted-foreground font-medium italic">Sistema de Atendimento</p>
              </div>
            </div>
          </div>
          <Button onClick={() => saveMutation.mutate(formData)} disabled={saveMutation.isPending} className="font-bold shadow-lg shadow-primary/20">
            <Save className="h-4 w-4 mr-2" /> Salvar Alterações
          </Button>
        </header>

        <main className="max-w-4xl mx-auto space-y-6">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-border/40 bg-card/50 backdrop-blur-sm overflow-hidden border-2">
              <div className="h-1.5 w-full bg-blue-500/50" />
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><Globe className="h-5 w-5 text-blue-400" /> Acesso ao Cliente</CardTitle>
                <CardDescription>Link público para os clientes abrirem e acompanharem chamados.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col md:flex-row items-center gap-3">
                  <Input value={publicUrl} readOnly className="font-mono text-sm bg-background/50 border-border/40" />
                  <div className="flex gap-2 w-full md:w-auto">
                    <Button variant="secondary" onClick={handleCopyPublicUrl} className="flex-1 md:flex-none font-bold">Copiar Link</Button>
                    <Button variant="outline" onClick={() => window.open(publicUrl, '_blank')} className="px-3 border-border/40"><ExternalLink className="h-4 w-4" /></Button>
                  </div>
                </div>
                <div className="space-y-2 pt-2">
                  <Label className="text-sm font-bold text-foreground/80">URL Base Customizada (Email)</Label>
                  <Input placeholder="https://seu-dominio.com" value={currentConfig.email_base_url || ''} onChange={(e) => updateField('email_base_url', e.target.value)} className="h-11 border-border/40 bg-background/50" />
                  <p className="text-[10px] text-muted-foreground font-medium italic">Usada nos botões de acompanhamento enviados por email.</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="border-border/40 bg-card/50 backdrop-blur-sm overflow-hidden border-2">
              <div className="h-1.5 w-full bg-amber-500/50" />
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><ShieldCheck className="h-5 w-5 text-amber-400" /> Segurança e Validação</CardTitle>
                <CardDescription>Regras de autenticação por email.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center"><Label className="text-sm font-bold text-foreground/80">Expiração do Código: {currentConfig.verification_code_expiry_minutes || 5} min</Label></div>
                  <Slider value={[parseInt(currentConfig.verification_code_expiry_minutes || '5')]} min={1} max={60} step={1} onValueChange={([v]) => updateField('verification_code_expiry_minutes', String(v))} className="py-4" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="border-border/40 bg-card/50 backdrop-blur-sm overflow-hidden border-2">
              <div className="h-1.5 w-full bg-emerald-500/50" />
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><Server className="h-5 w-5 text-emerald-400" /> Servidor de Email (SMTP)</CardTitle>
                <CardDescription>Configurações para envio de notificações.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 rounded-xl bg-background/30 border border-border/40">
                  <div className="space-y-1"><p className="text-sm font-bold text-foreground/80">Ativar Notificações</p><p className="text-xs text-muted-foreground">Habilita o envio automático de emails.</p></div>
                  <Switch checked={currentConfig.smtp_enabled === 'true'} onCheckedChange={(c) => updateField('smtp_enabled', String(c))} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label className="text-sm font-bold text-foreground/80">Nome Exibido</Label><Input value={currentConfig.smtp_sender_name || ''} onChange={(e) => updateField('smtp_sender_name', e.target.value)} placeholder="Suporte Astros" className="h-11 border-border/40 bg-background/50" /></div>
                  <div className="space-y-2"><Label className="text-sm font-bold text-foreground/80">Email Gmail</Label><Input value={currentConfig.smtp_gmail_user || ''} onChange={(e) => updateField('smtp_gmail_user', e.target.value)} placeholder="suporte@gmail.com" className="h-11 border-border/40 bg-background/50" /></div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-bold text-foreground/80">Senha de App</Label>
                  <div className="relative">
                    <Input type={showPassword ? 'text' : 'password'} value={currentConfig.smtp_gmail_app_password || ''} onChange={(e) => updateField('smtp_gmail_app_password', e.target.value)} placeholder="xxxx xxxx xxxx xxxx" className="h-11 border-border/40 bg-background/50 pr-10" />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground font-medium italic">Obtenha na sua Conta Google → Segurança → Senhas de app.</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </main>
      </div>
    </DashboardLayout>
  );
};

export default AdminChamadosConfig;
