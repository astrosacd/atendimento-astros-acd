import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Settings2, 
  History, 
  Trash2, 
  MessageSquare, 
  Mail, 
  Zap, 
  AlertCircle, 
  CheckCircle2, 
  Info,
  ChevronRight,
  Filter,
  RefreshCw,
  Copy,
  ExternalLink
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import InstagramMediaSelector from "@/components/instagram/InstagramMediaSelector";

interface InstagramAutoReplyProps {
  isTemporaryAccess?: boolean;
}

const InstagramAutoReply = ({ isTemporaryAccess = false }: InstagramAutoReplyProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [historyFilter, setHistoryFilter] = useState<"all" | "sent" | "blocked" | "error">("all");
  const [activeTab, setActiveTab] = useState("rules");

  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false);
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [isMediaSelectorOpen, setIsMediaSelectorOpen] = useState(false);
  
  const [globalSettings, setGlobalSettings] = useState({
    auto_reply_enabled: false,
    webhook_verify_token: "",
  });

  const [currentRule, setCurrentRule] = useState<any>({
    name: "",
    active: true,
    keywords: [] as string[],
    public_response: "",
    dm_response: "",
    non_follower_response: "",
    media_type: "all",
    follower_only: false,
    specific_media_id: "",
    cooldown_seconds: 3600,
    max_per_user_per_day: 3,
    blacklist_keywords: [] as string[],
    blacklist_usernames: [] as string[],
  });

  const [newKeyword, setNewKeyword] = useState("");
  const [newBlacklistKw, setNewBlacklistKw] = useState("");
  const [newBlacklistUser, setNewBlacklistUser] = useState("");

  useEffect(() => {
    if (user) {
      fetchRules();
      fetchHistory();
      fetchSettings();
    }
  }, [user]);

  const fetchRules = async () => {
    const { data, error } = await supabase
      .from("ig_auto_reply_rules")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Erro", description: "Falha ao carregar regras.", variant: "destructive" });
    } else {
      setRules(data || []);
    }
  };

  const fetchHistory = async () => {
    const { data, error } = await supabase
      .from("ig_auto_reply_history")
      .select("*, ig_auto_reply_rules(name)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error fetching history:", error);
    } else {
      setHistory(data || []);
    }
  };

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from("instagram_settings")
      .select("auto_reply_enabled, webhook_verify_token")
      .eq("user_id", user?.id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching settings:", error);
    } else if (data) {
      setGlobalSettings({
        auto_reply_enabled: data.auto_reply_enabled || false,
        webhook_verify_token: data.webhook_verify_token || "",
      });
    }
  };

  const handleToggleGlobal = async (enabled: boolean) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("instagram_settings")
        .update({ auto_reply_enabled: enabled })
        .eq("user_id", user?.id);

      if (error) throw error;
      setGlobalSettings(prev => ({ ...prev, auto_reply_enabled: enabled }));
      toast({ title: enabled ? "Auto-resposta ativada!" : "Auto-resposta desativada!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("instagram_settings")
        .update({ 
          webhook_verify_token: globalSettings.webhook_verify_token,
          auto_reply_enabled: globalSettings.auto_reply_enabled 
        })
        .eq("user_id", user?.id);

      if (error) throw error;
      toast({ title: "Configurações salvas!" });
      setIsConfigDialogOpen(false);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRule = async () => {
    if (!currentRule.name) {
      toast({ title: "Erro", description: "Dê um nome para a regra.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...currentRule,
        user_id: user?.id,
      };

      let error;
      if (currentRule.id) {
        const { error: err } = await supabase
          .from("ig_auto_reply_rules")
          .update(payload)
          .eq("id", currentRule.id);
        error = err;
      } else {
        const { error: err } = await supabase
          .from("ig_auto_reply_rules")
          .insert(payload);
        error = err;
      }

      if (error) throw error;
      
      toast({ title: currentRule.id ? "Regra atualizada!" : "Regra criada!" });
      setIsRuleDialogOpen(false);
      fetchRules();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta regra?")) return;
    
    try {
      const { error } = await supabase.from("ig_auto_reply_rules").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Regra excluída." });
      fetchRules();
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    }
  };

  const addKeyword = () => {
    if (newKeyword.trim()) {
      setCurrentRule((prev: any) => ({
        ...prev,
        keywords: [...(prev.keywords || []), newKeyword.trim()]
      }));
      setNewKeyword("");
    }
  };

  const removeKeyword = (idx: number) => {
    setCurrentRule((prev: any) => ({
      ...prev,
      keywords: prev.keywords.filter((_: any, i: number) => i !== idx)
    }));
  };

  const generateVerifyToken = () => {
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    setGlobalSettings(prev => ({ ...prev, webhook_verify_token: token }));
  };

  const webhookUrl = `https://udxaxemoozddkwpitngq.supabase.co/functions/v1/instagram-comment-webhook`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6 text-yellow-500" />
            Auto-Resposta Instagram
          </h2>
          <p className="text-muted-foreground">Responda comentários e envie DMs automaticamente.</p>
        </div>
        <div className="flex items-center gap-3">
          <div 
            className={cn(
              "flex items-center gap-2.5 px-3.5 py-2 rounded-full border-2 transition-all cursor-pointer",
              globalSettings.auto_reply_enabled 
                ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800" 
                : "bg-muted border-border"
            )}
            title={globalSettings.auto_reply_enabled 
              ? "Auto-resposta LIGADA: o sistema está respondendo comentários automaticamente. Clique para pausar." 
              : "Auto-resposta PAUSADA: nenhuma regra está rodando. Clique para ligar."}
          >
            <Switch 
              checked={globalSettings.auto_reply_enabled} 
              onCheckedChange={handleToggleGlobal} 
              disabled={loading}
            />
            <span className={cn(
              "text-xs font-bold uppercase tracking-wider",
              globalSettings.auto_reply_enabled ? "text-green-700 dark:text-green-400" : "text-muted-foreground"
            )}>
              {globalSettings.auto_reply_enabled ? "Ativo" : "Pausado"}
            </span>
          </div>
          {!isTemporaryAccess && (
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => setIsConfigDialogOpen(true)}
              title="Configurações de Webhook"
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          )}
          <Button 
            className="bg-gradient-to-r from-pink-500 to-orange-500 hover:opacity-90 border-none text-white shadow-md"
            onClick={() => {
              setCurrentRule({
                name: "",
                active: true,
                keywords: [],
                public_response: "",
                dm_response: "",
                media_type: "all",
                follower_only: false,
                specific_media_id: "",
                non_follower_response: "",
                cooldown_seconds: 3600,
                max_per_user_per_day: 3,
                blacklist_keywords: [],
                blacklist_usernames: [],
              });
              setIsMediaSelectorOpen(false);
              setIsRuleDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" /> Nova Regra
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="rules" className="gap-2">
            <Zap className="h-4 w-4" /> Regras
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" /> Histórico de Respostas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-4">
          {rules.length === 0 ? (
            <div className="text-center py-20 bg-muted/20 rounded-xl border-2 border-dashed">
              <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
              <p className="text-muted-foreground">Nenhuma regra configurada ainda.</p>
              <Button variant="link" onClick={() => setIsRuleDialogOpen(true)}>Crie sua primeira regra</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rules.map((rule) => (
                <Card key={rule.id} className={cn("relative overflow-hidden transition-all hover:shadow-md", !rule.active && "opacity-60")}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant={rule.active ? "default" : "secondary"}>
                        {rule.active ? "Ativa" : "Inativa"}
                      </Badge>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                          setCurrentRule(rule);
                          setIsMediaSelectorOpen(!!rule.specific_media_id);
                          setIsRuleDialogOpen(true);
                        }}>
                          <Settings2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteRule(rule.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <CardTitle className="text-lg">{rule.name}</CardTitle>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {rule.specific_media_id && (
                        <Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-700 border-blue-100">
                          Post Específico
                        </Badge>
                      )}
                      {rule.keywords?.map((kw: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-[10px] bg-muted/50">
                          "{kw}"
                        </Badge>
                      ))}
                      {(!rule.keywords || rule.keywords.length === 0) && (
                        <Badge variant="outline" className="text-[10px] italic">Qualquer comentário</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      {rule.public_response && (
                        <div className="flex items-start gap-2 text-xs">
                          <MessageSquare className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                          <p className="line-clamp-2 text-muted-foreground">
                            <span className="font-semibold text-foreground">Comentário:</span> {rule.public_response}
                          </p>
                        </div>
                      )}
                      {rule.dm_response && (
                        <div className="flex items-start gap-2 text-xs">
                          <Mail className="h-3.5 w-3.5 text-pink-500 shrink-0 mt-0.5" />
                          <p className="line-clamp-2 text-muted-foreground">
                            <span className="font-semibold text-foreground">DM:</span> {rule.dm_response}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Histórico Recente</CardTitle>
                <CardDescription>Últimas 50 interações automáticas.</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={fetchHistory}>
                <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] w-full">
                <div className="space-y-4">
                  {history.length === 0 ? (
                    <p className="text-center py-10 text-muted-foreground italic">Nenhuma interação registrada.</p>
                  ) : (
                    history.map((h) => (
                      <div key={h.id} className="flex items-start gap-4 p-3 rounded-lg border bg-card/50">
                        <div className={cn(
                          "p-2 rounded-full",
                          h.error_message ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"
                        )}>
                          {h.error_message ? <AlertCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="font-semibold text-sm">
                              @{h.ig_username || "Usuário"} <span className="font-normal text-muted-foreground ml-2 text-xs">{format(new Date(h.created_at), "dd/MM HH:mm")}</span>
                            </p>
                            {h.ig_auto_reply_rules && (
                              <Badge variant="outline" className="text-[10px]">{h.ig_auto_reply_rules.name}</Badge>
                            )}
                          </div>
                          <p className="text-sm italic text-muted-foreground mb-2">"{h.comment_text}"</p>
                          <div className="flex flex-wrap gap-3 text-xs">
                            <span className={cn("flex items-center gap-1", h.public_response_sent ? "text-green-600" : "text-muted-foreground")}>
                              {h.public_response_sent ? <CheckCircle2 className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />} Comentário
                            </span>
                            <span className={cn("flex items-center gap-1", h.dm_sent ? "text-green-600" : "text-muted-foreground")}>
                              {h.dm_sent ? <CheckCircle2 className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />} Direct Message
                            </span>
                          </div>
                          {h.error_message && (
                            <p className="mt-2 text-[10px] text-red-500 bg-red-50 p-2 rounded border border-red-100 truncate">
                              <strong>Erro:</strong> {h.error_message}
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog: Configurações Globais */}
      <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Configurações de Webhook</DialogTitle>
            <DialogDescription>
              Configure o webhook no seu App Meta para começar a receber comentários.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Callback URL</Label>
              <div className="flex gap-2">
                <Input value={webhookUrl} readOnly className="bg-muted text-xs font-mono" />
                <Button variant="outline" size="icon" onClick={() => {
                  navigator.clipboard.writeText(webhookUrl);
                  toast({ title: "Copiado!" });
                }}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Copie esta URL e cole no campo "Callback URL" do produto Webhooks (Instagram) no seu painel Meta for Developers.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Verify Token</Label>
              <div className="flex gap-2">
                <Input 
                  value={globalSettings.webhook_verify_token} 
                  onChange={(e) => setGlobalSettings(prev => ({ ...prev, webhook_verify_token: e.target.value }))}
                  placeholder="Seu token de verificação" 
                  className="font-mono"
                />
                <Button variant="outline" onClick={generateVerifyToken}>Gerar</Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Este token deve ser o mesmo configurado no painel da Meta.
              </p>
            </div>
            
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-blue-700 font-bold text-sm">
                <Info className="h-4 w-4" /> Instruções Meta
              </div>
              <ol className="text-[11px] text-blue-600 list-decimal pl-4 space-y-1">
                <li>Vá em <strong>developers.facebook.com</strong> → Selecione seu App.</li>
                <li>Adicione o produto <strong>Webhooks</strong>.</li>
                <li>No menu lateral, selecione <strong>Webhooks</strong> → Escolha <strong>Instagram</strong> no dropdown.</li>
                <li>Clique em <strong>Edit Subscription</strong> e insira os dados acima.</li>
                <li>Inscreva-se no campo <strong>comments</strong>.</li>
              </ol>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsConfigDialogOpen(false)}>Fechar</Button>
            <Button onClick={handleSaveSettings} disabled={loading}>Salvar Alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Nova/Editar Regra */}
      <Dialog open={isRuleDialogOpen} onOpenChange={setIsRuleDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl">
          <div className="bg-gradient-to-r from-pink-500 via-purple-500 to-orange-500 p-6 text-white shrink-0">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
                <Zap className="h-6 w-6 fill-white" />
                {currentRule.id ? "Editar Regra de Automação" : "Nova Regra de Auto-Resposta"}
              </DialogTitle>
              <DialogDescription className="text-white/80 text-sm">
                Configure os gatilhos e as respostas automáticas para turbinar seu Instagram.
              </DialogDescription>
            </DialogHeader>
          </div>
          
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="rule-name">Nome da Regra</Label>
                <Input 
                  id="rule-name" 
                  value={currentRule.name} 
                  onChange={(e) => setCurrentRule((prev: any) => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Campanha Promo Black Friday"
                />
              </div>

              <div className="space-y-3 p-4 bg-muted/20 rounded-xl border border-dashed">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Vincular a Post Específico?</Label>
                    <p className="text-[10px] text-muted-foreground">Escolha um post para que a regra funcione apenas nele.</p>
                  </div>
                  <Switch 
                    checked={isMediaSelectorOpen || !!currentRule.specific_media_id} 
                    onCheckedChange={(val) => {
                      setIsMediaSelectorOpen(val);
                      if (!val) {
                        setCurrentRule((prev: any) => ({ ...prev, specific_media_id: "" }));
                      }
                    }}
                  />
                </div>
                
                {(isMediaSelectorOpen || !!currentRule.specific_media_id) ? (
                  <div className="space-y-3 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <InstagramMediaSelector 
                      selectedId={currentRule.specific_media_id}
                      onSelect={(id) => {
                        setCurrentRule((prev: any) => ({ ...prev, specific_media_id: id }));
                        toast({ title: "Post selecionado!", description: `ID: ${id}` });
                      }}
                    />
                    {currentRule.specific_media_id && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full text-xs h-8 text-destructive border-destructive/20 hover:bg-destructive/10"
                        onClick={() => {
                          setCurrentRule((prev: any) => ({ ...prev, specific_media_id: "" }));
                          setIsMediaSelectorOpen(false);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                        Remover vínculo e responder a todos
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-primary font-medium bg-primary/5 p-2 rounded-md border border-primary/10">
                    <Info className="h-4 w-4" />
                    <p className="text-[11px]">
                      Esta regra responderá a <strong>TODOS</strong> os seus posts.
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Palavras-chave (Gatilhos)</Label>
                <div className="flex gap-2">
                  <Input 
                    value={newKeyword} 
                    onChange={(e) => setNewKeyword(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
                    placeholder="Ex: valor, preço, quero"
                  />
                  <Button variant="outline" onClick={addKeyword} size="icon">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {currentRule.keywords?.map((kw: string, i: number) => (
                    <Badge key={i} variant="secondary" className="gap-1 px-2 py-1">
                      {kw}
                      <button onClick={() => removeKeyword(i)} className="text-muted-foreground hover:text-foreground">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {(!currentRule.keywords || currentRule.keywords.length === 0) && (
                    <p className="text-[10px] text-muted-foreground italic">
                      Se não houver palavras-chave, responderá a TODOS os comentários.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Somente Seguidores</Label>
                    <p className="text-[10px] text-muted-foreground">Só responder se o usuário te seguir.</p>
                  </div>
                  <Switch 
                    checked={currentRule.follower_only} 
                    onCheckedChange={(val) => setCurrentRule((prev: any) => ({ ...prev, follower_only: val }))}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Regra Ativa</Label>
                    <p className="text-[10px] text-muted-foreground">Ativar/desativar esta regra individualmente.</p>
                  </div>
                  <Switch 
                    checked={currentRule.active} 
                    onCheckedChange={(val) => setCurrentRule((prev: any) => ({ ...prev, active: val }))}
                  />
                </div>
              </div>

              {/* Anti-spam */}
              <div className="space-y-3 p-4 bg-amber-50/60 dark:bg-amber-950/10 rounded-xl border border-amber-200/60">
                <div className="flex items-center gap-2 text-amber-700 font-semibold text-sm">
                  <AlertCircle className="h-4 w-4" /> Anti-Spam
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Cooldown por usuário (seg)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={currentRule.cooldown_seconds ?? 3600}
                      onChange={(e) => setCurrentRule((prev: any) => ({ ...prev, cooldown_seconds: Math.max(0, Number(e.target.value) || 0) }))}
                    />
                    <p className="text-[10px] text-muted-foreground">Tempo mínimo entre 2 respostas ao mesmo usuário. 3600 = 1h.</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Máx. respostas/dia por usuário</Label>
                    <Input
                      type="number"
                      min={0}
                      value={currentRule.max_per_user_per_day ?? 3}
                      onChange={(e) => setCurrentRule((prev: any) => ({ ...prev, max_per_user_per_day: Math.max(0, Number(e.target.value) || 0) }))}
                    />
                    <p className="text-[10px] text-muted-foreground">0 = sem limite diário.</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Blacklist de palavras (não responde se comentário contém)</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newBlacklistKw}
                      onChange={(e) => setNewBlacklistKw(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && newBlacklistKw.trim()) {
                          setCurrentRule((prev: any) => ({ ...prev, blacklist_keywords: [...(prev.blacklist_keywords || []), newBlacklistKw.trim()] }));
                          setNewBlacklistKw("");
                        }
                      }}
                      placeholder="Ex: golpe, fake, spam"
                    />
                    <Button variant="outline" size="icon" onClick={() => {
                      if (newBlacklistKw.trim()) {
                        setCurrentRule((prev: any) => ({ ...prev, blacklist_keywords: [...(prev.blacklist_keywords || []), newBlacklistKw.trim()] }));
                        setNewBlacklistKw("");
                      }
                    }}><Plus className="h-4 w-4" /></Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {(currentRule.blacklist_keywords || []).map((kw: string, i: number) => (
                      <Badge key={i} variant="destructive" className="gap-1 px-2 py-1">
                        {kw}
                        <button onClick={() => setCurrentRule((prev: any) => ({ ...prev, blacklist_keywords: prev.blacklist_keywords.filter((_: any, idx: number) => idx !== i) }))}>
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Blacklist de usuários (@)</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newBlacklistUser}
                      onChange={(e) => setNewBlacklistUser(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && newBlacklistUser.trim()) {
                          setCurrentRule((prev: any) => ({ ...prev, blacklist_usernames: [...(prev.blacklist_usernames || []), newBlacklistUser.trim().replace(/^@/, '')] }));
                          setNewBlacklistUser("");
                        }
                      }}
                      placeholder="Ex: perfil_bot, spam_user"
                    />
                    <Button variant="outline" size="icon" onClick={() => {
                      if (newBlacklistUser.trim()) {
                        setCurrentRule((prev: any) => ({ ...prev, blacklist_usernames: [...(prev.blacklist_usernames || []), newBlacklistUser.trim().replace(/^@/, '')] }));
                        setNewBlacklistUser("");
                      }
                    }}><Plus className="h-4 w-4" /></Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {(currentRule.blacklist_usernames || []).map((u: string, i: number) => (
                      <Badge key={i} variant="destructive" className="gap-1 px-2 py-1">
                        @{u}
                        <button onClick={() => setCurrentRule((prev: any) => ({ ...prev, blacklist_usernames: prev.blacklist_usernames.filter((_: any, idx: number) => idx !== i) }))}>
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="public-resp" className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-blue-500" /> 
                  Resposta Pública (Comentário)
                </Label>
                <Textarea 
                  id="public-resp"
                  value={currentRule.public_response}
                  onChange={(e) => setCurrentRule((prev: any) => ({ ...prev, public_response: e.target.value }))}
                  placeholder="Sua resposta pública no Instagram..."
                  className="min-h-[100px] text-sm focus-visible:ring-1 focus-visible:ring-offset-0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dm-resp" className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-pink-500" /> 
                  Resposta Privada (Direct Message)
                </Label>
                <Textarea 
                  id="dm-resp"
                  value={currentRule.dm_response}
                  onChange={(e) => setCurrentRule((prev: any) => ({ ...prev, dm_response: e.target.value }))}
                  placeholder="Mensagem que será enviada no direct..."
                  className="min-h-[100px] text-sm focus-visible:ring-1 focus-visible:ring-offset-0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="non-follower-resp" className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-orange-500" /> 
                  Se não seguir (Opcional)
                </Label>
                <Textarea 
                  id="non-follower-resp"
                  value={currentRule.non_follower_response}
                  onChange={(e) => setCurrentRule((prev: any) => ({ ...prev, non_follower_response: e.target.value }))}
                  placeholder="Ex: Que legal! Me segue para eu te mandar o link no direct..."
                  className="min-h-[80px] text-sm focus-visible:ring-1 focus-visible:ring-offset-0"
                />
                <p className="text-[10px] text-muted-foreground">
                  Se preenchido, esta mensagem será enviada publicamente caso o usuário não te siga.
                </p>
              </div>
            </div>
            </div>
          </div>
          
          <div className="p-4 bg-muted/30 border-t flex justify-end gap-3 shrink-0">
            <Button variant="ghost" onClick={() => setIsRuleDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveRule} disabled={loading} className="px-8 bg-gradient-to-r from-pink-500 to-orange-500 hover:opacity-90 border-none">
              {loading && <RefreshCw className="h-4 w-4 animate-spin mr-2" />}
              {currentRule.id ? "Atualizar Regra" : "Criar Regra Agora"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InstagramAutoReply;
