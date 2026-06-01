import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Smartphone, 
  Send, 
  History, 
  RefreshCw, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  AlertTriangle,
  MessageSquare,
  FileText,
  Plus,
  Trash2,
  ExternalLink,
  Users,
  ShieldAlert,
  Sparkles,
  Settings2
} from "lucide-react";
import { format } from "date-fns";
import { usePermissions } from "@/hooks/usePermissions";

export function RCSTab() {
  const { canViewRCS, canManageRCS, canManageRCSTemplates } = usePermissions();
  const [activeTab, setActiveTab] = useState("conexao");
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);


  const loadStatus = async () => {
    try {
      const { data: configs } = await supabase
        .from("ligacoes_ia_config")
        .select("config_key, config_value")
        .in("config_key", ["twilio_account_sid", "twilio_auth_token", "twilio_messaging_service_sid"]);
      
      const map: any = {};
      configs?.forEach(c => map[c.config_key] = c.config_value);
      
      const isConnected = map.twilio_account_sid && map.twilio_auth_token && map.twilio_messaging_service_sid;
      setSession({ 
        status: isConnected ? 'connected' : 'offline', 
        name: 'Twilio Cloud' 
      });
    } catch (error) {
      console.error("Error loading RCS status:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  if (!canViewRCS()) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <ShieldAlert className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">Acesso Negado</h3>
          <p className="text-muted-foreground text-center max-w-sm">
            Você não tem permissão para visualizar o módulo de RCS. Solicite acesso ao administrador.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-muted-foreground">Verificando conexão...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            Twilio Cloud
          </Badge>
          <span className="text-sm text-muted-foreground italic">
            Envio oficial via API do Twilio (Requer saldo e aprovação Google RCS)
          </span>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="conexao">
            <Settings2 className="h-4 w-4 mr-2" />
            Configuração
          </TabsTrigger>
          <TabsTrigger value="templates">
            <FileText className="h-4 w-4 mr-2" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="enviar">
            <Send className="h-4 w-4 mr-2" />
            Enviar
          </TabsTrigger>
          <TabsTrigger value="historico">
            <History className="h-4 w-4 mr-2" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conexao">
          <RCSConnection onConfigChange={loadStatus} />
        </TabsContent>
        <TabsContent value="templates">
          <RCSTemplates canManageRCSTemplates={canManageRCSTemplates} />
        </TabsContent>
        <TabsContent value="enviar">
          <RCSSend canManageRCS={canManageRCS} />
        </TabsContent>
        <TabsContent value="historico">
          <RCSHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// --- Connection/Config Component (Twilio) ---
function RCSConnection({ onConfigChange }: { onConfigChange: () => void }) {
  const [config, setConfig] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const { data } = await supabase
        .from("ligacoes_ia_config")
        .select("config_key, config_value")
        .in("config_key", [
          "twilio_account_sid",
          "twilio_auth_token",
          "twilio_messaging_service_sid"
        ]);

      const map: any = {};
      data?.forEach((item) => (map[item.config_key] = item.config_value));
      setConfig(map);
    } catch (error) {
      console.error("Error loading RCS config:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    try {
      setSaving(true);
      const updates = Object.entries(config).map(([key, value]) => ({
        config_key: key,
        config_value: String(value || ""),
      }));

      const { error } = await supabase
        .from("ligacoes_ia_config")
        .upsert(updates, { onConflict: 'config_key' });

      if (error) throw error;
      toast.success("Configuração RCS salva com sucesso!");
      onConfigChange();

    } catch (error: any) {
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-muted-foreground">Carregando configurações...</p>
      </div>
    );
  }

  const isConfigured = config.twilio_account_sid && config.twilio_auth_token && config.twilio_messaging_service_sid;

  return (
    <Card className="p-6">
      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-blue-600" />
              Configuração Twilio RCS
            </h3>
            <p className="text-sm text-muted-foreground">
              Integre sua conta Twilio para disparos oficiais de RCS.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${isConfigured ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                  {isConfigured ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-sm">
                    {isConfigured ? 'Pronto para Disparos' : 'Configuração Pendente'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isConfigured ? 'Credenciais validadas localmente' : 'Preencha os dados do Twilio'}
                  </p>
                </div>
              </div>
              <Badge variant={isConfigured ? 'default' : 'secondary'} className={isConfigured ? 'bg-emerald-500' : ''}>
                {isConfigured ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Account SID</Label>
                <Input 
                  value={config.twilio_account_sid || ""} 
                  onChange={e => setConfig({...config, twilio_account_sid: e.target.value})}
                  placeholder="AC..."
                />
              </div>
              <div className="space-y-1">
                <Label>Auth Token</Label>
                <Input 
                  type="password"
                  value={config.twilio_auth_token || ""} 
                  onChange={e => setConfig({...config, twilio_auth_token: e.target.value})}
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-blue-700 font-bold flex items-center justify-between">
                  <span>Messaging Service SID (RCS)</span>
                  <a 
                    href="https://console.twilio.com/us1/develop/sms/services" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[10px] text-blue-600 hover:underline flex items-center gap-1 font-normal"
                  >
                    Abrir Twilio <ExternalLink className="h-2 w-2" />
                  </a>
                </Label>
                <Input 
                  value={config.twilio_messaging_service_sid || ""} 
                  onChange={e => setConfig({...config, twilio_messaging_service_sid: e.target.value})}
                  placeholder="MG..."
                />
                <p className="text-[10px] text-muted-foreground italic">Crie um Messaging Service no Twilio Console e adicione seu Remetente RCS (Inicia com MG...).</p>
              </div>
            </div>

            <Button 
              className="w-full bg-blue-600 hover:bg-blue-700" 
              onClick={saveConfig}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Salvar Configurações
            </Button>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-xl border border-muted min-h-[300px]">
          <div className="text-center space-y-4 max-w-xs">
            <MessageSquare className="h-16 w-16 text-blue-400 mx-auto" />
            <h4 className="font-bold text-slate-800 text-sm">Atenção: Contas Trial do Twilio</h4>
            <div className="text-xs text-slate-600 space-y-2 text-left bg-white p-3 rounded-lg border">
              <p>1. <strong>Restrição Trial:</strong> No modo teste do Twilio, você <strong>só</strong> consegue enviar para números que verificou manualmente em "Verified Caller IDs".</p>
              <p>2. <strong>Aprovação RCS:</strong> O envio de RCS não é automático. Você precisa solicitar a verificação da sua marca junto ao Google pelo console do Twilio (Módulo Messaging Service).</p>
              <p>3. <strong>Fallback:</strong> Se o RCS não estiver aprovado, o Twilio tentará enviar como SMS comum (se houver saldo).</p>
            </div>
            <Button 
              variant="link" 
              className="text-blue-600 text-xs h-auto p-0"
              onClick={() => window.open('https://console.twilio.com', '_blank')}
            >
              Acessar Console Twilio <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

// --- Templates Component ---
function RCSTemplates({ canManageRCSTemplates }: { canManageRCSTemplates: () => boolean }) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const canEdit = canManageRCSTemplates();

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("rcs_templates").select("*").order("created_at", { ascending: false });
    setTemplates(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Templates RCS Rich Content</h2>
        {canEdit && (
          <Button size="sm" onClick={() => setEditing({ botoes: [] })}>
            <Plus className="h-4 w-4 mr-1" /> Novo Template RCS
          </Button>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {templates.map((t) => (
          <div key={t.id} className="p-4 rounded-lg border bg-card flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start">
              <h3 className="font-bold text-sm text-blue-700">{t.nome}</h3>
              {canEdit && (
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(t)}>
                    <FileText className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={async () => {
                    if(confirm('Excluir este template?')) {
                      await supabase.from("rcs_templates").delete().eq("id", t.id);
                      load();
                    }
                  }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            
            <div className="bg-slate-50 p-3 rounded border text-xs text-slate-700 italic leading-relaxed">
              {t.conteudo}
            </div>

            {t.botoes && t.botoes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {t.botoes.map((b: any, i: number) => (
                  <Badge key={i} variant="outline" className="bg-white py-1 px-2 flex items-center gap-1 border-blue-200">
                    <ExternalLink className="h-3 w-3 text-blue-500" />
                    {b.label}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {editing !== null && (
        <RCSTemplateDialog template={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}
    </Card>
  );
}

function RCSTemplateDialog({ template, onClose, onSaved }: any) {
  const [form, setForm] = useState({
    nome: template.nome || "",
    conteudo: template.conteudo || "",
    botoes: template.botoes || [],
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.nome || !form.conteudo) return toast.error("Preencha nome e conteúdo");
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = { ...form, user_id: user?.id };
    
    let error;
    if (template.id) {
      ({ error } = await supabase.from("rcs_templates").update(payload).eq("id", template.id));
    } else {
      ({ error } = await supabase.from("rcs_templates").insert(payload));
    }
    
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Template RCS salvo");
    onSaved();
  };

  const addBotao = () => {
    if (form.botoes.length >= 3) return toast.error("Máximo de 3 botões");
    setForm({ ...form, botoes: [...form.botoes, { label: "", url: "" }] });
  };

  const removeBotao = (index: number) => {
    const newBotoes = [...form.botoes];
    newBotoes.splice(index, 1);
    setForm({ ...form, botoes: newBotoes });
  };

  const updateBotao = (index: number, field: string, value: string) => {
    const newBotoes = [...form.botoes];
    newBotoes[index] = { ...newBotoes[index], [field]: value };
    setForm({ ...form, botoes: newBotoes });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{template.id ? "Editar" : "Novo"} Template RCS</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Nome do Template</Label>
            <Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Promoção VIP" />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <Label>Conteúdo (Suporta Spintax)</Label>
              <Badge variant="outline" className="text-[9px] border-blue-200 text-blue-600">
                Uso: {'{Oi|Olá|Tudo bem}'}
              </Badge>
            </div>
            <Textarea 
              value={form.conteudo} 
              onChange={e => setForm({ ...form, conteudo: e.target.value })} 
              placeholder="Ex: {Olá|Oi|Tudo bem}, temos uma oferta para você!" 
              rows={4}
            />
            <p className="text-[10px] text-muted-foreground italic">O spintax ajuda a evitar bloqueios variando o texto de cada envio.</p>
          </div>
          <div className="space-y-1">
            <Label>Conteúdo da Mensagem</Label>
            <Textarea value={form.conteudo} onChange={e => setForm({ ...form, conteudo: e.target.value })} rows={4} />
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-blue-700 font-bold">Botões Interativos (Links)</Label>
              <Button size="sm" variant="outline" onClick={addBotao} type="button" className="h-7 text-[10px]">
                <Plus className="h-3 w-3 mr-1" /> Add Botão
              </Button>
            </div>
            
            {form.botoes.map((b: any, i: number) => (
              <div key={i} className="flex gap-2 items-end p-2 border rounded bg-slate-50 relative">
                <div className="flex-1 space-y-1">
                  <Input 
                    placeholder="Texto do botão" 
                    className="h-8 text-xs" 
                    value={b.label} 
                    onChange={e => updateBotao(i, 'label', e.target.value)}
                  />
                  <Input 
                    placeholder="https://link.com" 
                    className="h-8 text-xs" 
                    value={b.url} 
                    onChange={e => updateBotao(i, 'url', e.target.value)}
                  />
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeBotao(i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>Salvar Template</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Send Component (Single + Bulk) ---
function RCSSend({ canManageRCS }: { canManageRCS: () => boolean }) {
  const canSend = canManageRCS();
  const [numbersInput, setNumbersInput] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [sending, setSending] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("manual");

  const [minDelay, setMinDelay] = useState(10);
  const [maxDelay, setMaxDelay] = useState(20);
  const [useSpintax, setUseSpintax] = useState(true);

  // Helper to process spintax: {Olá|Oi|Bom dia}
  const processSpintax = (text: string) => {
    return text.replace(/\{([^{}]*)\}/g, (match, options) => {
      const choices = options.split('|');
      return choices[Math.floor(Math.random() * choices.length)];
    });
  };

  useEffect(() => {
    const init = async () => {
      const { data: tmpls } = await supabase.from("rcs_templates").select("*").eq("ativo", true);
      setTemplates(tmpls || []);
    };
    init();
  }, []);



  const handleSend = async () => {
    if (!numbersInput || !mensagem) return toast.error("Preencha os números e a mensagem");
    
    // Recarregar status antes de enviar
    const { data: configs } = await supabase
      .from("ligacoes_ia_config")
      .select("config_key, config_value")
      .in("config_key", ["twilio_account_sid", "twilio_auth_token", "twilio_messaging_service_sid"]);
    
    const map: any = {};
    configs?.forEach(c => map[c.config_key] = c.config_value);
    const isConnected = map.twilio_account_sid && map.twilio_auth_token && map.twilio_messaging_service_sid;

    if (!isConnected) {
      return toast.error("Configuração do Twilio incompleta. Preencha os campos na aba 'Configuração'.");
    }



    const rawNumbers = numbersInput.split(/[\n, ]+/).filter(n => n.trim().length > 0);
    const cleanNumbers = rawNumbers.map(n => n.replace(/\D/g, ""));

    if (cleanNumbers.length === 0) return toast.error("Nenhum número válido encontrado");

    setSending(true);
    let successCount = 0;
    
    try {
      toast.info(`Iniciando envio para ${cleanNumbers.length} contatos...`);

      for (let i = 0; i < cleanNumbers.length; i++) {
        const numero = cleanNumbers[i];
        const finalMessage = useSpintax ? processSpintax(mensagem) : mensagem;

        console.log(`Enviando RCS para ${numero}...`);
        const { data, error } = await supabase.functions.invoke('send-rcs', {
          body: { 
            to: numero, 
            body: finalMessage,
            session_id: session.id
          }
        });

        if (error) {
          console.error(`Erro ao enviar para ${numero}:`, error);
          toast.error(`Erro no número ${numero}: ${error.message || 'Erro desconhecido'}`);
          continue;
        } else if (data?.error) {
          console.error(`Erro retornado pelo Twilio para ${numero}:`, data.error);
          const errorMsg = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
          toast.error(`Twilio (${numero}): ${errorMsg}`, { duration: 8000 });
          continue;
        } else {
          successCount++;
        }
        
        if (i < cleanNumbers.length - 1) {
          const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
          await new Promise(r => setTimeout(r, randomDelay * 1000));
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} mensagem(ns) enviada(s) pelo Twilio.`);
      } else {
        toast.error("Nenhuma mensagem foi enviada. Veja o erro do Twilio acima.");
      }
      // Removi a limpeza automática dos campos para você ver o que foi enviado
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSending(false);
    }
  };

  const handleTemplateChange = (val: string) => {
    setSelectedTemplate(val);
    if (val === "manual") {
      setMensagem("");
    } else {
      const t = templates.find(x => x.id === val);
      if (t) setMensagem(t.conteudo);
    }
  };

  return (
    <Card className="p-6 max-w-2xl mx-auto">
      <div className="space-y-6">
        <div className="flex items-center gap-3 text-blue-700 bg-blue-50 p-4 rounded-xl text-sm border border-blue-100">
          <Users className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-bold">Envio em Massa Liberado</p>
            <p className="text-xs opacity-80 text-blue-600">Cole vários números separados por vírgula ou uma lista (um por linha).</p>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="flex justify-between items-center">
            <span>Lista de Números (DDD + Número)</span>
            <span className="text-[10px] text-muted-foreground uppercase">Ex: 5511999999999</span>
          </Label>
          <Textarea 
            value={numbersInput} 
            onChange={e => setNumbersInput(e.target.value)} 
            placeholder="5511999999999&#10;5511888888888&#10;5521777777777" 
            className="font-mono text-sm"
            rows={5}
          />
        </div>

        <div className="space-y-4 pt-2 border-t border-dashed">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Modelo de Mensagem</Label>
              <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Escolha um template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Escrita Manual</SelectItem>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1">
              <Label>Anti-Bloqueio (Delay & Spintax)</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold">Delay (Min-Max)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Input 
                      type="number" 
                      value={minDelay} 
                      onChange={e => setMinDelay(Number(e.target.value))} 
                      className="h-8 text-xs w-14"
                      min={1}
                    />
                    <span className="text-[10px] text-muted-foreground">à</span>
                    <Input 
                      type="number" 
                      value={maxDelay} 
                      onChange={e => setMaxDelay(Number(e.target.value))} 
                      className="h-8 text-xs w-14"
                      min={1}
                    />
                    <span className="text-[10px] text-muted-foreground">seg</span>
                  </div>
                </div>
                <div className="space-y-1 flex flex-col justify-end">
                   <Button 
                    variant={useSpintax ? "default" : "outline"} 
                    size="sm" 
                    className="h-8 text-[10px] w-full"
                    onClick={() => setUseSpintax(!useSpintax)}
                   >
                     Spintax: {useSpintax ? 'Ativo' : 'Inativo'}
                   </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <Label>Mensagem Final</Label>
              {useSpintax && (
                <Badge variant="outline" className="text-[9px] border-blue-200 text-blue-600">
                  Uso: {'{Oi|Olá|Tudo bem}'}
                </Badge>
              )}
            </div>
            <Textarea 
              value={mensagem} 
              onChange={e => setMensagem(e.target.value)} 
              placeholder="Sua mensagem RCS aparecerá aqui..."
              rows={4}
              className={selectedTemplate !== "manual" ? "border-blue-200 bg-blue-50/10" : ""}
            />
            {selectedTemplate !== "manual" && (
              <p className="text-[10px] text-blue-600 mt-1">
                <Sparkles className="h-3 w-3 inline mr-1" />
                Template selecionado. Você pode personalizar o texto e adicionar <strong>Spintax</strong> (ex: {'{Olá|Oi}'}).
              </p>
            )}
          </div>
        </div>

        <Button 
          className="w-full h-14 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 shadow-lg text-lg font-bold" 
          onClick={handleSend}
          disabled={sending || !canSend}
        >
          {sending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
          {session?.status === 'connected' ? (
            !canSend ? 'Sem permissão de envio' : (sending ? 'Processando fila...' : `Disparar para ${numbersInput.split(/[\n, ]+/).filter(n => n.trim()).length} contatos`)
          ) : 'Configuração Incompleta'}
        </Button>

        {session?.status === 'connected' && (
          <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            Twilio Cloud: <span className="font-bold">Conectado</span>
          </div>
        )}
      </div>
    </Card>
  );
}

// --- History Component ---
function RCSHistory() {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("rcs_messages")
      .select("*, rcs_templates(nome)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    setMessages(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'enviado': return <Badge className="bg-emerald-500">Enviado</Badge>;
      case 'erro': return <Badge variant="destructive">Erro</Badge>;
      default: return <Badge variant="secondary" className="animate-pulse">Pendente</Badge>;
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Histórico de Disparos RCS</h2>
        <Button size="sm" variant="outline" onClick={loadHistory}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="space-y-2">
        {loading && messages.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">Carregando histórico...</div>
        ) : messages.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">Nenhuma mensagem RCS enviada ainda.</div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="p-3 rounded-lg border bg-card hover:bg-muted/30 flex flex-col gap-1 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusBadge(m.status)}
                  <span className="font-bold text-sm">{m.numero_destino}</span>
                  {m.rcs_templates?.nome && (
                    <Badge variant="outline" className="text-[9px] border-blue-200 text-blue-600">
                      {m.rcs_templates.nome}
                    </Badge>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {format(new Date(m.created_at), "dd/MM HH:mm")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-1 italic">"{m.conteudo}"</p>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
