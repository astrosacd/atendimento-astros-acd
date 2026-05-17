import React, { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { Phone, Plus, Play, Trash2, Loader2, PhoneCall, PhoneOff, History, Settings as SettingsIcon, FileText, Sparkles, AlertCircle, RefreshCw, CheckCircle2, Link as LinkIcon, Copy, Clock, Check, X } from "lucide-react";
import { format, subDays, startOfDay, addHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LigarComIADialog } from "@/components/LigarComIADialog";
import { User } from "lucide-react";
import { placeCallWithTTS, type ActiveCallHandle } from "@/lib/wavoipCall";
import { CobrancaConfigTab } from "@/components/ligacoes-ia/CobrancaConfigTab";
import { FilaLigacoesTab } from "@/components/ligacoes-ia/FilaLigacoesTab";
import { CampanhasLigacoesTab } from "@/components/ligacoes-ia/CampanhasLigacoesTab";
import { ListChecks, CalendarClock, Megaphone } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useSiteUrl } from "@/hooks/useSiteUrl";
import { copyToClipboard } from "@/utils/clipboard";

const CATEGORIAS = [
  { value: "cobranca", label: "Cobrança" },
  { value: "promocao", label: "Promoção" },
  { value: "renovacao", label: "Renovação" },
  { value: "recuperacao", label: "Recuperação" },
  { value: "boas_vindas", label: "Boas-vindas" },
  { value: "geral", label: "Geral" },
];

const STATUS_COLOR: Record<string, string> = {
  iniciando: "bg-slate-500",
  discando: "bg-blue-500",
  tocando: "bg-cyan-500",
  atendida: "bg-emerald-500",
  finalizada: "bg-emerald-600",
  nao_atendeu: "bg-amber-500",
  ocupado: "bg-orange-500",
  rejeitada: "bg-rose-500",
  erro: "bg-destructive",
};

const CATEGORY_LABEL: Record<string, string> = {
  premade: "Pré-feita",
  professional: "Profissional",
  cloned: "Clonada",
  generated: "Gerada",
};

export default function LigacoesIA() {
  const [configStatus, setConfigStatus] = useState<{ wavoip: boolean; eleven: boolean; dialer: boolean } | null>(null);

  const refreshStatus = async () => {
    const { data } = await supabase
      .from("ligacoes_ia_config")
      .select("config_key, config_value")
      .in("config_key", ["wavoip_token", "wavoip_dialer_number", "elevenlabs_api_key"]);
    const map: Record<string, string> = {};
    (data ?? []).forEach((r: any) => map[r.config_key] = r.config_value ?? "");
    setConfigStatus({
      wavoip: !!map.wavoip_token,
      dialer: !!map.wavoip_dialer_number,
      eleven: !!map.elevenlabs_api_key,
    });
  };
  useEffect(() => { refreshStatus(); }, []);

  const allOk = configStatus?.wavoip && configStatus?.dialer && configStatus?.eleven;

  return (
    <DashboardLayout>
      <div className="container max-w-7xl py-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-fuchsia-500 to-purple-600 shadow-lg">
            <PhoneCall className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              Ligações IA <Sparkles className="h-5 w-5 text-amber-400" />
            </h1>
            <p className="text-sm text-muted-foreground">
              Ligações automáticas via WhatsApp (Wavoip) com voz natural (ElevenLabs)
            </p>
          </div>
        </div>

        {configStatus && !allOk && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="font-medium">Configuração incompleta — as ligações não funcionarão</p>
              <ul className="text-xs text-muted-foreground mt-1 list-disc pl-4">
                {!configStatus.wavoip && <li>Token Wavoip ausente</li>}
                {!configStatus.dialer && <li>Número discador (WhatsApp Business) ausente</li>}
                {!configStatus.eleven && <li>API Key ElevenLabs ausente</li>}
              </ul>
              <p className="text-xs mt-1">Vá para a aba <strong>Configurações</strong> abaixo.</p>
            </div>
          </div>
        )}

        {configStatus && allOk && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>Configuração completa — pronto para fazer ligações.</span>
          </div>
        )}

        <Tabs defaultValue="historico" className="space-y-4">
          <TabsList className="grid grid-cols-7 w-full max-w-5xl">
            <TabsTrigger value="historico"><History className="h-4 w-4 mr-2" />Histórico</TabsTrigger>
            <TabsTrigger value="fila"><ListChecks className="h-4 w-4 mr-2" />Fila do dia</TabsTrigger>
            <TabsTrigger value="roteiros"><FileText className="h-4 w-4 mr-2" />Roteiros</TabsTrigger>
            <TabsTrigger value="disparo"><Phone className="h-4 w-4 mr-2" />Disparo</TabsTrigger>
            <TabsTrigger value="campanhas"><Megaphone className="h-4 w-4 mr-2" />Campanhas</TabsTrigger>
            <TabsTrigger value="cobranca"><CalendarClock className="h-4 w-4 mr-2" />Cobrança</TabsTrigger>
            <TabsTrigger value="config"><SettingsIcon className="h-4 w-4 mr-2" />Configurações</TabsTrigger>
          </TabsList>

          <TabsContent value="historico"><HistoricoTab /></TabsContent>
          <TabsContent value="fila"><FilaLigacoesTab /></TabsContent>
          <TabsContent value="roteiros"><RoteirosTab /></TabsContent>
          <TabsContent value="disparo"><DisparoTab /></TabsContent>
          <TabsContent value="campanhas"><CampanhasLigacoesTab /></TabsContent>
          <TabsContent value="cobranca"><CobrancaConfigTab /></TabsContent>
          <TabsContent value="config"><ConfigTab onSaved={refreshStatus} /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// ============ HISTÓRICO ============
function HistoricoTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState("7"); // dias

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("ligacoes_ia_historico")
      .select("*, clientes(nome, numero), ligacoes_ia_roteiros(nome)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (periodo !== "all") {
      const since = startOfDay(subDays(new Date(), Number(periodo))).toISOString();
      q = q.gte("created_at", since);
    }
    const { data } = await q;
    setItems(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [periodo]);

  // Realtime updates
  useEffect(() => {
    const ch = supabase.channel("ligacoes_ia_hist")
      .on("postgres_changes", { event: "*", schema: "public", table: "ligacoes_ia_historico" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, []);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="font-semibold">Histórico de ligações</h2>
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
      {loading && items.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          Nenhuma ligação no período. Vá para a aba <strong>Disparo</strong> para testar.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={`${STATUS_COLOR[it.status] || "bg-muted"} text-white`}>{it.status}</Badge>
                  <span className="font-medium truncate">{it.clientes?.nome || it.numero_destino}</span>
                  {it.ligacoes_ia_roteiros?.nome && (
                    <span className="text-xs text-muted-foreground">• {it.ligacoes_ia_roteiros.nome}</span>
                  )}
                  <Badge variant="outline" className="text-[10px]">{it.source || "manual"}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {format(new Date(it.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  {it.duration_seconds ? ` • ${it.duration_seconds}s` : ""}
                  {it.error_message ? ` • erro: ${it.error_message.slice(0, 80)}` : ""}
                </div>
              </div>
              <code className="text-xs text-muted-foreground hidden md:block">{it.numero_destino}</code>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ============ ROTEIROS ============
function RoteirosTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("ligacoes_ia_roteiros").select("*").order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const remove = async (id: string) => {
    if (!confirm("Excluir roteiro?")) return;
    await supabase.from("ligacoes_ia_roteiros").delete().eq("id", id);
    toast({ title: "Roteiro excluído" });
    load();
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Roteiros reutilizáveis</h2>
        <Button size="sm" onClick={() => setEditing({})}>
          <Plus className="h-4 w-4 mr-1" /> Novo roteiro
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          Nenhum roteiro. Crie um para reutilizar nas ligações.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {items.map((r) => (
            <div key={r.id} className="p-3 rounded-lg border bg-card">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{r.categoria}</Badge>
                    {!r.ativo && <Badge variant="secondary">inativo</Badge>}
                  </div>
                  <h3 className="font-medium mt-1">{r.nome}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.texto}</p>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => setEditing(r)}>
                    <FileText className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(r.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing !== null && (
        <RoteiroDialog
          roteiro={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </Card>
  );
}

// Hook: load voices from ElevenLabs
function useElevenVoices() {
  const [voices, setVoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = async (apiKey?: string, opts?: { silent?: boolean }) => {
    setLoading(true);
    try {
      const cleanApiKey = apiKey?.trim();
      const { data, error } = await supabase.functions.invoke("ligacoes-ia-list-voices", {
        body: cleanApiKey ? { api_key: cleanApiKey } : {},
      });
      if (error) throw error;
      const msg = (data as any)?.error;
      if (msg) {
        if (!opts?.silent) toast({ title: "Erro ao buscar vozes", description: msg, variant: "destructive" });
        return [];
      }
      setVoices((data as any).voices ?? []);
      return (data as any).voices ?? [];
    } catch (e: any) {
      const description = e?.message?.includes("Failed to send a request")
        ? "Não foi possível chamar o backend. Atualize a página e tente novamente. Se persistir, confira se a função de vozes está publicada."
        : e.message;
      if (!opts?.silent) toast({ title: "Erro ao buscar vozes", description, variant: "destructive" });
      return [];
    } finally {
      setLoading(false);
    }
  };

  return { voices, loading, fetch, setVoices };
}

function RoteiroDialog({ roteiro, onClose, onSaved }: { roteiro: any; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    nome: roteiro.nome ?? "",
    categoria: roteiro.categoria ?? "cobranca",
    descricao: roteiro.descricao ?? "",
    texto: roteiro.texto ?? "Olá {nome}, aqui é da empresa. Sua fatura de R$ {valor} vence em breve. Conto com você!",
    voice_id: roteiro.voice_id ?? "",
    ativo: roteiro.ativo ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const { voices, loading: loadingVoices, fetch: fetchVoices } = useElevenVoices();

  useEffect(() => { fetchVoices(undefined, { silent: true }); /* eslint-disable-next-line */ }, []);

  const save = async () => {
    if (!form.nome || !form.texto) {
      toast({ title: "Preencha nome e texto", variant: "destructive" });
      return;
    }
    setSaving(true);
    const variaveis = Array.from(form.texto.matchAll(/\{(\w+)\}/g)).map(m => m[1]);
    const payload = { ...form, variaveis: [...new Set(variaveis)], voice_id: form.voice_id || null };
    const { error } = roteiro.id
      ? await supabase.from("ligacoes_ia_roteiros").update(payload).eq("id", roteiro.id)
      : await supabase.from("ligacoes_ia_roteiros").insert(payload);
    setSaving(false);
    if (error) return toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    toast({ title: "Roteiro salvo" });
    onSaved();
  };

  const preview = async () => {
    setPreviewing(true);
    try {
      const exemploVars: Record<string, string> = { nome: "João", valor: "99,90", produto: "Plano Pro", data_renovacao: "30/12/2025" };
      const { data, error } = await supabase.functions.invoke("ligacoes-ia-tts", {
        body: { preview_text: form.texto.replace(/\{(\w+)\}/g, (_: any, k: string) => exemploVars[k] ?? `{${k}}`), preview_voice_id: form.voice_id || undefined },
      });
      if (error) throw error;
      const audio = new Audio((data as any).signed_url);
      await audio.play();
    } catch (e: any) {
      const description = e?.message?.includes("Failed to send a request")
        ? "O navegador bloqueou a chamada do preview. Atualize a página e tente novamente."
        : e.message;
      toast({ title: "Erro no preview", description, variant: "destructive" });
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{roteiro.id ? "Editar" : "Novo"} roteiro</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nome</Label>
              <Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={form.categoria} onValueChange={v => setForm({ ...form, categoria: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Voz {loadingVoices && <Loader2 className="h-3 w-3 inline animate-spin ml-1" />}</Label>
            <Select value={form.voice_id || "default"} onValueChange={v => setForm({ ...form, voice_id: v === "default" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Padrão das configurações" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Padrão das configurações</SelectItem>
                {voices.map(v => (
                  <SelectItem key={v.voice_id} value={v.voice_id}>
                    {v.name} • {CATEGORY_LABEL[v.category] || v.category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {voices.length === 0 && !loadingVoices && (
              <p className="text-xs text-muted-foreground mt-1">Configure a API Key ElevenLabs em Configurações para listar suas vozes.</p>
            )}
          </div>
          <div>
            <Label>Texto (use {"{nome}"}, {"{valor}"}, {"{produto}"}, {"{data_renovacao}"})</Label>
            <Textarea rows={5} value={form.texto} onChange={e => setForm({ ...form, texto: e.target.value })} />
            <p className="text-xs text-muted-foreground mt-1">
              Variáveis serão preenchidas automaticamente quando vincular a um cliente.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.ativo} onCheckedChange={c => setForm({ ...form, ativo: c })} />
            <Label>Ativo</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={preview} disabled={previewing}>
            {previewing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
            Pré-ouvir
          </Button>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ DISPARO ============
function DisparoTab() {
  const [roteiros, setRoteiros] = useState<any[]>([]);
  const [roteiroId, setRoteiroId] = useState("");
  const [voiceOverride, setVoiceOverride] = useState("");
  const [numero, setNumero] = useState("");
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  const [calling, setCalling] = useState(false);
  const [clienteDialogOpen, setClienteDialogOpen] = useState(false);
  const { voices, fetch: fetchVoices } = useElevenVoices();

  useEffect(() => {
    supabase.from("ligacoes_ia_roteiros").select("id, nome, categoria").eq("ativo", true).then(({ data }) => setRoteiros(data ?? []));
    fetchVoices(undefined, { silent: true });
    // eslint-disable-next-line
  }, []);

  const [callStatus, setCallStatus] = useState("");
  const callRef = useRef<ActiveCallHandle | null>(null);

  const ligar = async () => {
    if (!roteiroId || !numero) {
      toast({ title: "Selecione roteiro e número", variant: "destructive" });
      return;
    }
    setCalling(true);
    setCallStatus("Gerando áudio do roteiro...");
    try {
      const { data, error } = await supabase.functions.invoke("ligacoes-ia-call", {
        body: {
          roteiro_id: roteiroId,
          numero_destino: numero.replace(/\D/g, ""),
          variables: { nome, valor },
          voice_id_override: voiceOverride || undefined,
          source: "manual",
        },
      });
      if (error) throw error;
      const d = data as any;
      if (!d?.wavoip_token || !d?.audio_url || !d?.phone) {
        throw new Error("Resposta inválida do servidor (faltam token/áudio/número)");
      }
      const handle = await placeCallWithTTS({
        token: d.wavoip_token,
        phone: d.phone,
        audioUrl: d.audio_url,
        historicoId: d.historico_id,
        onStatus: (s) => setCallStatus(s),
        onEnded: () => { setCalling(false); setCallStatus(""); callRef.current = null; },
      });
      callRef.current = handle;
      toast({ title: "Ligação em andamento" });
    } catch (e: any) {
      setCalling(false);
      setCallStatus("");
      toast({ title: "Erro ao ligar", description: e?.message ?? String(e), variant: "destructive" });
    }
  };

  const desligar = async () => {
    await callRef.current?.hangup();
    callRef.current = null;
    setCalling(false);
    setCallStatus("");
  };

  return (
    <Card className="p-6 max-w-2xl">
      <h2 className="font-semibold mb-4">Disparo manual de teste</h2>
      <div className="space-y-3">
        <div>
          <Label>Roteiro</Label>
          <Select value={roteiroId} onValueChange={setRoteiroId}>
            <SelectTrigger><SelectValue placeholder="Selecione um roteiro" /></SelectTrigger>
            <SelectContent>
              {roteiros.map(r => <SelectItem key={r.id} value={r.id}>{r.nome} ({r.categoria})</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Voz (opcional — sobrepõe a do roteiro)</Label>
          <Select value={voiceOverride || "default"} onValueChange={v => setVoiceOverride(v === "default" ? "" : v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Usar voz do roteiro</SelectItem>
              {voices.map(v => (
                <SelectItem key={v.voice_id} value={v.voice_id}>{v.name} • {CATEGORY_LABEL[v.category] || v.category}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Número de destino (com DDI, ex: 5511999999999)</Label>
          <Input value={numero} onChange={e => setNumero(e.target.value)} placeholder="5511999999999" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Nome (variável {"{nome}"})</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} />
          </div>
          <div>
            <Label>Valor (variável {"{valor}"})</Label>
            <Input value={valor} onChange={e => setValor(e.target.value)} placeholder="99,90" />
          </div>
        </div>
        {calling && callStatus && (
          <div className="rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/5 p-3 text-xs flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin text-fuchsia-500" />
            <span className="text-foreground">{callStatus}</span>
          </div>
        )}
        {calling ? (
          <Button className="w-full" variant="destructive" onClick={desligar}>
            <PhoneOff className="h-4 w-4 mr-2" /> Desligar
          </Button>
        ) : (
          <Button className="w-full" onClick={ligar}>
            <Phone className="h-4 w-4 mr-2" /> Ligar agora
          </Button>
        )}

        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
          <div className="relative flex justify-center text-xs"><span className="bg-background px-2 text-muted-foreground">ou</span></div>
        </div>

        <Button variant="outline" className="w-full" onClick={() => setClienteDialogOpen(true)}>
          <User className="h-4 w-4 mr-2" />
          Ligar para um cliente cadastrado (mensais + registros)
        </Button>
      </div>

      <LigarComIADialog open={clienteDialogOpen} onOpenChange={setClienteDialogOpen} />
    </Card>
  );
}

// ============ CONFIG ============
function ConfigTab({ onSaved }: { onSaved?: () => void }) {
  const [cfg, setCfg] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { voices, loading: loadingVoices, fetch: fetchVoices } = useElevenVoices();

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("ligacoes_ia_config").select("config_key, config_value");
    const map: Record<string, string> = {};
    (data ?? []).forEach((r: any) => map[r.config_key] = r.config_value ?? "");
    setCfg(map);
    setLoading(false);
    if (map.elevenlabs_api_key) fetchVoices(undefined, { silent: true });
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const save = async () => {
    setSaving(true);
    const updates = Object.entries(cfg).map(([config_key, config_value]) =>
      supabase.from("ligacoes_ia_config").update({ config_value }).eq("config_key", config_key)
    );
    await Promise.all(updates);
    setSaving(false);
    toast({ title: "Configurações salvas" });
    onSaved?.();
  };

  const testarVozes = async () => {
    if (!cfg.elevenlabs_api_key) return toast({ title: "Cole a API Key primeiro", variant: "destructive" });
    const v = await fetchVoices(cfg.elevenlabs_api_key);
    if (v.length > 0) toast({ title: `${v.length} vozes carregadas`, description: "API Key válida ✓" });
  };

  if (loading) return <Card className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></Card>;

  const field = (key: string, label: string, hint?: string, type: string = "text") => (
    <div>
      <Label>{label}</Label>
      <Input type={type} value={cfg[key] ?? ""} onChange={e => setCfg({ ...cfg, [key]: e.target.value })} />
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );

  return (
    <Card className="p-6 space-y-6 max-w-3xl">
      <section className="space-y-3">
        <h3 className="font-semibold text-sm uppercase text-muted-foreground">Wavoip (discador)</h3>
        {field("wavoip_token", "Token Wavoip", "No painel da Wavoip, abra o Dispositivo (número WhatsApp) e copie o Token de API/Integração.", "password")}
        {field("wavoip_dialer_number", "Número WhatsApp Business discador", "Com DDI, sem símbolos. Ex: 5511999999999")}
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold text-sm uppercase text-muted-foreground">ElevenLabs (voz)</h3>
        <div>
          <Label>API Key ElevenLabs</Label>
          <div className="flex gap-2 mt-1.5">
            <Input
              type="password"
              value={cfg.elevenlabs_api_key || ""}
              onChange={e => setCfg({ ...cfg, elevenlabs_api_key: e.target.value })}
              className="flex-1"
            />
            <Button variant="outline" onClick={testarVozes} disabled={loadingVoices} className="shrink-0">
              {loadingVoices ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Buscar vozes
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">elevenlabs.io → Profile → API Key. Após colar, clique em Buscar vozes.</p>
        </div>
        <div>
          <Label>Voz padrão {voices.length > 0 && <span className="text-xs text-muted-foreground">({voices.length} disponíveis)</span>}</Label>
          <Select value={cfg.elevenlabs_default_voice_id || ""} onValueChange={v => setCfg({ ...cfg, elevenlabs_default_voice_id: v })}>
            <SelectTrigger><SelectValue placeholder={voices.length === 0 ? "Configure a API Key e busque vozes" : "Selecione uma voz"} /></SelectTrigger>
            <SelectContent>
              {voices.map(v => (
                <SelectItem key={v.voice_id} value={v.voice_id}>
                  {v.name} • {CATEGORY_LABEL[v.category] || v.category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {field("voice_stability", "Estabilidade (0-1)")}
          {field("voice_similarity", "Similaridade (0-1)")}
          {field("voice_speed", "Velocidade (0.7-1.2)")}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold text-sm uppercase text-muted-foreground">Retentativas</h3>
        <div className="grid grid-cols-2 gap-3">
          {field("call_attempts", "Tentativas em caso de não atender")}
          {field("retry_interval_minutes", "Intervalo entre tentativas (min)")}
        </div>
      </section>

      <Button onClick={save} disabled={saving}>
        {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Salvar configurações
      </Button>
    </Card>
  );
}
