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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { useSearchParams } from "react-router-dom";
import { Phone, Plus, Play, Trash2, Loader2, PhoneCall, PhoneOff, History, Settings as SettingsIcon, FileText, Sparkles, AlertCircle, RefreshCw, CheckCircle2, Link as LinkIcon, Copy, Clock, Check, X, Filter, Languages, Download, Headphones } from "lucide-react";
import { format, subDays, startOfDay, addHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LigarComIADialog } from "@/components/LigarComIADialog";
import { User } from "lucide-react";
import { placeCallWithTTS, placeManualCall, type ActiveCallHandle } from "@/lib/wavoipCall";
import { CobrancaConfigTab } from "@/components/ligacoes-ia/CobrancaConfigTab";
import { FilaLigacoesTab } from "@/components/ligacoes-ia/FilaLigacoesTab";
import { CampanhasLigacoesTab } from "@/components/ligacoes-ia/CampanhasLigacoesTab";
import { ListChecks, CalendarClock, Megaphone } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useSiteUrl } from "@/hooks/useSiteUrl";
import { copyToClipboard } from "@/utils/clipboard";
import { invokeFunction } from "@/utils/invokeFunction";

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
  pronto_para_discar: "bg-slate-500",
  discando: "bg-blue-500",
  tocando: "bg-cyan-500",
  atendida: "bg-emerald-500",
  finalizada: "bg-emerald-600",
  nao_atendeu: "bg-amber-500",
  ocupado: "bg-orange-500",
  rejeitada: "bg-rose-500",
  cliente_desligou_antes_audio: "bg-amber-600",
  cliente_desligou_durante_audio: "bg-amber-600",
  audio_concluido: "bg-emerald-500",
  cancelada: "bg-muted",
  erro: "bg-destructive",
};

export const STATUS_LABEL: Record<string, string> = {
  iniciando: "Iniciando",
  pronto_para_discar: "Pronta para discar",
  discando: "Discando",
  tocando: "Tocando",
  atendida: "Atendida",
  finalizada: "Finalizada",
  audio_concluido: "Áudio concluído",
  nao_atendeu: "Não atendeu",
  ocupado: "Ocupado",
  rejeitada: "Rejeitada",
  cliente_desligou_antes_audio: "Cliente desligou antes do áudio",
  cliente_desligou_durante_audio: "Cliente desligou durante o áudio",
  cancelada: "Cancelada",
  erro: "Erro",
};

const CATEGORY_LABEL: Record<string, string> = {
  premade: "Pré-feita",
  professional: "Profissional",
  cloned: "Clonada",
  generated: "Gerada",
};

