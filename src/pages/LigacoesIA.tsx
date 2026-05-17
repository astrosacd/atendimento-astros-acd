import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Phone, Plus, Play, Trash2, Loader2, PhoneCall, History, Settings as SettingsIcon, FileText, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const VOICES = [
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam (PT-BR profissional)" },
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel (PT-BR simpática)" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah (clara)" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George (grave)" },
  { id: "XB0fDUnXU5powFXDhCwa", name: "Charlotte (jovem)" },
];

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

export default function LigacoesIA() {
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

        <Tabs defaultValue="historico" className="space-y-4">
          <TabsList className="grid grid-cols-4 w-full max-w-2xl">
            <TabsTrigger value="historico"><History className="h-4 w-4 mr-2" />Histórico</TabsTrigger>
            <TabsTrigger value="roteiros"><FileText className="h-4 w-4 mr-2" />Roteiros</TabsTrigger>
            <TabsTrigger value="disparo"><Phone className="h-4 w-4 mr-2" />Disparo</TabsTrigger>
            <TabsTrigger value="config"><SettingsIcon className="h-4 w-4 mr-2" />Configurações</TabsTrigger>
          </TabsList>

          <TabsContent value="historico"><HistoricoTab /></TabsContent>
          <TabsContent value="roteiros"><RoteirosTab /></TabsContent>
          <TabsContent value="disparo"><DisparoTab /></TabsContent>
          <TabsContent value="config"><ConfigTab /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// ============ HISTÓRICO ============
function HistoricoTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("ligacoes_ia_historico")
      .select("*, clientes(nome, numero), ligacoes_ia_roteiros(nome)")
      .order("created_at", { ascending: false })
      .limit(100);
    setItems(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Últimas 100 ligações</h2>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Atualizar"}
        </Button>
      </div>
      {loading && items.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          Nenhuma ligação ainda. Vá para a aba <strong>Disparo</strong> para fazer a primeira.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge className={`${STATUS_COLOR[it.status] || "bg-muted"} text-white`}>{it.status}</Badge>
                  <span className="font-medium truncate">
                    {it.clientes?.nome || it.numero_destino}
                  </span>
                  {it.ligacoes_ia_roteiros?.nome && (
                    <span className="text-xs text-muted-foreground">• {it.ligacoes_ia_roteiros.nome}</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {format(new Date(it.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  {it.duration_seconds ? ` • ${it.duration_seconds}s` : ""}
                  {it.error_message ? ` • erro: ${it.error_message.slice(0, 60)}` : ""}
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
      toast({ title: "Erro no preview", description: e.message, variant: "destructive" });
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
            <Label>Voz (deixe vazio para usar padrão)</Label>
            <Select value={form.voice_id || "default"} onValueChange={v => setForm({ ...form, voice_id: v === "default" ? "" : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Padrão das configurações</SelectItem>
                {VOICES.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
              </SelectContent>
            </Select>
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
  const [numero, setNumero] = useState("");
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  const [calling, setCalling] = useState(false);

  useEffect(() => {
    supabase.from("ligacoes_ia_roteiros").select("id, nome, categoria").eq("ativo", true).then(({ data }) => setRoteiros(data ?? []));
  }, []);

  const ligar = async () => {
    if (!roteiroId || !numero) {
      toast({ title: "Selecione roteiro e número", variant: "destructive" });
      return;
    }
    setCalling(true);
    const { data, error } = await supabase.functions.invoke("ligacoes-ia-call", {
      body: {
        roteiro_id: roteiroId,
        numero_destino: numero.replace(/\D/g, ""),
        variables: { nome, valor },
        source: "manual",
      },
    });
    setCalling(false);
    if (error) return toast({ title: "Erro ao ligar", description: error.message, variant: "destructive" });
    toast({ title: "Ligação disparada!", description: `Cache hit: ${(data as any).cache_hit ? "sim" : "não"}` });
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
          <Label>Número de destino (com DDI, ex: 5511999999999)</Label>
          <Input value={numero} onChange={e => setNumero(e.target.value)} placeholder="5511999999999" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Nome (para variável {"{nome}"})</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} />
          </div>
          <div>
            <Label>Valor (para variável {"{valor}"})</Label>
            <Input value={valor} onChange={e => setValor(e.target.value)} placeholder="99,90" />
          </div>
        </div>
        <Button className="w-full" onClick={ligar} disabled={calling}>
          {calling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Phone className="h-4 w-4 mr-2" />}
          Ligar agora
        </Button>
        <p className="text-xs text-muted-foreground">
          Para ligar a partir de um cliente cadastrado, use o botão "Ligar com IA" no card do cliente (a ser adicionado).
        </p>
      </div>
    </Card>
  );
}

// ============ CONFIG ============
function ConfigTab() {
  const [cfg, setCfg] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("ligacoes_ia_config").select("config_key, config_value");
    const map: Record<string, string> = {};
    (data ?? []).forEach((r: any) => map[r.config_key] = r.config_value ?? "");
    setCfg(map);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    const updates = Object.entries(cfg).map(([config_key, config_value]) =>
      supabase.from("ligacoes_ia_config").update({ config_value }).eq("config_key", config_key)
    );
    await Promise.all(updates);
    setSaving(false);
    toast({ title: "Configurações salvas" });
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
        {field("wavoip_token", "Token Wavoip", "Pegue em app.wavoip.com → API Keys", "password")}
        {field("wavoip_dialer_number", "Número WhatsApp Business discador", "Com DDI, sem símbolos. Ex: 5511999999999")}
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold text-sm uppercase text-muted-foreground">ElevenLabs (voz)</h3>
        <div>
          <Label>Voz padrão</Label>
          <Select value={cfg.elevenlabs_default_voice_id || ""} onValueChange={v => setCfg({ ...cfg, elevenlabs_default_voice_id: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {VOICES.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">A chave ELEVENLABS_API_KEY é guardada nos Secrets do projeto.</p>
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
