import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
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
  QrCode, 
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
  Users
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { format } from "date-fns";

export function RCSTab() {
  const [activeTab, setActiveTab] = useState("conexao");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
          Beta
        </Badge>
        <span className="text-sm text-muted-foreground italic">
          Envio gratuito usando seu próprio chip Android
        </span>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="conexao">
            <QrCode className="h-4 w-4 mr-2" />
            Conexão
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
          <RCSConnection />
        </TabsContent>
        <TabsContent value="templates">
          <RCSTemplates />
        </TabsContent>
        <TabsContent value="enviar">
          <RCSSend />
        </TabsContent>
        <TabsContent value="historico">
          <RCSHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// --- Connection Component ---
function RCSConnection() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadSession = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("rcs_sessions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Error loading RCS session:", error);
    } else {
      setSession(data);
    }
    setLoading(false);
  };

  const createSession = async () => {
    setRefreshing(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const mockQrToken = `rcs-pair-${Math.random().toString(36).substring(7)}`;
    
    if (session) {
      await supabase
        .from("rcs_sessions")
        .update({ qr_code: mockQrToken, status: "pairing", updated_at: new Date().toISOString() })
        .eq("id", session.id);
    } else {
      await supabase
        .from("rcs_sessions")
        .insert({
          name: "Meu Android",
          status: "pairing",
          qr_code: mockQrToken,
          user_id: user.id
        });
    }
    
    await loadSession();
    setRefreshing(false);
    toast.success("Novo QR Code gerado!");
  };

  useEffect(() => {
    loadSession();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-muted-foreground">Verificando conexão...</p>
      </div>
    );
  }

  return (
    <Card className="p-6">
      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-blue-600" />
              Status do Dispositivo
            </h3>
            <p className="text-sm text-muted-foreground">
              Conecte seu celular Android para habilitar o envio de RCS.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${session?.status === 'connected' ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                  {session?.status === 'connected' ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-slate-400" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-sm">
                    {session?.status === 'connected' ? 'Dispositivo Conectado' : 'Aguardando Conexão'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {session?.name || "Nenhum aparelho pareado"}
                  </p>
                </div>
              </div>
              <Badge variant={session?.status === 'connected' ? 'default' : 'secondary'} className={session?.status === 'connected' ? 'bg-emerald-500' : ''}>
                {session?.status === 'connected' ? 'Online' : 'Offline'}
              </Badge>
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                <div className="text-xs text-amber-800 space-y-1">
                  <p className="font-bold uppercase tracking-wider">Como conectar:</p>
                  <ol className="list-decimal ml-4 space-y-1">
                    <li>Instale o App <strong>Gateway RCS</strong> no seu Android.</li>
                    <li>Abra o App e clique em "Escanear QR Code".</li>
                    <li>Aponte a câmera para o código ao lado.</li>
                    <li>Mantenha o celular conectado à internet.</li>
                  </ol>
                </div>
              </div>
            </div>

            <Button 
              variant="outline" 
              className="w-full" 
              onClick={createSession}
              disabled={refreshing}
            >
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Gerar Novo QR Code / Atualizar
            </Button>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center p-6 bg-white rounded-xl border-2 border-dashed border-muted shadow-inner min-h-[300px]">
          {session?.qr_code ? (
            <>
              <div className="p-4 bg-white rounded-lg shadow-md mb-4 border border-slate-100">
                <QRCodeSVG value={session.qr_code} size={200} />
              </div>
              <p className="text-[10px] text-muted-foreground font-mono">
                Token: {session.qr_code}
              </p>
              <p className="text-xs mt-2 text-center text-muted-foreground italic">
                Aponte o app do gateway para este código
              </p>
            </>
          ) : (
            <div className="text-center space-y-3">
              <QrCode className="h-16 w-16 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground">Clique no botão para gerar o QR Code</p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// --- Templates Component ---
function RCSTemplates() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);

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
        <Button size="sm" onClick={() => setEditing({ botoes: [] })}>
          <Plus className="h-4 w-4 mr-1" /> Novo Template RCS
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {templates.map((t) => (
          <div key={t.id} className="p-4 rounded-lg border bg-card flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start">
              <h3 className="font-bold text-sm text-blue-700">{t.nome}</h3>
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
            <Label>Conteúdo da Mensagem</Label>
            <Textarea value={form.conteudo} onChange={e => setForm({ ...form, conteudo: e.target.value })} rows={4} />
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-blue-700 font-bold">Botões Interativos (Links)</Label>
              <Button size="xs" variant="outline" onClick={addBotao} type="button" className="h-7 text-[10px]">
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
function RCSSend() {
  const [numbersInput, setNumbersInput] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [sending, setSending] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("manual");

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: sess } = await supabase.from("rcs_sessions").select("*").eq("user_id", user.id).maybeSingle();
      setSession(sess);
      
      const { data: tmpls } = await supabase.from("rcs_templates").select("*").eq("ativo", true);
      setTemplates(tmpls || []);
    };
    init();
  }, []);

  const handleSend = async () => {
    if (!numbersInput || !mensagem) return toast.error("Preencha os números e a mensagem");
    if (!session || session.status !== 'connected') {
      return toast.error("Seu celular Android não está conectado.");
    }

    // Process numbers (split by comma, newline or space)
    const rawNumbers = numbersInput.split(/[\n, ]+/).filter(n => n.trim().length > 0);
    const cleanNumbers = rawNumbers.map(n => n.replace(/\D/g, ""));

    if (cleanNumbers.length === 0) return toast.error("Nenhum número válido encontrado");

    setSending(true);
    let successCount = 0;
    
    try {
      toast.info(`Iniciando envio para ${cleanNumbers.length} contatos...`);

      for (const numero of cleanNumbers) {
        const { error: msgError } = await supabase
          .from("rcs_messages")
          .insert({
            session_id: session.id,
            numero_destino: numero,
            conteudo: mensagem,
            status: 'pendente',
            user_id: session.user_id,
            template_id: selectedTemplate !== "manual" ? selectedTemplate : null
          });

        if (!msgError) successCount++;
        // Small delay between queueing
        await new Promise(r => setTimeout(r, 100));
      }

      toast.success(`${successCount} mensagens enfileiradas para seu celular!`);
      setMensagem("");
      setNumbersInput("");
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
          <div className="grid grid-cols-2 gap-4">
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
              <Label>Dispositivo Ativo</Label>
              <div className="h-10 flex items-center px-3 border rounded bg-muted/20 text-xs font-medium">
                {session?.status === 'connected' ? (
                  <><CheckCircle2 className="h-3 w-3 text-emerald-500 mr-2" /> {session.name}</>
                ) : (
                  <><XCircle className="h-3 w-3 text-destructive mr-2" /> Nenhum conectado</>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Mensagem Final</Label>
            <Textarea 
              value={mensagem} 
              onChange={e => setMensagem(e.target.value)} 
              placeholder="Sua mensagem RCS aparecerá aqui..."
              rows={4}
              readOnly={selectedTemplate !== "manual"}
              className={selectedTemplate !== "manual" ? "bg-muted/30" : ""}
            />
            {selectedTemplate !== "manual" && (
              <p className="text-[10px] text-blue-600 mt-1">Este template inclui botões interativos configurados.</p>
            )}
          </div>
        </div>

        <Button 
          className="w-full h-14 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 shadow-lg text-lg font-bold" 
          onClick={handleSend}
          disabled={sending || !session || session.status !== 'connected'}
        >
          {sending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
          {session?.status === 'connected' ? `Disparar para ${numbersInput.split(/[\n, ]+/).filter(n => n.trim()).length} contatos` : 'Conecte um Celular Primeiro'}
        </Button>
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