export default function LigacoesIA() {
  const [configStatus, setConfigStatus] = useState<{ 
    wavoip: boolean; 
    eleven: boolean; 
    dialer: boolean;
    twilio: boolean;
    provider: string;
  } | null>(null);

  const refreshStatus = async () => {
    const { data } = await supabase
      .from("ligacoes_ia_config")
      .select("config_key, config_value")
      .in("config_key", [
        "wavoip_token", 
        "wavoip_dialer_number", 
        "elevenlabs_api_key",
        "twilio_account_sid",
        "twilio_auth_token",
        "twilio_phone_number",
        "calling_provider"
      ]);
    const map: Record<string, string> = {};
    (data ?? []).forEach((r: any) => map[r.config_key] = r.config_value ?? "");
    
    setConfigStatus({
      wavoip: !!map.wavoip_token,
      dialer: !!map.wavoip_dialer_number,
      eleven: !!map.elevenlabs_api_key,
      twilio: !!(map.twilio_account_sid && map.twilio_auth_token && map.twilio_phone_number),
      provider: map.calling_provider || "wavoip",
    });
  };
  useEffect(() => { refreshStatus(); }, []);

  const providerOk = configStatus?.provider === "twilio" ? configStatus.twilio : (configStatus?.wavoip && configStatus?.dialer);
  const allOk = providerOk && configStatus?.eleven;
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get("tab");
  const urlCliente = searchParams.get("cliente");
  const initialTab = urlTab ?? "historico";
  const [activeTab, setActiveTab] = useState(initialTab);
  useEffect(() => {
    if (urlTab && urlTab !== activeTab) setActiveTab(urlTab);
    // eslint-disable-next-line
  }, [urlTab]);

  return (
    <DashboardLayout>
      <div className="container max-w-7xl py-6 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-fuchsia-500 to-purple-600 shadow-lg">
              <PhoneCall className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                Ligações IA <Sparkles className="h-5 w-5 text-amber-400" />
              </h1>
              <p className="text-sm text-muted-foreground">
                Ligações automáticas via WhatsApp ({configStatus?.provider === "twilio" ? "Twilio" : "Wavoip"}) com voz natural (ElevenLabs)
              </p>
            </div>
          </div>
        </div>

        {configStatus && !allOk && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="font-medium">Configuração incompleta — as ligações não funcionarão</p>
              <ul className="text-xs text-muted-foreground mt-1 list-disc pl-4">
                {configStatus.provider === "wavoip" ? (
                  <>
                    {!configStatus.wavoip && <li>Token Wavoip ausente</li>}
                    {!configStatus.dialer && <li>Número discador (WhatsApp Business) ausente</li>}
                  </>
                ) : (
                  <>
                    {!configStatus.twilio && <li>Configurações do Twilio incompletas</li>}
                  </>
                )}
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

        <Tabs value={activeTab} onValueChange={(v) => {
          setActiveTab(v);
          const next = new URLSearchParams(searchParams);
          next.set("tab", v);
          if (v !== "historico") next.delete("cliente");
          setSearchParams(next, { replace: true });
        }} className="space-y-4">
          <TabsList className="flex flex-wrap w-full max-w-5xl h-auto">
            <TabsTrigger value="historico"><History className="h-4 w-4 mr-2" />Histórico</TabsTrigger>
            <TabsTrigger value="fila"><ListChecks className="h-4 w-4 mr-2" />Fila do dia</TabsTrigger>
            <TabsTrigger value="consultor"><User className="h-4 w-4 mr-2" />Consultor</TabsTrigger>
            <TabsTrigger value="roteiros"><FileText className="h-4 w-4 mr-2" />Roteiros</TabsTrigger>
            <TabsTrigger value="disparo"><Phone className="h-4 w-4 mr-2" />Disparo</TabsTrigger>
            <TabsTrigger value="campanhas"><Megaphone className="h-4 w-4 mr-2" />Campanhas</TabsTrigger>
            <TabsTrigger value="cobranca"><CalendarClock className="h-4 w-4 mr-2" />Cobrança</TabsTrigger>
            <TabsTrigger value="config"><SettingsIcon className="h-4 w-4 mr-2" />Configurações</TabsTrigger>
          </TabsList>

          <TabsContent value="historico"><HistoricoTab clienteIdFilter={urlCliente} onClearFilter={() => { const n = new URLSearchParams(searchParams); n.delete("cliente"); setSearchParams(n, { replace: true }); }} /></TabsContent>
          <TabsContent value="fila"><FilaLigacoesTab /></TabsContent>
          <TabsContent value="consultor"><ConsultorTab provider={configStatus?.provider || "wavoip"} wavoipToken={configStatus?.wavoip ? "ok" : ""} /></TabsContent>
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
function HistoricoTab({ clienteIdFilter, onClearFilter }: { clienteIdFilter?: string | null; onClearFilter?: () => void } = {}) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState("7"); // dias
  const [clienteNome, setClienteNome] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
    if (clienteIdFilter) {
      q = q.eq("cliente_id", clienteIdFilter);
    }
    const { data } = await q;
    setItems(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [periodo, clienteIdFilter]);

  useEffect(() => {
    if (!clienteIdFilter) { setClienteNome(null); return; }
    supabase.from("clientes").select("nome").eq("id", clienteIdFilter).maybeSingle()
      .then(({ data }) => setClienteNome(data?.nome ?? null));
  }, [clienteIdFilter]);

  // Realtime updates
  useEffect(() => {
    const ch = supabase.channel("ligacoes_ia_hist")
      .on("postgres_changes", { event: "*", schema: "public", table: "ligacoes_ia_historico" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [clienteIdFilter, periodo]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingId(null);
  };

  const handleOuvirGravacao = async (it: any) => {
    if (playingId === it.id) {
      stopAudio();
      return;
    }

    if (playingId) {
      stopAudio();
    }

    setLoadingAudioId(it.id);
    const url = it.recording_url.includes(".mp3") ? it.recording_url : `${it.recording_url}.mp3`;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twilio-recording-proxy`;
      const res = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ url }),
      });
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const audio = new Audio(blobUrl);
      audioRef.current = audio;
      
      audio.onplay = () => {
        setLoadingAudioId(null);
        setPlayingId(it.id);
      };

      audio.onended = () => {
        setPlayingId(null);
        audioRef.current = null;
        URL.revokeObjectURL(blobUrl);
      };

      audio.onerror = () => {
        setPlayingId(null);
        setLoadingAudioId(null);
        audioRef.current = null;
        sonnerToast.error("Erro ao reproduzir áudio.");
      };

      await audio.play();
    } catch (e) {
      console.error("Erro ao processar gravação:", e);
      setLoadingAudioId(null);
      sonnerToast.error("Erro ao acessar a gravação. Tente novamente.");
    }
  };

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

      {clienteIdFilter && (
        <div className="flex items-center justify-between gap-2 mb-3 p-2 rounded-md border border-primary/30 bg-primary/5 text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <Filter className="h-4 w-4 text-primary shrink-0" />
            <span className="truncate">Filtrando por cliente: <strong>{clienteNome || clienteIdFilter}</strong></span>
          </div>
          {onClearFilter && (
            <Button size="sm" variant="ghost" onClick={onClearFilter}>
              <X className="h-3 w-3 mr-1" /> Limpar
            </Button>
          )}
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          {clienteIdFilter ? "Nenhuma ligação para este cliente no período." : <>Nenhuma ligação no período. Vá para a aba <strong>Disparo</strong> para testar.</>}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={`${STATUS_COLOR[it.status] || "bg-muted"} text-white`}>{STATUS_LABEL[it.status] || it.status}</Badge>
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
              
              <div className="flex items-center gap-2">
                {it.recording_url && (
                  <div className="flex items-center gap-1">
                    <Button 
                      size="sm" 
                      variant={playingId === it.id ? "secondary" : "ghost"}
                      className={`h-8 gap-2 ${playingId === it.id ? "text-amber-600 animate-pulse" : "text-primary"}`}
                      title={playingId === it.id ? "Parar gravação" : "Ouvir gravação"}
                      onClick={() => handleOuvirGravacao(it)}
                      disabled={loadingAudioId === it.id}
                    >
                      {loadingAudioId === it.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : playingId === it.id ? (
                        <X className="h-4 w-4" />
                      ) : (
                        <Headphones className="h-4 w-4" />
                      )}
                      <span className="text-xs font-medium">
                        {loadingAudioId === it.id ? "Carregando..." : playingId === it.id ? "Ouvindo..." : "Ouvir"}
                      </span>
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8 text-muted-foreground"
                      title="Baixar gravação"
                      onClick={async () => {
                        const url = it.recording_url.includes(".mp3") ? it.recording_url : `${it.recording_url}.mp3`;
                        try {
                          const { data: { session } } = await supabase.auth.getSession();
                          const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twilio-recording-proxy`;
                          const res = await fetch(functionUrl, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
                              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                            },
                            body: JSON.stringify({ url }),
                          });
                          if (!res.ok) throw new Error(`HTTP ${res.status}`);
                          const blob = await res.blob();
                          const blobUrl = URL.createObjectURL(blob);
                          const link = document.createElement('a');
                          link.href = blobUrl;
                          link.download = `gravacao-${it.id.slice(0, 8)}.mp3`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
                        } catch (e) {
                          console.error("Erro ao baixar gravação:", e);
                          sonnerToast.error("Erro ao baixar a gravação.");
                        }
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <code className="text-xs text-muted-foreground hidden md:block">{it.numero_destino}</code>
              </div>
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
  const [toDelete, setToDelete] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("ligacoes_ia_roteiros").select("*").order("created_at", { ascending: false });
    const rows = data ?? [];
    const ids = Array.from(new Set(rows.map((r: any) => r.created_by).filter(Boolean)));
    let profMap: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id, name, email").in("user_id", ids as string[]);
      (profs ?? []).forEach((p: any) => { profMap[p.user_id] = p.name || p.email || "Usuário"; });
    }
    setItems(rows.map((r: any) => ({ ...r, _creator: r.created_by ? (profMap[r.created_by] || "Usuário") : null })));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const confirmRemove = async () => {
    if (!toDelete) return;
    setDeleting(true);
    const { error } = await supabase.from("ligacoes_ia_roteiros").delete().eq("id", toDelete.id);
    setDeleting(false);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Roteiro excluído" });
    setToDelete(null);
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
          {items.map((r) => {
            const idiomaLabel = r.idioma === "en-US" ? "EN" : r.idioma === "es-ES" ? "ES" : "PT-BR";
            const moedaLabel = r.moeda || "BRL";
            const tipoLabel = r.tipo === "estrangeiro" ? "Estrangeiro" : "Brasileiro";
            return (
            <div key={r.id} className="p-3 rounded-lg border bg-card">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">{r.categoria}</Badge>
                    <Badge variant="secondary">{tipoLabel}</Badge>
                    <Badge variant="outline" className="font-mono text-[10px]">{idiomaLabel}</Badge>
                    <Badge variant="outline" className="font-mono text-[10px]">{moedaLabel}</Badge>
                    {!r.ativo && <Badge variant="secondary">inativo</Badge>}
                  </div>
                  <h3 className="font-medium mt-1">{r.nome}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.texto}</p>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Criado por <span className="font-medium">{r._creator ?? "—"}</span>
                    {r.created_at && <> • {new Date(r.created_at).toLocaleDateString("pt-BR")}</>}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" title="Duplicar e traduzir com IA" onClick={() => setEditing({ ...r, __duplicate: true })}>
                    <Languages className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditing(r)}>
                    <FileText className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setToDelete(r)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {editing !== null && (
        <RoteiroDialog
          roteiro={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir roteiro?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o roteiro <strong>{toDelete?.nome}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Excluindo...</> : <><Trash2 className="h-4 w-4 mr-2" /> Excluir</>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  const isDuplicate = !!roteiro.__duplicate;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [form, setForm] = useState({
    nome: isDuplicate ? `${roteiro.nome ?? ""} (cópia)` : (roteiro.nome ?? ""),
    categoria: roteiro.categoria ?? "cobranca",
    descricao: roteiro.descricao ?? "",
    texto: roteiro.texto ?? "Olá {nome}, aqui é da empresa. Sua fatura de {valor} vence em breve. Conto com você!",
    voice_id: roteiro.voice_id ?? "",
    ativo: roteiro.ativo ?? true,
    tipo: roteiro.tipo ?? "brasileiro",
    idioma: roteiro.idioma ?? "pt-BR",
    moeda: roteiro.moeda ?? "BRL",
  });
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [translating, setTranslating] = useState(false);
  const { voices, loading: loadingVoices, fetch: fetchVoices } = useElevenVoices();

  useEffect(() => { fetchVoices(undefined, { silent: true }); /* eslint-disable-next-line */ }, []);

  // Sincroniza idioma/moeda padrão quando troca tipo
  const setTipo = (tipo: string) => {
    if (tipo === "brasileiro") {
      setForm(f => ({ ...f, tipo, idioma: "pt-BR", moeda: "BRL" }));
    } else {
      setForm(f => ({ ...f, tipo, idioma: f.idioma === "pt-BR" ? "en-US" : f.idioma, moeda: f.moeda === "BRL" ? "USD" : f.moeda }));
    }
  };

  const translate = async () => {
    if (!form.texto) return toast({ title: "Sem texto para traduzir", variant: "destructive" });
    setTranslating(true);
    try {
      const data = await invokeFunction("ligacoes-ia-translate-roteiro", {
        body: { nome: form.nome, texto: form.texto, source_idioma: "pt-BR", target_idioma: form.idioma },
      });
      const translated = (data as any)?.texto_traduzido;
      const novoNome = (data as any)?.nome_traduzido;
      if (translated) {
        setForm(f => ({ ...f, texto: translated, nome: novoNome || f.nome }));
        toast({ title: "Texto traduzido", description: "Revise antes de salvar." });
      } else {
        toast({ title: "Falha na tradução", description: (data as any)?.error ?? "Resposta vazia", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Erro ao traduzir", description: e.message, variant: "destructive" });
    } finally {
      setTranslating(false);
    }
  };

  const save = async () => {
    if (!form.nome || !form.texto) {
      toast({ title: "Preencha nome e texto", variant: "destructive" });
      return;
    }
    setSaving(true);
    const variaveis = Array.from(form.texto.matchAll(/\{(\w+)\}/g)).map(m => m[1]);
    const basePayload = { ...form, variaveis: [...new Set(variaveis)], voice_id: form.voice_id || null };
    let error: any = null;
    if (roteiro.id && !isDuplicate) {
      ({ error } = await supabase.from("ligacoes_ia_roteiros").update(basePayload).eq("id", roteiro.id));
    } else {
      const { data: auth } = await supabase.auth.getUser();
      ({ error } = await supabase.from("ligacoes_ia_roteiros").insert({ ...basePayload, created_by: auth.user?.id ?? null }));
    }
    setSaving(false);
    if (error) return toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    toast({ title: "Roteiro salvo" });
    onSaved();
  };

  const preview = async () => {
    setPreviewing(true);
    try {
      const valorExemplo = form.moeda === "USD" ? "99.90" : form.moeda === "EUR" ? "99,90" : "99,90";
      const dataExemplo = form.idioma === "pt-BR" ? "30/12/2025" : "12/30/2025";
      const exemploVars: Record<string, string> = {
        nome: form.idioma === "pt-BR" ? "João" : form.idioma === "es-ES" ? "Juan" : "John",
        valor: valorExemplo,
        produto: form.idioma === "pt-BR" ? "Plano Pro" : form.idioma === "es-ES" ? "Plan Pro" : "Pro Plan",
        data_renovacao: dataExemplo,
      };
      const { data, error } = await supabase.functions.invoke("ligacoes-ia-tts", {
        body: { preview_text: form.texto.replace(/\{(\w+)\}/g, (_: any, k: string) => exemploVars[k] ?? `{${k}}`), preview_voice_id: form.voice_id || undefined },
      });
      if (error) throw error;
      const audio = new Audio((data as any).signed_url);
      audioRef.current = audio;
      
      // Update state for visual feedback
      audio.onended = () => {
        setPreviewing(false);
        audioRef.current = null;
      };
      audio.onerror = () => {
        setPreviewing(false);
        audioRef.current = null;
        toast({ title: "Erro ao reproduzir preview", variant: "destructive" });
      };

      await audio.play();
    } catch (e: any) {
      const description = e?.message?.includes("Failed to send a request")
        ? "O navegador bloqueou a chamada do preview. Atualize a página e tente novamente."
        : e.message;
      toast({ title: "Erro no preview", description, variant: "destructive" });
      setPreviewing(false);
    }
  };

  const title = isDuplicate ? "Duplicar roteiro" : (roteiro.id ? "Editar" : "Novo") + " roteiro";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
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

          <div className="grid grid-cols-3 gap-3 p-3 rounded-md border bg-muted/30">
            <div>
              <Label>Público</Label>
              <Select value={form.tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="brasileiro">Brasileiro</SelectItem>
                  <SelectItem value="estrangeiro">Estrangeiro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Idioma</Label>
              <Select value={form.idioma} onValueChange={v => setForm({ ...form, idioma: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt-BR">Português (BR)</SelectItem>
                  <SelectItem value="en-US">English (US)</SelectItem>
                  <SelectItem value="es-ES">Español (ES)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Moeda</Label>
              <Select value={form.moeda} onValueChange={v => setForm({ ...form, moeda: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">BRL (R$)</SelectItem>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-3 text-[11px] text-muted-foreground">
              A cobrança automática escolhe o roteiro de acordo com a moeda do cliente. Variável <code>{"{valor}"}</code> é formatada pela moeda deste roteiro.
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
            {form.idioma !== "pt-BR" && (
              <p className="text-xs text-muted-foreground mt-1">
                Dica: para {form.idioma === "en-US" ? "inglês" : "espanhol"}, escolha uma voz nativa (ex: Sarah, Brian).
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label>Texto (use {"{nome}"}, {"{valor}"}, {"{produto}"}, {"{data_renovacao}"})</Label>
              {form.idioma !== "pt-BR" && (
                <Button type="button" size="sm" variant="outline" onClick={translate} disabled={translating}>
                  {translating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Languages className="h-3 w-3 mr-1" />}
                  Traduzir com IA
                </Button>
              )}
            </div>
            <Textarea rows={5} value={form.texto} onChange={e => setForm({ ...form, texto: e.target.value })} />
            <p className="text-xs text-muted-foreground mt-1">
              Variáveis preenchidas automaticamente ao vincular cliente. {"{valor}"} respeita a moeda deste roteiro.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={form.ativo} onCheckedChange={c => setForm({ ...form, ativo: c })} />
            <Label>Ativo</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={preview} disabled={previewing && !audioRef.current}>
            {previewing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
            {previewing ? "Ouvindo..." : "Pré-ouvir"}
          </Button>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ CONSULTOR ============
function ConsultorTab({ provider, wavoipToken }: { provider: string; wavoipToken: string }) {
  const [numero, setNumero] = useState("");
  const [consultorPhone, setConsultorPhone] = useState(() => localStorage.getItem("ligacoes_consultor_phone") || "");
  const [calling, setCalling] = useState(false);
  const [callStatus, setCallStatus] = useState("");
  const [lastCallSid, setLastCallSid] = useState<string | null>(null);
  const callRef = useRef<ActiveCallHandle | null>(null);
  const twilioPollRef = useRef<number | null>(null);


  useEffect(() => {
    localStorage.setItem("ligacoes_consultor_phone", consultorPhone);
  }, [consultorPhone]);

  useEffect(() => () => {
    if (twilioPollRef.current) window.clearInterval(twilioPollRef.current);
  }, []);

  const startTwilioStatusPolling = (historicoId: string) => {
    if (twilioPollRef.current) window.clearInterval(twilioPollRef.current);

    const statusText: Record<string, string> = {
      iniciando: "Preparando ponte Twilio...",
      discando: "Twilio discando. Primeiro chama seu telefone; depois chama o cliente.",
      tocando: "Telefone chamando. Atenda e aguarde a conexão com o cliente.",
      atendida: "Chamada atendida. Mantendo a ponte ativa com o cliente.",
      finalizada: "Chamada finalizada.",
      nao_atendeu: "A chamada não foi atendida.",
      ocupado: "Número ocupado.",
      cancelada: "Chamada cancelada.",
      erro: "Falha ao conectar a chamada.",
    };

    let attempts = 0;
    twilioPollRef.current = window.setInterval(async () => {
      attempts += 1;
      const { data } = await supabase
        .from("ligacoes_ia_historico")
        .select("status,error_message")
        .eq("id", historicoId)
        .maybeSingle();

      if (!data) return;
      const status = data.status ?? "discando";
      setCallStatus(statusText[status] ?? STATUS_LABEL[status] ?? status);

      if (["finalizada", "nao_atendeu", "ocupado", "cancelada", "erro"].includes(status) || attempts >= 40) {
        if (twilioPollRef.current) window.clearInterval(twilioPollRef.current);
        twilioPollRef.current = null;
        setCalling(false);
        if (status !== "finalizada" || data.error_message) {
          const hasBridgeError = Boolean(data.error_message);
          toast({
            title: status === "finalizada" && !hasBridgeError ? "Chamada encerrada" : "Chamada não conectada",
            description: data.error_message || statusText[status] || "A ponte Twilio foi encerrada antes de conectar ao cliente.",
            variant: status === "finalizada" && !hasBridgeError ? "default" : "destructive",
          });
        }
      }
    }, 3000);
  };

  const ligar = async () => {
    const cleanNum = numero.replace(/\D/g, "");
    if (!cleanNum) return toast({ title: "Informe o número de destino", variant: "destructive" });
    
    if (provider === "twilio" && !consultorPhone.replace(/\D/g, "")) {
      return toast({ title: "Informe seu número (Consultor) para a ponte Twilio", variant: "destructive" });
    }

    setCalling(true);
    setCallStatus("Iniciando chamada...");

    try {
      if (provider === "wavoip") {
        // Wavoip: Uses WebRTC with real microphone
        const { data: config } = await supabase.from("ligacoes_ia_config").select("config_value").eq("config_key", "wavoip_token").maybeSingle();
        const token = config?.config_value;
        if (!token) throw new Error("Token Wavoip não configurado");

        const handle = await placeManualCall({
          token,
          phone: cleanNum,
          onStatus: (s) => setCallStatus(s),
          onEnded: () => { setCalling(false); setCallStatus(""); callRef.current = null; },
        });
        callRef.current = handle;
      } else {
        // Twilio: Uses Bridge (Calls consultant then bridges to customer)
        const data = await invokeFunction("ligacoes-ia-call", {
          body: {
            numero_destino: cleanNum,
            manual: true,
            consultor_phone: consultorPhone.replace(/\D/g, ""),
            source: "manual_consultor",
          },
        });
        
        const d = data as any;
        setLastCallSid(d?.call_sid || null);
        setCallStatus("Twilio ligando para você... Atenda e aguarde a chamada do cliente.");
        toast({ 
          title: "Chamada Twilio Iniciada", 
          description: "Atenda seu telefone e aguarde na linha enquanto o Twilio chama o cliente." 
        });
        if (d?.historico_id) startTwilioStatusPolling(d.historico_id);
      }
    } catch (e: any) {
      setCalling(false);
      setCallStatus("");
      toast({ title: "Erro ao ligar", description: e.message, variant: "destructive" });
    }
  };

  const desligar = async () => {
    if (twilioPollRef.current) {
      window.clearInterval(twilioPollRef.current);
      twilioPollRef.current = null;
    }

    if (provider === "twilio" && lastCallSid) {
      try {
        await invokeFunction("ligacoes-ia-call", {
          body: { action: "hangup", call_sid: lastCallSid }
        });
        setLastCallSid(null);
      } catch (e) {
        console.error("Erro ao desligar Twilio:", e);
      }
    }

    await callRef.current?.hangup();
    callRef.current = null;
    setCalling(false);
    setCallStatus("");
  };

  return (
    <Card className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">
          <User className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-semibold text-lg">Central do Consultor</h2>
          <p className="text-sm text-muted-foreground">Fale diretamente com o cliente através do {provider === "twilio" ? "Twilio (Ponte)" : "Wavoip (Navegador)"}</p>
        </div>
      </div>

      <div className="space-y-4">
        {provider === "twilio" && (
          <div className="p-4 rounded-lg border bg-amber-500/5 border-amber-500/20 mb-4">
            <Label className="flex items-center gap-2 mb-2">
              <PhoneCall className="h-4 w-4" /> Seu número (Consultor)
            </Label>
            <Input 
              value={consultorPhone} 
              onChange={e => setConsultorPhone(e.target.value)} 
              placeholder="Ex: 5511999999999"
              className="bg-background"
            />
            <p className="text-[10px] text-muted-foreground mt-2">
              O Twilio ligará para este número primeiro. Ao atender, você será conectado ao cliente.
            </p>
          </div>
        )}

        <div>
          <Label>Número do Cliente (DDI + DDD + Número)</Label>
          <div className="flex gap-2 mt-1.5">
            <Input 
              value={numero} 
              onChange={e => setNumero(e.target.value)} 
              placeholder="5511999999999" 
              className="text-lg font-mono"
            />
          </div>
        </div>

        {calling && (
          <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">{callStatus}</p>
              {provider === "wavoip" && <p className="text-xs text-muted-foreground">O microfone do seu computador está ativo.</p>}
            </div>
          </div>
        )}

        <div className="pt-2">
          {calling ? (
            <Button size="lg" variant="destructive" className="w-full h-14 text-lg" onClick={desligar}>
              <PhoneOff className="mr-2 h-5 w-5" /> Encerrar Chamada
            </Button>
          ) : (
            <Button size="lg" className="w-full h-14 text-lg bg-emerald-600 hover:bg-emerald-700" onClick={ligar}>
              <PhoneCall className="mr-2 h-5 w-5" /> Iniciar Ligação
            </Button>
          )}
        </div>

        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            {provider === "wavoip" 
              ? "Esta chamada utiliza o Wavoip e o microfone do seu navegador." 
              : "Esta chamada cria uma ponte entre seu número e o do cliente via Twilio."}
          </p>
        </div>
      </div>
    </Card>
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
  const [lastCallSid, setLastCallSid] = useState<string | null>(null);
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
      const data = await invokeFunction("ligacoes-ia-call", {
        body: {
          roteiro_id: roteiroId,
          numero_destino: numero.replace(/\D/g, ""),
          variables: { nome, valor },
          voice_id_override: voiceOverride || undefined,
          source: "manual",
        },
      });
      const d = data as any;
      if (d?.provider === "twilio") {
        setCallStatus("Ligação iniciada via Twilio...");
        setLastCallSid(d?.call_sid || null);
        setCalling(false); // In Twilio, we don't hold the call in the browser unless we want to allow hangup from UI
        // We'll keep calling true if we want to show the hangup button for Twilio PSTN calls too
        // but currently the AI flow is "fire and forget" or "bridge and hangup".
        // Let's enable hangup for Twilio PSTN manual fires too
        if (d?.call_sid) setCalling(true); 
        
        toast({ title: "Ligação Twilio iniciada", description: "O Twilio está discando para o cliente." });
        return;
      }
      
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
    if (lastCallSid) {
      try {
        await invokeFunction("ligacoes-ia-call", {
          body: { action: "hangup", call_sid: lastCallSid }
        });
        setLastCallSid(null);
      } catch (e) {
        console.error("Erro ao desligar Twilio:", e);
      }
    }
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
      <section className="space-y-4">
        <h3 className="font-semibold text-sm uppercase text-muted-foreground">Provedor de Ligação</h3>
        <div className="flex gap-4 p-4 rounded-lg border bg-muted/20">
          <div className="flex items-center space-x-2">
            <input 
              type="radio" 
              id="wavoip" 
              name="provider" 
              value="wavoip" 
              checked={cfg.calling_provider === "wavoip"} 
              onChange={() => setCfg({...cfg, calling_provider: "wavoip"})}
              className="w-4 h-4 text-primary"
            />
            <Label htmlFor="wavoip" className="cursor-pointer">Wavoip (WhatsApp)</Label>
          </div>
          <div className="flex items-center space-x-2">
            <input 
              type="radio" 
              id="twilio" 
              name="provider" 
              value="twilio" 
              checked={cfg.calling_provider === "twilio"} 
              onChange={() => setCfg({...cfg, calling_provider: "twilio"})}
              className="w-4 h-4 text-primary"
            />
            <Label htmlFor="twilio" className="cursor-pointer">Twilio (Ligação Normal)</Label>
          </div>
        </div>
      </section>

      {cfg.calling_provider === "wavoip" ? (
        <section className="space-y-3 p-4 rounded-lg border bg-card">
          <h3 className="font-semibold text-sm uppercase text-muted-foreground">Wavoip (WhatsApp)</h3>
          {field("wavoip_token", "Token Wavoip", "No painel da Wavoip, abra o Dispositivo (número WhatsApp) e copie o Token de API/Integração.", "password")}
          {field("wavoip_dialer_number", "Número WhatsApp Business discador", "Com DDI, sem símbolos. Ex: 5511999999999")}
        </section>
      ) : (
        <section className="space-y-3 p-4 rounded-lg border bg-card">
          <h3 className="font-semibold text-sm uppercase text-muted-foreground">Twilio (Ligação Normal)</h3>
          {field("twilio_account_sid", "Account SID", "Encontrado no console do Twilio.")}
          {field("twilio_auth_token", "Auth Token", "Encontrado no console do Twilio.", "password")}
          {field("twilio_phone_number", "Número Twilio (De)", "Seu número comprado no Twilio (ex: +1234567890)")}
        </section>
      )}

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
