import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Instagram, Save, Eye, EyeOff, ShieldCheck, RefreshCw, AlertTriangle, CheckCircle2, Info } from "lucide-react";
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

    if (error) {
      console.error("Error fetching settings:", error);
    } else if (data) {
      setSettings({
        ig_user_id: data.ig_user_id || "",
        page_id: data.page_id || "",
        account_username: data.account_username || "",
        access_token: data.access_token || "",
      });
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.from("instagram_settings").upsert({
        user_id: user?.id,
        ...settings,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Configurações do Instagram salvas.",
      });
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
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-pink-100 p-3 rounded-xl dark:bg-pink-900/30">
          <Instagram className="h-8 w-8 text-pink-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Configurações Instagram</h2>
          <p className="text-muted-foreground">Vincule sua conta Instagram Business para agendar publicações.</p>
        </div>
      </div>

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
