import React, { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Instagram, History, Settings, Sparkles, Link as LinkIcon, Plus, Copy, Trash2, Clock, Check, X } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { useSiteUrl } from "@/hooks/useSiteUrl";
import { format, addHours, addDays } from "date-fns";
import { copyToClipboard } from "@/utils/clipboard";
import InstagramCreate from "./InstagramCreate";
import InstagramHistory from "./InstagramHistory";
import InstagramSettings from "./InstagramSettings";

const InstagramModule = () => {
  const { 
    canViewInstagram, 
    canCreateInstagramPost, 
    canManageInstagramSettings, 
    canViewInstagramHistory,
    canManageTemporaryAccess
  } = usePermissions();

  const siteUrl = useSiteUrl();

  const [isAccessDialogOpen, setIsAccessDialogOpen] = useState(false);
  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false);
  const [generatedLink, setGeneratedLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [tokens, setTokens] = useState<any[]>([]);
  const [newAccess, setNewAccess] = useState({
    duration: "4",
    max_uses: "1",
  });

  useEffect(() => {
    if (canManageTemporaryAccess()) {
      fetchTokens();
    }
  }, [canManageTemporaryAccess]);

  const fetchTokens = async () => {
    const { data, error } = await supabase
      .from("temporary_access_tokens")
      .select("*")
      .eq("target_path", "/instagram")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching tokens:", error);
    } else {
      setTokens(data || []);
    }
  };

  const createTemporaryLink = async () => {
    setLoading(true);
    try {
      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const expiresAt = addHours(new Date(), parseInt(newAccess.duration)).toISOString();
      
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from("temporary_access_tokens").insert({
        created_by: user?.id,
        token,
        target_path: "/instagram",
        expires_at: expiresAt,
        max_uses: parseInt(newAccess.max_uses),
      });

      if (error) throw error;

      toast.success("Link de acesso provisório criado!");
      fetchTokens();
      setIsAccessDialogOpen(false);
    } catch (error: any) {
      toast.error("Erro ao criar link: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteToken = async (id: string) => {
    const { error } = await supabase.from("temporary_access_tokens").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir link");
    } else {
      toast.success("Link excluído");
      fetchTokens();
    }
  };

  const copyLink = (token: string) => {
    const url = `${siteUrl}/access/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado para a área de transferência!");
  };

  if (!canViewInstagram()) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
          <div className="bg-red-100 p-4 rounded-full dark:bg-red-900/20">
            <X className="h-12 w-12 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold">Acesso Negado</h1>
          <p className="text-muted-foreground">Você não tem permissão para acessar este módulo.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 max-w-7xl space-y-6">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-pink-100 p-3 rounded-xl dark:bg-pink-900/30">
              <Instagram className="h-8 w-8 text-pink-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Módulo Instagram</h1>
              <p className="text-muted-foreground">Gerencie suas publicações, histórico e configurações.</p>
            </div>
          </div>

          {canManageTemporaryAccess() && (
            <Dialog open={isAccessDialogOpen} onOpenChange={setIsAccessDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <LinkIcon className="h-4 w-4" /> Acesso Provisório
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Gerar Link Provisório</DialogTitle>
                  <DialogDescription>
                    Crie um link de acesso que expira automaticamente para um assistente.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Duração do Acesso (Horas)</Label>
                    <Select 
                      value={newAccess.duration} 
                      onValueChange={(v) => setNewAccess({...newAccess, duration: v})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a duração" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 hora</SelectItem>
                        <SelectItem value="4">4 horas</SelectItem>
                        <SelectItem value="12">12 horas</SelectItem>
                        <SelectItem value="24">24 horas</SelectItem>
                        <SelectItem value="168">7 dias</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Limite de Usos</Label>
                    <Input 
                      type="number" 
                      value={newAccess.max_uses} 
                      onChange={(e) => setNewAccess({...newAccess, max_uses: e.target.value})}
                    />
                  </div>

                  <div className="pt-4 space-y-2">
                    <Label className="text-xs uppercase text-muted-foreground">Links Ativos</Label>
                    <div className="max-h-40 overflow-y-auto space-y-2">
                      {tokens.map(t => (
                        <div key={t.id} className="flex items-center justify-between p-2 rounded bg-muted text-sm">
                          <div className="truncate flex-1 mr-2">
                            <p className="font-mono text-xs">...{t.token.substring(t.token.length - 8)}</p>
                            <p className="text-[10px] text-muted-foreground">Expira: {format(new Date(t.expires_at), "dd/MM HH:mm")}</p>
                          </div>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyLink(t.token)}>
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteToken(t.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {tokens.length === 0 && <p className="text-xs text-center py-2 text-muted-foreground">Nenhum link ativo.</p>}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setIsAccessDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={createTemporaryLink} disabled={loading}>
                    {loading ? "Gerando..." : "Gerar Link"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <Tabs defaultValue="create" className="space-y-6">
          <TabsList className="bg-muted p-1">
            {canCreateInstagramPost() && (
              <TabsTrigger value="create" className="gap-2">
                <Sparkles className="h-4 w-4" /> Criar Post
              </TabsTrigger>
            )}
            {canViewInstagramHistory() && (
              <TabsTrigger value="history" className="gap-2">
                <History className="h-4 w-4" /> Histórico
              </TabsTrigger>
            )}
            {canManageInstagramSettings() && (
              <TabsTrigger value="settings" className="gap-2">
                <Settings className="h-4 w-4" /> Configurações
              </TabsTrigger>
            )}
          </TabsList>
          
          <TabsContent value="create">
            <InstagramCreate />
          </TabsContent>
          <TabsContent value="history">
            <InstagramHistory />
          </TabsContent>
          <TabsContent value="settings">
            <InstagramSettings />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default InstagramModule;
