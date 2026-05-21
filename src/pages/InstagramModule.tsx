import React, { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Instagram, History, Settings, Sparkles, Link as LinkIcon, Plus, Copy, Trash2, Clock, Check, X, Zap, Loader2, Eye, BarChart3 } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
// Removed unused Select imports
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
import InstagramAutoReply from "./InstagramAutoReply";
import InstagramEspionage from "./InstagramEspionage";
import InstagramClientReports from "./InstagramClientReports";

const InstagramModule = () => {
  const { 
    canViewInstagram, 
    canCreateInstagramPost, 
    canManageInstagramSettings, 
    canViewInstagramHistory,
    canManageInstagramEspionage,
    canManageTemporaryAccess,
  } = usePermissions();

  const isTempAccess = !!sessionStorage.getItem("temp_access_token");
  const [tempAccessData, setTempAccessData] = useState<{ permissions?: string[] } | null>(null);
  const [tempAccessLoading, setTempAccessLoading] = useState(isTempAccess);
  const [activeInstagramTab, setActiveInstagramTab] = useState("none");

  useEffect(() => {
    if (!isTempAccess) {
      setTempAccessLoading(false);
      return;
    }

    const loadTemporaryPermissions = async () => {
      const token = sessionStorage.getItem("temp_access_token");
      if (!token) {
        setTempAccessData(null);
        setTempAccessLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("temporary_access_tokens")
        .select("permissions")
        .eq("token", token)
        .eq("is_active", true)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (error) {
        console.error("Error loading temporary permissions:", error);
      }

      setTempAccessData(data || null);
      setTempAccessLoading(false);
    };

    loadTemporaryPermissions();
    const interval = window.setInterval(loadTemporaryPermissions, 1500);
    window.addEventListener("focus", loadTemporaryPermissions);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", loadTemporaryPermissions);
    };
  }, [isTempAccess]);

  const hasPermission = (permission: string) => {
    if (!isTempAccess) return true;
    return tempAccessData?.permissions?.includes(permission);
  };

  // Force permissions for temporary access
  const effectiveCanViewInstagram = canViewInstagram() || isTempAccess;
  const effectiveCanCreatePost = canCreateInstagramPost() || (isTempAccess && hasPermission("create"));
  const effectiveCanManageAutoReply = isTempAccess ? hasPermission("autoreply") : true; 
  const effectiveCanViewHistory = canViewInstagramHistory() || (isTempAccess && hasPermission("history"));
  const effectiveCanManageEspionage = isTempAccess ? hasPermission("espionage") : canManageInstagramEspionage();
  const effectiveCanManageReports = isTempAccess ? hasPermission("reports") : true;
  const effectiveCanManageSettings = isTempAccess ? false : canManageInstagramSettings();
  const effectiveCanManageTempAccess = isTempAccess ? false : canManageTemporaryAccess();
  const firstAllowedTab = effectiveCanCreatePost ? "create" : 
    effectiveCanManageAutoReply ? "autoreply" : 
    effectiveCanViewHistory ? "history" : 
    effectiveCanManageEspionage ? "espionage" :
    effectiveCanManageReports ? "reports" :
    effectiveCanManageSettings ? "settings" : "none";
  const allowedInstagramTabs = [
    effectiveCanCreatePost && "create",
    effectiveCanManageAutoReply && "autoreply",
    effectiveCanViewHistory && "history",
    effectiveCanManageEspionage && "espionage",
    effectiveCanManageReports && "reports",
    effectiveCanManageSettings && "settings",
  ].filter(Boolean) as string[];
  const selectedInstagramTab = allowedInstagramTabs.includes(activeInstagramTab) ? activeInstagramTab : firstAllowedTab;

  useEffect(() => {
    if (!allowedInstagramTabs.includes(activeInstagramTab)) {
      setActiveInstagramTab(firstAllowedTab);
    }
  }, [activeInstagramTab, firstAllowedTab, allowedInstagramTabs]);

  const siteUrl = useSiteUrl();

  const [accessStep, setAccessStep] = useState<"initial" | "success">("initial");
  const [isAccessDialogOpen, setIsAccessDialogOpen] = useState(false);
  const [generatedLink, setGeneratedLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [tokens, setTokens] = useState<any[]>([]);
  const [editingToken, setEditingToken] = useState<any | null>(null);
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [newAccess, setNewAccess] = useState({
    duration: "4",
    max_uses: "1",
    permissions: ["create", "history"] as string[],
  });

  const PERMISSION_OPTIONS = [
    { id: "create", label: "Criar Post" },
    { id: "autoreply", label: "Auto-Resposta" },
    { id: "history", label: "Histórico" },
    { id: "espionage", label: "Espionagem" },
    { id: "reports", label: "Relatórios Clientes" },
  ];

  const updateTokenPermissions = async () => {
    if (!editingToken) return;
    const { error } = await supabase
      .from("temporary_access_tokens")
      .update({ permissions: editPermissions })
      .eq("id", editingToken.id);
    if (error) {
      toast.error("Erro ao atualizar permissões");
    } else {
      toast.success("Permissões atualizadas!");
      setEditingToken(null);
      fetchTokens();
    }
  };

  useEffect(() => {
    if (effectiveCanManageTempAccess) {
      fetchTokens();
    }
  }, [effectiveCanManageTempAccess]);

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
        permissions: newAccess.permissions,
      });

      if (error) throw error;

      const fullUrl = `${siteUrl}/access/${token}`;
      setGeneratedLink(fullUrl);
      setAccessStep("success");
      fetchTokens();
      fetchTokens();
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
    copyToClipboard(url);
    toast.success("Link copiado!");
  };

  const Wrapper = React.useMemo(() => {
    return ({ children }: { children: React.ReactNode }) =>
      isTempAccess ? (
        <div className="min-h-screen bg-background">
          <div className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/30">
            <div className="container mx-auto max-w-7xl flex items-center justify-between px-6 py-3">
              <div className="flex items-center gap-2">
                <Instagram className="h-5 w-5 text-pink-600" />
                <span className="font-semibold">Módulo Instagram</span>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                <Clock className="h-3 w-3" /> Acesso Provisório
              </span>
            </div>
          </div>
          {children}
        </div>
      ) : (
        <DashboardLayout>{children}</DashboardLayout>
      );
  }, [isTempAccess]);

  if (!effectiveCanViewInstagram) {
    return (
      <Wrapper>
        <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
          <div className="bg-red-100 p-4 rounded-full dark:bg-red-900/20">
            <X className="h-12 w-12 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold">Acesso Negado</h1>
          <p className="text-muted-foreground">Você não tem permissão para acessar este módulo.</p>
        </div>
      </Wrapper>
    );
  }

  if (isTempAccess && tempAccessLoading) {
    return (
      <Wrapper>
        <div className="flex flex-col items-center justify-center h-[60vh] space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando permissões do acesso provisório...</p>
        </div>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
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

          {effectiveCanManageTempAccess && (
            <Dialog 
              open={isAccessDialogOpen} 
              onOpenChange={(open) => {
                if (!open) {
                  setIsAccessDialogOpen(false);
                  setTimeout(() => setAccessStep("initial"), 300);
                } else {
                  setIsAccessDialogOpen(true);
                }
              }}
              modal={true}
            >
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <LinkIcon className="h-4 w-4" /> Acesso Provisório
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
                {accessStep === "initial" ? (
                  <>
                    <DialogHeader>
                      <DialogTitle>Gerar Link Provisório</DialogTitle>
                      <DialogDescription>
                        Crie um link de acesso que expira automaticamente para um assistente.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                    <Label>Duração do Acesso (Horas)</Label>
                    <select 
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={newAccess.duration} 
                      onChange={(e) => setNewAccess(prev => ({...prev, duration: e.target.value}))}
                    >
                      <option value="1">1 hora</option>
                      <option value="4">4 horas</option>
                      <option value="12">12 horas</option>
                      <option value="24">24 horas</option>
                      <option value="168">7 dias</option>
                      <option value="480">20 dias</option>
                    </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Permissões</Label>
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          {[
                            { id: "create", label: "Criar Post" },
                            { id: "autoreply", label: "Auto-Resposta" },
                            { id: "history", label: "Histórico" },
                            { id: "espionage", label: "Espionagem" },
                            { id: "reports", label: "Relatórios Clientes" },
                          ].map((p) => (
                            <div key={p.id} className="flex items-center space-x-2">
                              <input 
                                type="checkbox"
                                id={`perm-${p.id}`}
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                checked={newAccess.permissions.includes(p.id)}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setNewAccess(prev => ({
                                    ...prev,
                                    permissions: checked 
                                      ? [...prev.permissions, p.id]
                                      : prev.permissions.filter(x => x !== p.id)
                                  }));
                                }}
                              />
                              <label htmlFor={`perm-${p.id}`} className="text-sm font-medium leading-none cursor-pointer">
                                {p.label}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Limite de Usos</Label>
                        <Input 
                          type="number" 
                          value={newAccess.max_uses} 
                          onChange={(e) => setNewAccess(prev => ({...prev, max_uses: e.target.value}))}
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Define quantas vezes o link pode ser usado antes de expirar (ex: 1 = uso único).
                        </p>
                      </div>

                      <div className="pt-4 space-y-2">
                        <Label className="text-xs uppercase text-muted-foreground">Links Ativos</Label>
                        <div className="max-h-40 overflow-y-auto space-y-2">
                          {tokens.map(t => (
                            <div key={t.id} className="flex items-center justify-between p-2 rounded bg-muted text-sm">
                              <div className="truncate flex-1 mr-2">
                                <p className="font-mono text-xs">...{t.token.substring(t.token.length - 8)}</p>
                                <p className="text-[10px] text-muted-foreground">Expira: {format(new Date(t.expires_at), "dd/MM HH:mm")}</p>
                                <p className="text-[10px] text-muted-foreground truncate">
                                  Permissões: {(t.permissions || []).map((p: string) => PERMISSION_OPTIONS.find(o => o.id === p)?.label || p).join(", ") || "—"}
                                </p>
                              </div>
                              <div className="flex gap-1">
                                <Button size="icon" variant="ghost" className="h-7 w-7" title="Editar permissões" onClick={() => { setEditingToken(t); setEditPermissions(t.permissions || []); }}>
                                  <Settings className="h-3.5 w-3.5" />
                                </Button>
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
                  </>
                ) : (
                  <>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Check className="h-5 w-5 text-green-500" />
                        Link Gerado!
                      </DialogTitle>
                      <DialogDescription>
                        O link de acesso provisório está pronto. Copie e envie para o assistente.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="flex items-center space-x-2 py-4">
                      <div className="grid flex-1 gap-2">
                        <Label htmlFor="link" className="sr-only">Link</Label>
                        <Input
                          id="link"
                          defaultValue={generatedLink}
                          readOnly
                          className="font-mono text-xs"
                        />
                      </div>
                      <Button size="sm" className="px-3" onClick={() => {
                        copyToClipboard(generatedLink);
                        toast.success("Link copiado!");
                      }}>
                        <Copy className="h-4 w-4 mr-2" />
                        Copiar
                      </Button>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="secondary" onClick={() => setIsAccessDialogOpen(false)}>
                        Fechar
                      </Button>
                    </DialogFooter>
                  </>
                )}
              </DialogContent>
            </Dialog>
          )}
        </div>

        <Tabs 
          value={selectedInstagramTab}
          onValueChange={setActiveInstagramTab}
          className="space-y-6"
        >
          <TabsList className="bg-muted p-1">
            {effectiveCanCreatePost && (
              <TabsTrigger value="create" className="gap-2">
                <Sparkles className="h-4 w-4" /> Criar Post
              </TabsTrigger>
            )}
            {effectiveCanManageAutoReply && (
              <TabsTrigger value="autoreply" className="gap-2">
                <Zap className="h-4 w-4" /> Auto-Resposta
              </TabsTrigger>
            )}
            {effectiveCanViewHistory && (
              <TabsTrigger value="history" className="gap-2">
                <History className="h-4 w-4" /> Histórico
              </TabsTrigger>
            )}
            {effectiveCanManageEspionage && (
              <TabsTrigger value="espionage" className="gap-2">
                <Eye className="h-4 w-4" /> Espionagem
              </TabsTrigger>
            )}
            {effectiveCanManageReports && (
              <TabsTrigger value="reports" className="gap-2">
                <BarChart3 className="h-4 w-4" /> Relatórios Clientes
              </TabsTrigger>
            )}
            {effectiveCanManageSettings && (
              <TabsTrigger value="settings" className="gap-2">
                <Settings className="h-4 w-4" /> Configurações
              </TabsTrigger>
            )}
          </TabsList>
          
          {effectiveCanCreatePost && (
            <TabsContent value="create">
              <InstagramCreate />
            </TabsContent>
          )}
          {effectiveCanManageAutoReply && (
            <TabsContent value="autoreply">
              <InstagramAutoReply isTemporaryAccess={isTempAccess} />
            </TabsContent>
          )}
          {effectiveCanViewHistory && (
            <TabsContent value="history">
              <InstagramHistory />
            </TabsContent>
          )}
          {effectiveCanManageEspionage && (
            <TabsContent value="espionage">
              <InstagramEspionage />
            </TabsContent>
          )}
          {effectiveCanManageReports && (
            <TabsContent value="reports">
              <InstagramClientReports />
            </TabsContent>
          )}
          {effectiveCanManageSettings && (
            <TabsContent value="settings">
              <InstagramSettings />
            </TabsContent>
          )}
        </Tabs>
      </div>

      <Dialog open={!!editingToken} onOpenChange={(open) => !open && setEditingToken(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Permissões do Link</DialogTitle>
            <DialogDescription>
              Ajuste o que esse acesso provisório pode ver. As mudanças valem na hora.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Permissões</Label>
            <div className="grid grid-cols-2 gap-2 pt-1">
              {PERMISSION_OPTIONS.map((p) => (
                <div key={p.id} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={`edit-perm-${p.id}`}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    checked={editPermissions.includes(p.id)}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setEditPermissions((prev) =>
                        checked ? [...prev, p.id] : prev.filter((x) => x !== p.id)
                      );
                    }}
                  />
                  <label htmlFor={`edit-perm-${p.id}`} className="text-sm font-medium leading-none cursor-pointer">
                    {p.label}
                  </label>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingToken(null)}>Cancelar</Button>
            <Button onClick={updateTokenPermissions}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Wrapper>
  );
};

export default InstagramModule;
