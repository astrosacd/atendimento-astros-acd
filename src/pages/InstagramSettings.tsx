import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Instagram, Save, Eye, EyeOff, ShieldCheck, RefreshCw, AlertTriangle, CheckCircle2, Info, Webhook, Bell, MessageSquare, Plus, Trash2, Sparkles } from "lucide-react";
import { format, isBefore, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

type InstagramSettingsState = {
  ig_user_id: string;
  page_id: string;
  account_username: string;
  access_token: string;
  app_id: string;
  app_secret: string;
  token_expires_at: string | null;
  renewal_webhook: string;
  notify_whatsapp: boolean;
  manager_numbers: string[];
};

const getDraftKey = (userId?: string) => `instagram-settings-draft:${userId ?? "anonymous"}`;

const hasMeaningfulDraft = (draft: InstagramSettingsState) =>
  Boolean(
    draft.ig_user_id ||
      draft.page_id ||
      draft.account_username ||
      draft.access_token ||
      draft.app_id ||
      draft.app_secret ||
      draft.renewal_webhook ||
      draft.notify_whatsapp ||
      draft.manager_numbers.length,
  );

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Erro inesperado ao processar a operação.";

const InstagramSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [newManagerNumber, setNewManagerNumber] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [activeTab, setActiveTab] = useState("meta-api");
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const dirtyRef = useRef(false);
  const settingsRef = useRef<InstagramSettingsState | null>(null);
  const [settings, setSettings] = useState<InstagramSettingsState>({
    ig_user_id: "",
    page_id: "",
    account_username: "",
    access_token: "",
    app_id: "",
    app_secret: "",
    token_expires_at: null as string | null,
    renewal_webhook: "",
    notify_whatsapp: false,
    manager_numbers: [] as string[],
  });

  const updateField = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      settingsRef.current = next;
      if (user?.id) {
        localStorage.setItem(getDraftKey(user.id), JSON.stringify(next));
      }
      return next;
    });
    dirtyRef.current = true;
    setIsDirty(true);
  };

  const markDirtySettings = (next: InstagramSettingsState) => {
    settingsRef.current = next;
    if (user?.id) {
      localStorage.setItem(getDraftKey(user.id), JSON.stringify(next));
    }
    dirtyRef.current = true;
    setIsDirty(true);
  };

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    dirtyRef.current = isDirty;
  }, [isDirty]);

  // Aviso ao fechar/recarregar a aba com alterações não salvas
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Preserva rascunho ao trocar de guia/app e ao voltar do painel da Meta/Facebook.
  useEffect(() => {
    const persistDraft = () => {
      if (dirtyRef.current && user?.id && settingsRef.current) {
        localStorage.setItem(getDraftKey(user.id), JSON.stringify(settingsRef.current));
      }
    };

    document.addEventListener("visibilitychange", persistDraft);
    window.addEventListener("pagehide", persistDraft);
    window.addEventListener("blur", persistDraft);

    return () => {
      document.removeEventListener("visibilitychange", persistDraft);
      window.removeEventListener("pagehide", persistDraft);
      window.removeEventListener("blur", persistDraft);
    };
  }, [user?.id]);

  // Troca de tab com proteção
  const handleTabChange = (value: string) => {
    if (isDirty && value !== activeTab) {
      setPendingTab(value);
      return;
    }
    setActiveTab(value);
  };

  const confirmDiscardAndChangeTab = () => {
    if (pendingTab) {
      if (user?.id) {
        localStorage.removeItem(getDraftKey(user.id));
      }
      setActiveTab(pendingTab);
      setPendingTab(null);
      dirtyRef.current = false;
      setIsDirty(false);
      fetchSettings({ force: true });
    }
  };

  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [user]);


  const fetchSettings = async ({ force = false }: { force?: boolean } = {}) => {
    if (dirtyRef.current && !force) {
      return;
    }

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

    if (dirtyRef.current && !force) {
      return;
    }

    if (error) {
      console.error("Error fetching settings:", error);
    } else {
      const databaseSettings: InstagramSettingsState = {
        ig_user_id: data?.ig_user_id || "",
        page_id: data?.page_id || "",
        account_username: data?.account_username || "",
        access_token: data?.access_token || "",
        app_id: data?.app_id || "",
        app_secret: data?.app_secret || "",
        token_expires_at: data?.token_expires_at || null,
        renewal_webhook: webhookConfig?.config_value || "",
        notify_whatsapp: data?.notify_whatsapp || false,
        manager_numbers: (data?.manager_numbers as string[]) || [],
      };

      const draftKey = getDraftKey(user?.id);
      const draftRaw = user?.id ? localStorage.getItem(draftKey) : null;

      if (!force && draftRaw) {
        try {
          const draft = JSON.parse(draftRaw) as InstagramSettingsState;
          if (hasMeaningfulDraft(draft)) {
            settingsRef.current = draft;
            dirtyRef.current = true;
            setSettings(draft);
            setIsDirty(true);
            return;
          }
        } catch {
          localStorage.removeItem(draftKey);
        }
      }

      settingsRef.current = databaseSettings;
      dirtyRef.current = false;
      setSettings(databaseSettings);
      setIsDirty(false);
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

      // The function returns { error } in the body on non-2xx; surface that message
      const fnError = (data as { error?: string } | null)?.error;
      if (error || fnError) {
        throw new Error(fnError || (error as Error)?.message || "Falha ao chamar função");
      }

      toast({
        title: action === "debug" ? "Token Verificado" : "Token Renovado",
        description: action === "debug" 
          ? "Informações do token atualizadas." 
          : "Seu token foi renovado e as notificações enviadas.",
      });

      fetchSettings(); // Refresh UI
    } catch (error: unknown) {
      toast({
        title: "Erro na operação",
        description: getErrorMessage(error),
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

  const handleAddNumber = () => {
    if (newManagerNumber.trim()) {
      const next = {
        ...settings,
        manager_numbers: [...settings.manager_numbers, newManagerNumber.trim()]
      };
      markDirtySettings(next);
      setSettings(next);
      setNewManagerNumber("");
    }
  };

  const handleRemoveNumber = (index: number) => {
    const next = {
      ...settings,
      manager_numbers: settings.manager_numbers.filter((_, i) => i !== index)
    };
    markDirtySettings(next);
    setSettings(next);
  };

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
        notify_whatsapp: settings.notify_whatsapp,
        manager_numbers: settings.manager_numbers,
      }, { onConflict: 'user_id' });

      if (settingsError) throw settingsError;

      const { error: webhookError } = await supabase
        .from('billing_config')
        .upsert({
          config_key: 'instagram_renewal_webhook',
          config_value: settings.renewal_webhook
        }, { onConflict: 'config_key' });

      if (webhookError) throw webhookError;

      toast({
        title: "Sucesso!",
        description: "Configurações salvas.",
      });

      if (user?.id) {
        localStorage.removeItem(getDraftKey(user.id));
      }
      dirtyRef.current = false;
      setIsDirty(false);
      fetchSettings({ force: true });
    } catch (error: unknown) {
      toast({
        title: "Erro ao salvar",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="bg-muted p-1 mb-6">
          <TabsTrigger value="meta-api" className="gap-2">
            <ShieldCheck className="h-4 w-4" /> API Meta
          </TabsTrigger>
          <TabsTrigger value="ai-config" className="gap-2">
            <Sparkles className="h-4 w-4" /> Configurações IA
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" /> Notificações
          </TabsTrigger>
          <TabsTrigger value="help" className="gap-2">
            <Info className="h-4 w-4" /> Ajuda
          </TabsTrigger>
        </TabsList>

        <TabsContent value="meta-api">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2 border-primary/20 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-lg">
                    <ShieldCheck className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Credenciais da API Meta</CardTitle>
                    <CardDescription>
                      Configure a conexão oficial para agendar publicações.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <form autoComplete="off" onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-6">
                  {/* Honeypot fields to absorb browser autofill and prevent it from wiping real inputs */}
                  <input type="text" name="fake-user" autoComplete="username" tabIndex={-1} aria-hidden="true" className="hidden" />
                  <input type="password" name="fake-pass" autoComplete="new-password" tabIndex={-1} aria-hidden="true" className="hidden" />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="app_id">Meta App ID</Label>
                      <Input
                        id="app_id"
                        name="meta_app_id"
                        autoComplete="off"
                        placeholder="ID do seu App Meta"
                        value={settings.app_id}
                        onChange={(e) => updateField("app_id", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="app_secret">Meta App Secret</Label>
                      <Input
                        id="app_secret"
                        name="meta_app_secret"
                        type="text"
                        autoComplete="off"
                        data-lpignore="true"
                        data-1p-ignore="true"
                        data-form-type="other"
                        style={{ WebkitTextSecurity: "disc" } as React.CSSProperties}
                        placeholder="Secret do seu App Meta"
                        value={settings.app_secret}
                        onChange={(e) => updateField("app_secret", e.target.value)}
                      />
                    </div>
                  </div>


                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="ig_id">Instagram User ID (Obrigatório)</Label>
                      <Input
                        id="ig_id"
                        name="ig_user_id"
                        autoComplete="off"
                        placeholder="ID da conta Instagram Business"
                        value={settings.ig_user_id}
                        onChange={(e) => updateField("ig_user_id", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="page_id">Facebook Page ID (Opcional)</Label>
                      <Input
                        id="page_id"
                        name="fb_page_id"
                        autoComplete="off"
                        placeholder="ID da página vinculada"
                        value={settings.page_id}
                        onChange={(e) => updateField("page_id", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="username">@Username (Opcional)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-muted-foreground font-medium">@</span>
                      <Input
                        id="username"
                        name="ig_username"
                        autoComplete="off"
                        className="pl-8"
                        placeholder="seu_perfil"
                        value={settings.account_username}
                        onChange={(e) => updateField("account_username", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-border/50">
                    <Label htmlFor="token" className="text-base font-semibold">Meta Access Token</Label>
                    <div className="relative">
                      <Input
                        id="token"
                        name="meta_access_token"
                        type="text"
                        autoComplete="off"
                        data-lpignore="true"
                        data-1p-ignore="true"
                        data-form-type="other"
                        style={!showToken ? ({ WebkitTextSecurity: "disc" } as React.CSSProperties) : undefined}
                        placeholder="Token de acesso (long-lived)"
                        value={settings.access_token}
                        onChange={(e) => updateField("access_token", e.target.value)}
                        className="pr-12 h-11"
                      />
                      <button
                        type="button"
                        onClick={() => setShowToken(!showToken)}
                        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showToken ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>

                    {expirationStatus && (
                      <div className={cn(
                        "flex items-center gap-3 p-4 rounded-xl border-2 transition-all",
                        expirationStatus.isExpired 
                          ? "bg-red-50/50 border-red-200 text-red-700 dark:bg-red-900/10 dark:border-red-800" 
                          : expirationStatus.isWarning 
                          ? "bg-amber-50/50 border-amber-200 text-amber-700 dark:bg-amber-900/10 dark:border-amber-800"
                          : "bg-green-50/50 border-green-200 text-green-700 dark:bg-green-900/10 dark:border-green-800"
                      )}>
                        {expirationStatus.isExpired ? (
                          <AlertTriangle className="h-6 w-6 shrink-0" />
                        ) : expirationStatus.isWarning ? (
                          <Info className="h-6 w-6 shrink-0" />
                        ) : (
                          <CheckCircle2 className="h-6 w-6 shrink-0" />
                        )}
                        <div className="flex-1 text-sm">
                          <p className="font-bold text-base">
                            {expirationStatus.isExpired ? "Token Expirado" : "Validade do Token"}
                          </p>
                          <p className="opacity-90">Expira em: {expirationStatus.date}</p>
                        </div>
                        {!expirationStatus.isExpired && (
                          <Button 
                            type="button"
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleTokenAction("refresh")}
                            disabled={loading}
                            className="bg-background/50 hover:bg-background border-current"
                          >
                            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
                            Renovar Agora
                          </Button>
                        )}
                      </div>
                    )}

                    {settings.access_token && !expirationStatus && (
                      <Button 
                        type="button"
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleTokenAction("debug")}
                        disabled={loading}
                        className="w-full h-11 border-dashed"
                      >
                        <ShieldCheck className="h-4 w-4 mr-2" />
                        Verificar Validade do Token
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-4 border-t border-border/50">
                    {isDirty ? (
                      <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-500 font-medium">
                        <AlertTriangle className="h-4 w-4" />
                        Você tem alterações não salvas
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        Tudo salvo
                      </div>
                    )}
                    <Button type="submit" disabled={loading || !isDirty} className="px-8 h-11 shadow-lg shadow-primary/20">
                      {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                      Salvar Configurações
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <div className="space-y-6">
               <Card className="bg-primary/5 border-primary/10">
                <CardHeader>
                  <CardTitle className="text-sm uppercase tracking-wider text-primary font-bold">Status da Conexão</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">App Meta:</span>
                    <Badge variant={settings.app_id ? "outline" : "secondary"}>
                      {settings.app_id ? "Configurado" : "Pendente"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Token:</span>
                    <Badge variant={settings.access_token ? "outline" : "secondary"}>
                      {settings.access_token ? "Ativo" : "Ausente"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Instagram ID:</span>
                    <Badge variant={settings.ig_user_id ? "outline" : "secondary"}>
                      {settings.ig_user_id ? "Vínculo OK" : "Pendente"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="ai-config">
          <Card className="border-primary/20 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-lg">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">Configurações de IA</CardTitle>
                  <CardDescription>
                    O sistema utiliza a **Lovable AI Gateway** por padrão. Não é necessário configurar chaves individuais da OpenAI ou xAI (Grok) manualmente aqui, pois elas são gerenciadas pela infraestrutura do projeto.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg border border-dashed text-sm text-muted-foreground">
                <p><strong>Observação:</strong> Ao selecionar modelos como GPT-4o ou Grok no módulo de criação, as requisições são roteadas automaticamente. Certifique-se apenas de que seu projeto tem créditos disponíveis no Lovable.</p>
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-primary/5 border border-primary/10">
                <div className="space-y-1">
                  <p className="font-bold">Modelagem de Imagem (Vision)</p>
                  <p className="text-xs text-muted-foreground">Os modelos Grok 2 Vision e GPT-4o suportam análise de imagem de referência.</p>
                </div>
                <Badge variant="outline" className="border-primary/30 text-primary">Ativo</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-green-500/20 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-green-500/10 p-2 rounded-lg">
                      <MessageSquare className="h-6 w-6 text-green-500" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Confirmações via WhatsApp</CardTitle>
                      <CardDescription>Notifique gestores sobre a renovação do token.</CardDescription>
                    </div>
                  </div>
                  <Switch 
                    checked={settings.notify_whatsapp} 
                    onCheckedChange={(v) => updateField("notify_whatsapp", v)} 
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <Label>Números dos Gestores</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Ex: 5511999998888"
                      value={newManagerNumber}
                      onChange={(e) => setNewManagerNumber(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddNumber()}
                    />
                    <Button variant="outline" size="icon" onClick={handleAddNumber}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-2">
                    {settings.manager_numbers.map((num, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
                        <span className="font-mono text-sm">{num}</span>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveNumber(i)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {settings.manager_numbers.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4 italic border border-dashed rounded-lg">
                        Nenhum número cadastrado.
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex justify-end pt-4">
                  <Button onClick={handleSave} disabled={loading}>
                    <Save className="h-4 w-4 mr-2" /> Salvar WhatsApp
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-lg">
                    <Webhook className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Integração Webhook (n8n)</CardTitle>
                    <CardDescription>Envie o novo token para automações externas.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="webhook">URL do Webhook</Label>
                  <Input
                    id="webhook"
                    placeholder="https://seu-n8n.com/webhook/..."
                    value={settings.renewal_webhook}
                    onChange={(e) => updateField("renewal_webhook", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground leading-relaxed italic">
                    Sempre que você clicar em "Renovar", enviaremos um POST com o novo token, data de expiração e usuário.
                  </p>
                </div>
                <div className="flex justify-end pt-4">
                  <Button onClick={handleSave} disabled={loading}>
                    <Save className="h-4 w-4 mr-2" /> Salvar Webhook
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="help">
          <Card className="bg-muted/30 border-dashed">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="bg-muted p-2 rounded-lg">
                  <Info className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-xl">Como configurar seu App</CardTitle>
                  <CardDescription>Passo a passo para obter as credenciais na Meta.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="text-sm space-y-6">
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h4 className="font-bold text-primary flex items-center gap-2">
                    <div className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px]">1</div>
                    Portal de Desenvolvedores
                  </h4>
                  <p className="text-muted-foreground">
                    Acesse o <a href="https://developers.facebook.com/" target="_blank" rel="noreferrer" className="text-primary hover:underline font-bold">Meta for Developers</a> e crie um App do tipo <strong>"Business"</strong>.
                  </p>
                </div>
                <div className="space-y-4">
                  <h4 className="font-bold text-primary flex items-center gap-2">
                    <div className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px]">2</div>
                    Adicionar Produtos
                  </h4>
                  <p className="text-muted-foreground">
                    Dentro do App, adicione o produto <strong>"Instagram Graph API"</strong> e configure o login do Facebook.
                  </p>
                </div>
                <div className="space-y-4">
                  <h4 className="font-bold text-primary flex items-center gap-2">
                    <div className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px]">3</div>
                    Gerar Token de Longa Duração
                  </h4>
                  <p className="text-muted-foreground">
                    Use o <strong>Explorador da API Graph</strong> para gerar um token de sistema ou de usuário e troque-o por um token de 60 dias.
                  </p>
                </div>
                <div className="space-y-4">
                  <h4 className="font-bold text-primary flex items-center gap-2">
                    <div className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px]">4</div>
                    Vínculo de Contas
                  </h4>
                  <p className="text-muted-foreground">
                    Sua conta do Instagram deve ser <strong>Business</strong> e estar vinculada a uma Página do Facebook que você administra.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={pendingTab !== null} onOpenChange={(open) => !open && setPendingTab(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair sem salvar?</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem alterações não salvas nesta aba. Se sair agora, todas as mudanças serão descartadas e não serão refletidas no banco de dados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDiscardAndChangeTab}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Descartar alterações
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default InstagramSettings;
