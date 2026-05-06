import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Instagram, Save, Eye, EyeOff, ShieldCheck, RefreshCw, AlertTriangle, CheckCircle2, Info, Webhook } from "lucide-react";
import { format, isBefore, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";

const InstagramSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [settings, setSettings] = useState({
    ig_user_id: "",
    page_id: "",
    account_username: "",
    access_token: "",
    app_id: "",
    app_secret: "",
    token_expires_at: null as string | null,
    renewal_webhook: "",
  });

  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [user]);

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from("instagram_settings")
      .select("*")
      .eq("user_id", user?.id)
      .maybeSingle();

    const { data: webhookConfig } = await supabase
      .from('billing_config')
      .select('config_value')
      .eq('config_key', 'instagram_renewal_webhook')
      .maybeSingle();

    if (error) {
      console.error("Error fetching settings:", error);
    } else {
      setSettings({
        ig_user_id: data?.ig_user_id || "",
        page_id: data?.page_id || "",
        account_username: data?.account_username || "",
        access_token: data?.access_token || "",
        app_id: data?.app_id || "",
        app_secret: data?.app_secret || "",
        token_expires_at: data?.token_expires_at || null,
        renewal_webhook: webhookConfig?.config_value || "",
      });
    }
  };

  const handleTokenAction = async (action: "debug" | "refresh") => {
    if (!settings.app_id || !settings.app_secret) {
      toast({
        title: "Campos obrigatórios",
        description: "App ID e App Secret são necessários para esta ação.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("instagram-token-manager", {
        body: { action },
      });

      if (error) throw error;

      toast({
        title: action === "debug" ? "Token Verificado" : "Token Renovado",
        description: action === "debug" 
          ? "Informações do token atualizadas." 
          : "Seu token foi renovado por mais 60 dias.",
      });

      fetchSettings(); // Refresh UI
    } catch (error: any) {
      toast({
        title: "Erro na operação",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getExpirationStatus = () => {
    if (!settings.token_expires_at) return null;
    
    const expiryDate = new Date(settings.token_expires_at);
    const now = new Date();
    const isExpired = isBefore(expiryDate, now);
    const isWarning = isBefore(expiryDate, addDays(now, 15)); // 15 days warning

    return {
      date: format(expiryDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }),
      isExpired,
      isWarning,
    };
  };

  const expirationStatus = getExpirationStatus();

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error: settingsError } = await supabase.from("instagram_settings").upsert({
        user_id: user?.id,
        ig_user_id: settings.ig_user_id,
        page_id: settings.page_id,
        account_username: settings.account_username,
        access_token: settings.access_token,
        app_id: settings.app_id,
        app_secret: settings.app_secret,
        updated_at: new Date().toISOString(),
      });

      if (settingsError) throw settingsError;

      const { error: webhookError } = await supabase
        .from('billing_config')
        .upsert({
          config_key: 'instagram_renewal_webhook',
          config_value: settings.renewal_webhook
        });

      if (webhookError) throw webhookError;

      // Automatically check token validity if App ID and Secret are provided
      if (settings.app_id && settings.app_secret && settings.access_token) {
        await handleTokenAction("debug");
      } else {
        toast({
          title: "Sucesso!",
          description: "Configurações do Instagram salvas.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Credenciais da API Meta
            </CardTitle>
            <CardDescription>
              Insira os dados obtidos no Portal de Desenvolvedores da Meta.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="app_id">Meta App ID</Label>
                <Input
                  id="app_id"
                  placeholder="ID do seu App Meta"
                  value={settings.app_id}
                  onChange={(e) => setSettings({ ...settings, app_id: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="app_secret">Meta App Secret</Label>
                <Input
                  id="app_secret"
                  type="password"
                  placeholder="Secret do seu App Meta"
                  value={settings.app_secret}
                  onChange={(e) => setSettings({ ...settings, app_secret: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ig_id">Instagram User ID (Obrigatório)</Label>
                <Input
                  id="ig_id"
                  placeholder="ID da conta Instagram Business"
                  value={settings.ig_user_id}
                  onChange={(e) => setSettings({ ...settings, ig_user_id: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="page_id">Facebook Page ID (Opcional)</Label>
                <Input
                  id="page_id"
                  placeholder="ID da página vinculada"
                  value={settings.page_id}
                  onChange={(e) => setSettings({ ...settings, page_id: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">@Username (Opcional)</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground">@</span>
                <Input
                  id="username"
                  className="pl-7"
                  placeholder="seu_perfil"
                  value={settings.account_username}
                  onChange={(e) => setSettings({ ...settings, account_username: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="token">Meta Access Token</Label>
              <div className="relative">
                <Input
                  id="token"
                  type={showToken ? "text" : "password"}
                  placeholder="Token de acesso (long-lived)"
                  value={settings.access_token}
                  onChange={(e) => setSettings({ ...settings, access_token: e.target.value })}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  {showToken ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Recomendamos usar um Token de Sistema com permissões `instagram_basic`, `instagram_content_publish`, e `ads_management`.
              </p>

              {expirationStatus && (
                <div className={`flex items-center gap-3 p-3 rounded-lg border ${
                  expirationStatus.isExpired 
                    ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400" 
                    : expirationStatus.isWarning 
                    ? "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400"
                    : "bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400"
                }`}>
                  {expirationStatus.isExpired ? (
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                  ) : expirationStatus.isWarning ? (
                    <Info className="h-5 w-5 shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 shrink-0" />
                  )}
                  <div className="flex-1 text-sm">
                    <p className="font-semibold">
                      {expirationStatus.isExpired ? "Token Expirado" : "Validade do Token"}
                    </p>
                    <p>Expira em: {expirationStatus.date}</p>
                  </div>
                  {!expirationStatus.isExpired && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleTokenAction("refresh")}
                      disabled={loading}
                      className="ml-auto"
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                      Renovar
                    </Button>
                  )}
                </div>
              )}

              {settings.access_token && !expirationStatus && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleTokenAction("debug")}
                  disabled={loading}
                  className="w-full sm:w-auto"
                >
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Verificar Validade do Token
                </Button>
              )}
            </div>

            <Button onClick={handleSave} disabled={loading} className="w-full sm:w-auto">
              {loading ? "Salvando..." : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Configurações
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Webhook className="h-5 w-5 text-primary" />
              Notificação de Renovação (n8n)
            </CardTitle>
            <CardDescription>
              URL do Webhook para receber o novo token após renovação.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="webhook">URL do Webhook</Label>
              <Input
                id="webhook"
                placeholder="https://seu-n8n.com/webhook/..."
                value={settings.renewal_webhook}
                onChange={(e) => setSettings({ ...settings, renewal_webhook: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                O sistema enviará um POST JSON com `new_token` e `expires_at` sempre que o token for renovado com sucesso.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-muted/50 border-none">
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Ajuda rápida</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-4">
              <p>
                Para obter esses dados, acesse o <a href="https://developers.facebook.com/" target="_blank" rel="noreferrer" className="text-primary hover:underline font-medium">Meta for Developers</a>.
              </p>
              <ul className="list-disc pl-4 space-y-2 text-muted-foreground">
                <li>Crie um App do tipo "Business"</li>
                <li>Adicione o produto "Instagram Graph API"</li>
                <li>Gere um Token de Acesso no Explorador da API Graph</li>
                <li>Certifique-se que o Instagram está vinculado a uma Página do Facebook</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default InstagramSettings;
