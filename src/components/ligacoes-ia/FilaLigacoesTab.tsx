import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Play, Pause, RefreshCw, Loader2, PhoneCall, CheckCircle2, XCircle,
  Clock, PhoneOff, Search, User, UserCheck, PhoneMissed, PhoneIncoming, AlertTriangle,
  Trash2, Megaphone, Bot,
} from "lucide-react";
import { placeCallWithTTS, type ActiveCallHandle } from "@/lib/wavoipCall";

type Agendada = {
  id: string;
  cliente_id: string | null;
  roteiro_id: string | null;
  tipo_d: string;
  status: "pendente" | "em_andamento" | "finalizada" | "falhou" | "cancelada";
  tentativas: number;
  processada_em: string | null;
  erro: string | null;
  historico_id: string | null;
  campanha_id: string | null;
  nome_manual: string | null;
  numero_manual: string | null;
  clientes?: { nome: string; numero: string; produto: string | null; cobranca_ativa: boolean | null } | null;
  ligacoes_campanhas?: { nome: string; delay_minutes_override: number | null } | null;
  ligacoes_ia_historico?: {
    status: string | null;
    duration_seconds: number | null;
    answered_at: string | null;
    ended_at: string | null;
    error_message: string | null;
  } | null;
};

const STATUS_LABEL: Record<Agendada["status"], { label: string; cls: string; icon: any }> = {
  pendente: { label: "Pendente", cls: "bg-slate-500", icon: Clock },
  em_andamento: { label: "Em andamento", cls: "bg-blue-500", icon: PhoneCall },
  finalizada: { label: "Finalizada", cls: "bg-emerald-600", icon: CheckCircle2 },
  falhou: { label: "Falhou", cls: "bg-destructive", icon: XCircle },
  cancelada: { label: "Cancelada", cls: "bg-amber-500", icon: XCircle },
};

// Mapeia o status do histórico para um rótulo amigável de resultado
function describeOutcome(it: Agendada): { label: string; icon: any; cls: string } | null {
  const h = it.ligacoes_ia_historico;
  if (!h) return null;
  const dur = h.duration_seconds ?? 0;
  const s = (h.status ?? "").toLowerCase();

  if (s.includes("no_answer") || s.includes("nao_atendeu") || (h.answered_at == null && h.ended_at != null)) {
    return { label: "Não atendeu", icon: PhoneMissed, cls: "text-amber-500" };
  }
  if (s.includes("hangup_short") || (h.answered_at && dur > 0 && dur < 8)) {
    return { label: `Desligou (${dur}s)`, icon: PhoneOff, cls: "text-orange-500" };
  }
  if (s.includes("complet") || s.includes("finaliz") || (h.answered_at && dur >= 8)) {
    return { label: `Concluída (${dur}s)`, icon: PhoneIncoming, cls: "text-emerald-500" };
  }
  if (s.includes("fail") || s.includes("error")) {
    return { label: "Erro na chamada", icon: AlertTriangle, cls: "text-destructive" };
  }
  return { label: h.status ?? "—", icon: PhoneCall, cls: "text-muted-foreground" };
}

function friendlyError(err: string | null): string {
  if (!err) return "—";
  const e = err.toLowerCase();
  if (e.includes("token")) return "Token Wavoip inválido/ausente";
  if (e.includes("audio")) return "Falha ao gerar áudio (TTS)";
  if (e.includes("network") || e.includes("fetch")) return "Falha de rede";
  if (e.includes("timeout")) return "Tempo esgotado";
  if (e.includes("not enabled") || e.includes("free tier")) return "ElevenLabs bloqueado (Free Tier)";
  if (e.includes("quota")) return "Cota ElevenLabs esgotada";
  if (e.length > 80) return err.slice(0, 80) + "…";
  return err;
}

