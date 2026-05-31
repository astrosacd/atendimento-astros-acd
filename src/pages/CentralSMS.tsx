import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { useSearchParams } from "react-router-dom";
import { MessageSquare, Plus, Trash2, Loader2, Send, History, Settings as SettingsIcon, FileText, Sparkles, RefreshCw, CheckCircle2, X, Filter } from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_COLOR: Record<string, string> = {
  pendente: "bg-slate-500",
  enviado: "bg-emerald-500",
  erro: "bg-destructive",
};

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  enviado: "Enviado",
  erro: "Erro",
};

export default function CentralSMS() {
  const [configStatus, setConfigStatus] = useState<{ twilio: boolean } | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get("tab");
  const initialTab = urlTab ?? "historico";
  const [activeTab, setActiveTab] = useState(initialTab);

  const refreshStatus = async () => {
    const { data } = await supabase
      .from("ligacoes_ia_config")
      .select("config_key, config_value")
      .in("config_key", ["twilio_account_sid", "twilio_auth_token", "twilio_phone_number"]);
    
    const map: Record<string, string> = {};
    (data ?? []).forEach((r: any) => map[r.config_key] = r.config_value ?? "");
    
    setConfigStatus({
      twilio: !!(map.twilio_account_sid && map.twilio_auth_token && map.twilio_phone_number),
    });
  };

  useEffect(() => { refreshStatus(); }, []);

  return (
    <DashboardLayout>
      <div className="container max-w-7xl py-6 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
              <MessageSquare className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                Central de SMS <Sparkles className="h-5 w-5 text-amber-400" />
              </h1>
              <p className="text-sm text-muted-foreground">
                Envio de mensagens curtas via Twilio
              </p>
            </div>
          </div>
        </div>

        {configStatus && !configStatus.twilio && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
            <p className="font-medium text-destructive">Configuração do Twilio incompleta nas Ligações IA.</p>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={(v) => {
          setActiveTab(v);
          const next = new URLSearchParams(searchParams);
          next.set("tab", v);
          setSearchParams(next, { replace: true });
        }} className="space-y-4">
          <TabsList className="flex flex-wrap w-full max-w-md h-auto">
            <TabsTrigger value="historico"><History className="h-4 w-4 mr-2" />Histórico</TabsTrigger>
            <TabsTrigger value="templates"><FileText className="h-4 w-4 mr-2" />Templates</TabsTrigger>
            <TabsTrigger value="envio"><Send className="h-4 w-4 mr-2" />Enviar</TabsTrigger>
          </TabsList>

          <TabsContent value="historico"><HistoricoTab /></TabsContent>
          <TabsContent value="templates"><TemplatesTab /></TabsContent>
          <TabsContent value="envio"><EnvioTab twilioOk={configStatus?.twilio || false} /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function HistoricoTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState("7");

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("sms_history")
      .select("*, clientes(nome)")
      .order("created_at", { ascending: false })
      .limit(100);
    
    if (periodo !== "all") {
      const since = startOfDay(subDays(new Date(), Number(periodo))).toISOString();
      q = q.gte("created_at", since);
    }
    
    const { data } = await q;
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [periodo]);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="font-semibold">Histórico de Mensagens</h2>
        <div className="flex items-center gap-2">
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Hoje</SelectItem>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="all">Tudo</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {loading && items.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">Carregando...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">Nenhum SMS enviado no período.</div>
        ) : (
          items.map((it) => (
            <div key={it.id} className="p-3 rounded-lg border bg-card hover:bg-muted/30 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className={`${STATUS_COLOR[it.status] || "bg-muted"} text-white text-[10px]`}>{STATUS_LABEL[it.status] || it.status}</Badge>
                  <span className="font-medium text-sm">{it.clientes?.nome || it.numero_destino}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{format(new Date(it.created_at), "dd/MM HH:mm")}</span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-1 italic">"{it.conteudo}"</p>
              {it.error_message && <p className="text-[10px] text-destructive">Erro: {it.error_message}</p>}
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

function TemplatesTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("sms_templates").select("*").order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Templates de SMS</h2>
        <Button size="sm" onClick={() => setEditing({})}>
          <Plus className="h-4 w-4 mr-1" /> Novo Template
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {items.map((r) => (
          <div key={r.id} className="p-3 rounded-lg border bg-card flex justify-between items-start gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm">{r.nome}</h3>
              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{r.conteudo}</p>
            </div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(r)}>
                <FileText className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {editing !== null && (
        <TemplateDialog template={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}
    </Card>
  );
}

function TemplateDialog({ template, onClose, onSaved }: any) {
  const [form, setForm] = useState({
    nome: template.nome || "",
    conteudo: template.conteudo || "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const payload = { ...form, created_by: auth.user?.id };
    
    let error;
    if (template.id) {
      ({ error } = await supabase.from("sms_templates").update(payload).eq("id", template.id));
    } else {
      ({ error } = await supabase.from("sms_templates").insert(payload));
    }
    
    setSaving(false);
    if (error) return sonnerToast.error(error.message);
    sonnerToast.success("Template salvo");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{template.id ? "Editar" : "Novo"} Template</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Nome</Label>
            <Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Cobrança Atrasada" />
          </div>
          <div className="space-y-1">
            <Label>Conteúdo (Máx 160 carac.)</Label>
            <Textarea value={form.conteudo} onChange={e => setForm({ ...form, conteudo: e.target.value })} maxLength={160} />
            <p className="text-[10px] text-muted-foreground text-right">{form.conteudo.length}/160</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EnvioTab({ twilioOk }: { twilioOk: boolean }) {
  const [numero, setNumero] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("sms_templates").select("id, nome, conteudo").eq("ativo", true).then(({ data }) => setTemplates(data ?? []));
  }, []);

  const send = async () => {
    if (!numero || !mensagem) return sonnerToast.error("Preencha número e mensagem");
    setSending(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ to: numero.replace(/\D/g, ""), body: mensagem }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      sonnerToast.success("SMS enviado com sucesso!");
      setMensagem("");
      setNumero("");
    } catch (e: any) {
      sonnerToast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="p-6 max-w-xl mx-auto">
      <div className="space-y-4">
        <div className="space-y-1">
          <Label>Número do Cliente (DDI + DDD + Número)</Label>
          <Input value={numero} onChange={e => setNumero(e.target.value)} placeholder="5511999999999" className="font-mono" />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label>Mensagem</Label>
            <Select onValueChange={(v) => {
              const t = templates.find(x => x.id === v);
              if (t) setMensagem(t.conteudo);
            }}>
              <SelectTrigger className="h-7 w-40 text-xs"><SelectValue placeholder="Usar Template" /></SelectTrigger>
              <SelectContent>
                {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Textarea value={mensagem} onChange={e => setMensagem(e.target.value)} maxLength={160} rows={4} placeholder="Digite sua mensagem aqui..." />
          <div className="flex justify-between items-center text-[10px] text-muted-foreground">
            <span>Dica: Contas Trial do Twilio mostram um prefixo na mensagem.</span>
            <span>{mensagem.length}/160</span>
          </div>
        </div>

        <Button className="w-full h-12 bg-blue-600 hover:bg-blue-700" onClick={send} disabled={sending || !twilioOk}>
          {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          Enviar Mensagem SMS
        </Button>
      </div>
    </Card>
  );
}