function todayInBrazil() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function FilaLigacoesTab() {
  const [items, setItems] = useState<Agendada[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [, setPausedAt] = useState<number | null>(null);
  const [currentStatus, setCurrentStatus] = useState<string>("");
  const [countdown, setCountdown] = useState<number>(0);
  const [delayMinutes, setDelayMinutes] = useState<number>(5);
  const [syncing, setSyncing] = useState(false);
  const [confirmStart, setConfirmStart] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [filterTipoD, setFilterTipoD] = useState<string>("todos");
  const [search, setSearch] = useState("");

  const runningRef = useRef(false);
  const pauseRef = useRef(false);
  const callRef = useRef<ActiveCallHandle | null>(null);
  const cdTimerRef = useRef<any>(null);

  const hoje = useMemo(() => todayInBrazil(), []);

  const loadedOnceRef = useRef(false);
  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? loadedOnceRef.current;
    if (!silent) setLoading(true);
    const [{ data: cfg }, { data }] = await Promise.all([
      supabase.from("cobranca_ligacao_config").select("delay_minutes").limit(1).maybeSingle(),
      supabase
        .from("ligacoes_agendadas")
        .select("*, clientes(nome, numero, produto, cobranca_ativa), ligacoes_campanhas(nome, delay_minutes_override), ligacoes_ia_historico(status, duration_seconds, answered_at, ended_at, error_message)")
        .eq("dia_alvo", hoje)
        .order("created_at"),
    ]);
    setDelayMinutes(cfg?.delay_minutes ?? 5);
    setItems((data ?? []) as any);
    if (!silent) setLoading(false);
    loadedOnceRef.current = true;
  }, [hoje]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel("ligacoes_agendadas_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "ligacoes_agendadas" }, () => load({ silent: true }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const pendentes = items.filter((i) => i.status === "pendente");
  const finalizadas = items.filter((i) => i.status === "finalizada").length;
  const falhadas = items.filter((i) => i.status === "falhou").length;

  const tipoDOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => i.tipo_d && set.add(i.tipo_d));
    return Array.from(set);
  }, [items]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((it) => {
      if (filterStatus === "todos") {
        if (it.status === "cancelada") return false;
      } else if (it.status !== filterStatus) return false;
      if (filterTipoD !== "todos" && it.tipo_d !== filterTipoD) return false;
      if (!term) return true;
      const nome = (it.clientes?.nome ?? it.nome_manual ?? "").toLowerCase();
      const num = (it.clientes?.numero ?? it.numero_manual ?? "").toLowerCase();
      const prod = (it.clientes?.produto ?? "").toLowerCase();
      return nome.includes(term) || num.includes(term) || prod.includes(term);
    });
  }, [items, filterStatus, filterTipoD, search]);

  const sincronizar = async () => {
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke("cobranca-ligacoes-enqueue", { body: { force: true } });
    setSyncing(false);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    const d = data as any;
    const enq = d?.enqueued ?? 0;
    const scanned = d?.scanned ?? 0;
    const dias = Array.isArray(d?.dias_processados) ? d.dias_processados.join(", ") : "—";
    let desc = "";
    if (enq > 0) {
      desc = `${enq} nova(s) ligação(ões) adicionada(s) à fila.`;
    } else if (scanned > 0) {
      desc = `${scanned} cliente(s) elegível(is) já estavam na fila. Nada novo para enfileirar.`;
    } else {
      desc = `Nenhum cliente bate com a regra atual (D+${dias} da data de renovação). Ajuste em Configurações → Cobrança IA se necessário.`;
    }
    toast({ title: "Sincronização concluída", description: desc });
    load();
  };

  const alvosLimpar = items.filter((i) => i.status === "pendente" && !i.campanha_id);

  const limparFila = async () => {
    if (alvosLimpar.length === 0) {
      toast({ title: "Nada a limpar", description: "Não há pendentes de Cobrança automática hoje." });
      return;
    }
    const { error } = await supabase
      .from("ligacoes_agendadas")
      .update({ status: "cancelada" })
      .eq("dia_alvo", hoje)
      .eq("status", "pendente")
      .is("campanha_id", null);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: "Fila limpa", description: `${alvosLimpar.length} ligações canceladas.` });
    setConfirmClear(false);
    load();
  };

  const sleepWithCountdown = (ms: number) =>
    new Promise<void>((resolve) => {
      let remaining = Math.ceil(ms / 1000);
      setCountdown(remaining);
      cdTimerRef.current = setInterval(() => {
        remaining -= 1;
        setCountdown(remaining);
        if (remaining <= 0 || !runningRef.current) {
          clearInterval(cdTimerRef.current);
          cdTimerRef.current = null;
          resolve();
        }
      }, 1000);
    });

  const processOne = async (item: Agendada) => {
    const displayName = item.clientes?.nome ?? item.nome_manual ?? item.cliente_id ?? "contato";
    setCurrentStatus(`Iniciando ligação para ${displayName}...`);
    await supabase.from("ligacoes_agendadas").update({ status: "em_andamento", tentativas: item.tentativas + 1 }).eq("id", item.id);

    try {
      const payload: any = { roteiro_id: item.roteiro_id, source: "fila_cobranca" };
      if (item.cliente_id) {
        payload.cliente_id = item.cliente_id;
      } else if (item.numero_manual) {
        payload.numero_destino = item.numero_manual;
        payload.variables = { nome: item.nome_manual ?? "" };
      } else {
        throw new Error("Item sem cliente nem número manual");
      }
      const { data, error } = await supabase.functions.invoke("ligacoes-ia-call", { body: payload });
      if (error) throw error;
      const d = data as any;
      if (!d?.wavoip_token || !d?.audio_url || !d?.phone) throw new Error("Resposta inválida (faltam token/áudio/número)");

      await supabase.from("ligacoes_agendadas").update({ historico_id: d.historico_id }).eq("id", item.id);

      await new Promise<void>((resolve, reject) => {
        placeCallWithTTS({
          token: d.wavoip_token,
          phone: d.phone,
          audioUrl: d.audio_url,
          historicoId: d.historico_id,
          onStatus: (s) => setCurrentStatus(`${displayName}: ${s}`),
          onEnded: () => { callRef.current = null; resolve(); },
        }).then((handle) => { callRef.current = handle; }).catch(reject);
      });

      await supabase.from("ligacoes_agendadas").update({ status: "finalizada", processada_em: new Date().toISOString(), erro: null }).eq("id", item.id);
    } catch (e: any) {
      await supabase.from("ligacoes_agendadas").update({
        status: "falhou",
        processada_em: new Date().toISOString(),
        erro: e?.message ?? String(e),
      }).eq("id", item.id);
    }
  };

  const startQueue = async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    pauseRef.current = false;
    setRunning(true);
    setPausedAt(null);

    const { data: fresh } = await supabase
      .from("ligacoes_agendadas")
      .select("*, clientes(nome, numero, produto, cobranca_ativa), ligacoes_campanhas(nome, delay_minutes_override)")
      .eq("dia_alvo", hoje)
      .eq("status", "pendente")
      .order("created_at");

    const queue = (fresh ?? []) as Agendada[];
    for (let i = 0; i < queue.length; i++) {
      if (!runningRef.current) break;
      while (pauseRef.current && runningRef.current) {
        await new Promise((r) => setTimeout(r, 500));
      }
      if (!runningRef.current) break;

      await processOne(queue[i]);

      const isLast = i === queue.length - 1;
      if (!isLast && runningRef.current) {
        const next = queue[i + 1];
        const effectiveDelay = next?.ligacoes_campanhas?.delay_minutes_override ?? delayMinutes;
        setCurrentStatus(`Aguardando ${effectiveDelay} min antes da próxima...`);
        await sleepWithCountdown(effectiveDelay * 60 * 1000);
        while (pauseRef.current && runningRef.current) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }
    }

    runningRef.current = false;
    setRunning(false);
    setCurrentStatus("");
    setCountdown(0);
    toast({ title: "Fila concluída" });
    load();
  };

  const pause = () => {
    pauseRef.current = true;
    setPausedAt(Date.now());
    setCurrentStatus("Pausada — clique em Retomar para continuar.");
  };

  const resume = () => {
    pauseRef.current = false;
    setPausedAt(null);
  };

  const stopAll = async () => {
    runningRef.current = false;
    pauseRef.current = false;
    if (cdTimerRef.current) { clearInterval(cdTimerRef.current); cdTimerRef.current = null; }
    await callRef.current?.hangup();
    callRef.current = null;
    setRunning(false);
    setCurrentStatus("");
    setCountdown(0);
  };

  useEffect(() => {
    return () => {
      runningRef.current = false;
      if (cdTimerRef.current) clearInterval(cdTimerRef.current);
      callRef.current?.hangup().catch(() => {});
    };
  }, []);

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-4 text-sm flex-wrap">
            <div><span className="text-2xl font-bold">{pendentes.length}</span> <span className="text-muted-foreground">pendentes</span></div>
            <div><span className="text-2xl font-bold text-emerald-600">{finalizadas}</span> <span className="text-muted-foreground">feitas</span></div>
            <div><span className="text-2xl font-bold text-destructive">{falhadas}</span> <span className="text-muted-foreground">falharam</span></div>
            <div className="text-muted-foreground self-center text-xs">Delay: <span className="font-medium text-foreground">{delayMinutes}min</span></div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={sincronizar} disabled={syncing || running}>
              {syncing ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Sincronizando...</>
              ) : (
                <><RefreshCw className="h-4 w-4 mr-1" /> Sincronizar</>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmClear(true)} disabled={syncing || running}>
              <Trash2 className="h-4 w-4 mr-1" /> Limpar fila de hoje
            </Button>
            {!running ? (
              <Button onClick={() => setConfirmStart(true)} disabled={pendentes.length === 0}>
                <Play className="h-4 w-4 mr-1" /> {finalizadas + falhadas > 0 ? "Retomar fila" : "Iniciar fila"}
              </Button>
            ) : (
              <>
                {pauseRef.current ? (
                  <Button variant="outline" onClick={resume}><Play className="h-4 w-4 mr-1" /> Retomar</Button>
                ) : (
                  <Button variant="outline" onClick={pause}><Pause className="h-4 w-4 mr-1" /> Pausar</Button>
                )}
                <Button variant="destructive" onClick={stopAll}><PhoneOff className="h-4 w-4 mr-1" /> Parar tudo</Button>
              </>
            )}
          </div>
        </div>

        {running && (
          <div className="mt-3 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/5 p-3 text-sm flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-fuchsia-500" />
            <span>{currentStatus}</span>
            {countdown > 0 && (
              <span className="ml-auto font-mono text-xs">
                {String(Math.floor(countdown / 60)).padStart(2, "0")}:{String(countdown % 60).padStart(2, "0")}
              </span>
            )}
          </div>
        )}

        {!running && pendentes.length > 0 && finalizadas + falhadas > 0 && (
          <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
            📞 Ainda faltam <strong>{pendentes.length}</strong> ligações a disparar hoje. Clique em <strong>Retomar fila</strong>.
          </div>
        )}
      </Card>

      {/* Filtros */}
      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-8 h-9"
              placeholder="Buscar nome, número ou produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[170px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="em_andamento">Em andamento</SelectItem>
              <SelectItem value="finalizada">Finalizada</SelectItem>
              <SelectItem value="falhou">Falhou</SelectItem>
              <SelectItem value="cancelada">Cancelada</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterTipoD} onValueChange={setFilterTipoD}>
            <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {tipoDOptions.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-xs text-muted-foreground ml-auto">
            {filteredItems.length} de {items.length}
          </div>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="max-h-[60vh] overflow-y-auto overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground sticky top-0 z-10">
              <tr>
                <th className="text-left p-3 w-10"></th>
                <th className="text-left p-3">Cliente / Contato</th>
                <th className="text-left p-3">Tipo / Produto</th>
                <th className="text-left p-3">Número</th>
                <th className="text-left p-3">D</th>
                <th className="text-left p-3">Origem</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Resultado</th>
                <th className="text-left p-3">Hora</th>
                <th className="text-left p-3">Erro</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 && (
                <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">
                  {items.length === 0
                    ? <>Nenhuma ligação na fila para hoje. Clique em <strong>Sincronizar</strong>.</>
                    : "Nenhum item corresponde aos filtros."}
                </td></tr>
              )}
              {filteredItems.map((it) => {
                const s = STATUS_LABEL[it.status];
                const Icon = s.icon;
                const toggleable = it.status === "pendente" || it.status === "cancelada";
                const willCall = it.status === "pendente";
                const outcome = describeOutcome(it);
                const isManual = !it.cliente_id;
                const nome = it.clientes?.nome ?? it.nome_manual ?? "—";
                const numero = it.clientes?.numero ?? it.numero_manual ?? "—";
                const produto = it.clientes?.produto ?? (isManual ? "Contato manual" : "—");
                const isMensal = it.clientes?.cobranca_ativa === true;

                const onToggle = async () => {
                  if (!toggleable || running) return;
                  const novo = willCall ? "cancelada" : "pendente";
                  // Atualização otimista local — evita recarregar a tabela inteira
                  setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, status: novo } : p)));
                  const { error } = await supabase
                    .from("ligacoes_agendadas")
                    .update({ status: novo })
                    .eq("id", it.id);
                  if (error) {
                    // Reverte em caso de erro
                    setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, status: it.status } : p)));
                    toast({ title: "Erro", description: error.message, variant: "destructive" });
                  }
                };
                return (
                  <tr key={it.id} className={`border-t ${it.status === "cancelada" ? "opacity-60" : ""}`}>
                    <td className="p-3">
                      <Checkbox
                        checked={willCall}
                        disabled={!toggleable || running}
                        onCheckedChange={onToggle}
                        title={willCall ? "Desmarcar (não ligar)" : "Marcar (ligar)"}
                      />
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5 font-medium">
                        {isManual ? <User className="h-3.5 w-3.5 text-purple-500" /> : <UserCheck className="h-3.5 w-3.5 text-blue-500" />}
                        <span className="truncate max-w-[180px]" title={nome}>{nome}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col gap-0.5">
                        {isManual ? (
                          <Badge variant="outline" className="w-fit border-purple-500/40 text-purple-400 text-[10px]">Manual</Badge>
                        ) : isMensal ? (
                          <Badge variant="outline" className="w-fit border-emerald-500/40 text-emerald-400 text-[10px]">📅 Mensal</Badge>
                        ) : (
                          <Badge variant="outline" className="w-fit border-sky-500/40 text-sky-400 text-[10px]">📋 Registro</Badge>
                        )}
                        <span className="text-xs text-muted-foreground truncate max-w-[180px]" title={produto}>{produto}</span>
                      </div>
                    </td>
                    <td className="p-3 font-mono text-xs">{numero}</td>
                    <td className="p-3"><Badge variant="outline">{it.tipo_d}</Badge></td>
                    <td className="p-3 text-xs">
                      {it.campanha_id ? (
                        <div className="flex items-center gap-1" title={`Campanha: ${it.ligacoes_campanhas?.nome ?? "—"}`}>
                          <Megaphone className="h-3 w-3 text-fuchsia-500 shrink-0" />
                          <span className="truncate max-w-[140px]">{it.ligacoes_campanhas?.nome ?? "Campanha"}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-muted-foreground" title={`Cobrança automática — ${it.tipo_d}`}>
                          <Bot className="h-3 w-3 text-blue-500 shrink-0" />
                          <span>Cobrança auto</span>
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 text-white text-xs px-2 py-0.5 rounded ${s.cls}`}>
                        <Icon className="h-3 w-3" /> {s.label}
                      </span>
                    </td>
                    <td className="p-3 text-xs">
                      {outcome ? (
                        <span className={`inline-flex items-center gap-1 ${outcome.cls}`}>
                          <outcome.icon className="h-3 w-3" /> {outcome.label}
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{it.processada_em ? new Date(it.processada_em).toLocaleTimeString("pt-BR") : "—"}</td>
                    <td className="p-3 text-xs text-destructive max-w-[220px] truncate" title={it.erro ?? ""}>
                      {friendlyError(it.erro)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <AlertDialog open={confirmStart} onOpenChange={setConfirmStart}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Iniciar fila de ligações de hoje?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Serão disparadas <strong>{pendentes.length}</strong> ligações pendentes,
                  com delay de <strong>{delayMinutes} min</strong> entre cada uma.
                </p>
                <p className="text-xs text-muted-foreground">
                  ⚠️ Mantenha esta aba aberta — o navegador é quem disca.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="max-h-[280px] overflow-y-auto rounded border bg-muted/30 text-xs">
            <table className="w-full">
              <thead className="bg-muted/60 sticky top-0">
                <tr>
                  <th className="text-left p-2">#</th>
                  <th className="text-left p-2">Nome</th>
                  <th className="text-left p-2">Tipo</th>
                  <th className="text-left p-2">D</th>
                  <th className="text-left p-2">Origem</th>
                </tr>
              </thead>
              <tbody>
                {pendentes.map((p, idx) => {
                  const manual = !p.cliente_id;
                  const tipo = manual ? "Manual" : (p.clientes?.cobranca_ativa ? "Mensal" : "Registro");
                  const origem = p.campanha_id ? (p.ligacoes_campanhas?.nome ?? "Campanha") : "Cobrança auto";
                  return (
                    <tr key={p.id} className="border-t">
                      <td className="p-2 text-muted-foreground">{idx + 1}</td>
                      <td className="p-2">{p.clientes?.nome ?? p.nome_manual ?? "—"}</td>
                      <td className="p-2">{tipo}</td>
                      <td className="p-2"><Badge variant="outline" className="text-[10px]">{p.tipo_d}</Badge></td>
                      <td className="p-2 truncate max-w-[140px]" title={origem}>{origem}</td>
                    </tr>
                  );
                })}
                {pendentes.length === 0 && (
                  <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Nenhum pendente.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmStart(false); startQueue(); }} disabled={pendentes.length === 0}>
              <Play className="h-4 w-4 mr-1" /> Confirmar e iniciar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar fila de hoje?</AlertDialogTitle>
            <AlertDialogDescription>
              Serão canceladas <strong>{alvosLimpar.length}</strong> ligações pendentes de{" "}
              <strong>Cobrança automática</strong>. Ligações de campanhas não serão afetadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={limparFila} disabled={alvosLimpar.length === 0}>
              <Trash2 className="h-4 w-4 mr-1" /> Confirmar e limpar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
