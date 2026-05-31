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
  Play, Pause, RefreshCw, Loader2, MessageSquare, CheckCircle2, XCircle,
  Clock, Search, User, UserCheck, PhoneMissed, PhoneIncoming, AlertTriangle,
  Trash2, Megaphone, Bot, ExternalLink,
} from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { copyToClipboard } from "@/utils/clipboard";

const FILA_FLAG_KEY = "sms_fila_executando";
const FILA_STANDALONE_PATH = "/central-sms/fila-executando";

type AgendadoSMS = {
  id: string;
  cliente_id: string | null;
  template_id: string | null;
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
  sms_campanhas?: { nome: string; delay_minutes_override: number | null } | null;
  sms_history?: {
    status: string | null;
    error_message: string | null;
  } | null;
};

const STATUS_LABEL: Record<AgendadoSMS["status"], { label: string; cls: string; icon: any }> = {
  pendente: { label: "Pendente", cls: "bg-slate-500", icon: Clock },
  em_andamento: { label: "Enviando", cls: "bg-blue-500", icon: MessageSquare },
  finalizada: { label: "Enviado", cls: "bg-emerald-600", icon: CheckCircle2 },
  falhou: { label: "Falhou", cls: "bg-destructive", icon: XCircle },
  cancelada: { label: "Cancelada", cls: "bg-amber-500", icon: XCircle },
};

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

export function FilaSMSTab({ mode = "normal" }: { mode?: "normal" | "standalone" } = {}) {
  const isStandalone = mode === "standalone";
  const { hasPermission } = usePermissions();
  const canExecute = hasPermission("execute_sms_fila");

  const openFilaTab = () => {
    const search = window.location.search;
    const handoffParam = search ? (search.includes('?') ? '&handoff=1' : '?handoff=1') : '?handoff=1';
    const url = `${FILA_STANDALONE_PATH}${search}${handoffParam}`;
    
    const win = window.open(url, "_blank");
    if (!win) {
      copyToClipboard(url.toString());
      toast({
        title: "Pop-up bloqueado",
        description: "Link copiado. Cole numa nova guia ou libere pop-ups.",
        variant: "destructive",
      });
      return;
    }

    const handleHandoffRequest = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== win) return;
      if (event.data?.type !== "SMS_IA_AUTH_HANDOFF_REQUEST") return;

      const { data: { session } } = await supabase.auth.getSession();
      win.postMessage({
        type: "SMS_IA_AUTH_HANDOFF_RESPONSE",
        session: session ? {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        } : null,
      }, window.location.origin);
    };

    window.addEventListener("message", handleHandoffRequest);
    window.setTimeout(() => window.removeEventListener("message", handleHandoffRequest), 15000);
  };

  const [items, setItems] = useState<AgendadoSMS[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string>("");
  const [countdown, setCountdown] = useState<number>(0);
  const [delayMinutes, setDelayMinutes] = useState<number>(5);
  const [syncing, setSyncing] = useState(false);
  const [confirmStart, setConfirmStart] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const [remoteRunning, setRemoteRunning] = useState<boolean>(() => {
    if (isStandalone) return false;
    try { return !!localStorage.getItem(FILA_FLAG_KEY); } catch { return false; }
  });

  useEffect(() => {
    if (isStandalone) return;
    const sync = () => {
      try { setRemoteRunning(!!localStorage.getItem(FILA_FLAG_KEY)); } catch {}
    };
    const onStorage = (e: StorageEvent) => { if (e.key === FILA_FLAG_KEY) sync(); };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", sync);
    const itv = window.setInterval(sync, 2000);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", sync);
      window.clearInterval(itv);
    };
  }, [isStandalone]);

  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [filterTipoD, setFilterTipoD] = useState<string>("todos");
  const [search, setSearch] = useState("");

  const runningRef = useRef(false);
  const pauseRef = useRef(false);
  const cdTimerRef = useRef<any>(null);

  const hoje = useMemo(() => todayInBrazil(), []);

  const loadedOnceRef = useRef(false);
  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? loadedOnceRef.current;
    if (!silent) setLoading(true);
    const [{ data: cfg }, { data }] = await Promise.all([
      supabase.from("sms_cobranca_config").select("delay_minutes").limit(1).maybeSingle(),
      supabase
        .from("sms_agendados")
        .select("*, clientes(nome, numero, produto, cobranca_ativa), sms_campanhas(nome, delay_minutes_override), sms_history(status, error_message)")
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
      .channel("sms_agendados_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "sms_agendados" }, () => load({ silent: true }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const pendentes = items.filter((i) => i.status === "pendente");
  const finalizadas = items.filter((i) => i.status === "finalizada").length;
  const falhadas = items.filter((i) => i.status === "falhou").length;

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
    const { data, error } = await supabase.functions.invoke("cobranca-sms-enqueue", { body: { force: true } });
    setSyncing(true); // Keep syncing true while reload happens
    if (error) {
      setSyncing(false);
      return toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
    const d = data as any;
    toast({ title: "Sincronização concluída", description: `${d?.enqueued ?? 0} novos SMS enfileirados.` });
    await load();
    setSyncing(false);
  };

  const limparFila = async () => {
    const { error } = await supabase
      .from("sms_agendados")
      .update({ status: "cancelada" })
      .eq("dia_alvo", hoje)
      .eq("status", "pendente")
      .is("campanha_id", null);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: "Fila limpa", description: "SMS pendentes de Cobrança cancelados." });
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

  const processOne = async (item: AgendadoSMS) => {
    const displayName = item.clientes?.nome ?? item.nome_manual ?? "contato";
    setCurrentStatus(`Enviando SMS para ${displayName}...`);
    await supabase.from("sms_agendados").update({ status: "em_andamento", tentativas: item.tentativas + 1 }).eq("id", item.id);

    try {
      const payload: any = { 
        template_id: item.template_id,
        source: "fila_sms",
        campanha_id: item.campanha_id 
      };
      if (item.cliente_id) {
        payload.cliente_id = item.cliente_id;
      } else if (item.numero_manual) {
        payload.to = item.numero_manual;
        payload.variables = { nome: item.nome_manual ?? "" };
      } else {
        throw new Error("Item sem cliente nem número manual");
      }

      const { data, error } = await supabase.functions.invoke("send-sms", { body: payload });
      if (error) throw error;
      
      const d = data as any;
      await supabase.from("sms_agendados").update({ 
        status: "finalizada",
        historico_id: d.id,
        processada_em: new Date().toISOString()
      }).eq("id", item.id);

    } catch (e: any) {
      console.error("Erro na fila SMS:", e);
      await supabase.from("sms_agendados").update({ 
        status: "falhou", 
        erro: e.message || "Erro desconhecido",
        processada_em: new Date().toISOString()
      }).eq("id", item.id);
    }
  };

  const startFila = async () => {
    if (running || remoteRunning) return;
    setRunning(true);
    runningRef.current = true;
    pauseRef.current = false;
    localStorage.setItem(FILA_FLAG_KEY, "1");
    setConfirmStart(false);

    try {
      while (runningRef.current && !pauseRef.current) {
        const { data: currentItems } = await supabase
          .from("sms_agendados")
          .select("id, status")
          .eq("dia_alvo", hoje)
          .eq("status", "pendente")
          .order("created_at")
          .limit(1);

        if (!currentItems || currentItems.length === 0) {
          setCurrentStatus("Fila concluída!");
          break;
        }

        const fullItem = items.find((i) => i.id === currentItems[0].id);
        if (fullItem) {
          await processOne(fullItem);
          
          if (runningRef.current && !pauseRef.current) {
            const override = fullItem.sms_campanhas?.delay_minutes_override;
            const finalDelay = (override != null ? override : delayMinutes) * 60 * 1000;
            if (finalDelay > 0) {
              setCurrentStatus(`Aguardando delay de ${finalDelay / 1000 / 60} min...`);
              await sleepWithCountdown(finalDelay);
            }
          }
        } else {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    } finally {
      setRunning(false);
      runningRef.current = false;
      localStorage.removeItem(FILA_FLAG_KEY);
      setCountdown(0);
      setCurrentStatus("");
    }
  };

  const pauseFila = () => {
    pauseRef.current = true;
    runningRef.current = false;
    setCurrentStatus("Pausando...");
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 flex flex-col items-center justify-center text-center space-y-1">
          <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Total Hoje</span>
          <span className="text-3xl font-bold">{items.length}</span>
        </Card>
        <Card className="p-4 flex flex-col items-center justify-center text-center space-y-1">
          <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Pendentes</span>
          <span className="text-3xl font-bold text-blue-500">{pendentes.length}</span>
        </Card>
        <Card className="p-4 flex flex-col items-center justify-center text-center space-y-1">
          <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Enviados</span>
          <span className="text-3xl font-bold text-emerald-500">{finalizadas}</span>
        </Card>
        <Card className="p-4 flex flex-col items-center justify-center text-center space-y-1">
          <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Falhas</span>
          <span className="text-3xl font-bold text-destructive">{falhadas}</span>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {!isStandalone && (
              <Button onClick={openFilaTab} variant="outline" size="icon" title="Executar em nova guia" className="h-12 w-12 border-blue-200">
                <ExternalLink className="h-5 w-5 text-blue-600" />
              </Button>
            )}
            {!running ? (
              <Button 
                onClick={() => setConfirmStart(true)} 
                disabled={pendentes.length === 0 || remoteRunning || !canExecute}
                className="bg-blue-600 hover:bg-blue-700 h-12 px-6 shadow-lg shadow-blue-500/20"
              >
                <Play className="h-5 w-5 mr-2" /> Iniciar Fila do Dia
              </Button>
            ) : (
              <Button onClick={pauseFila} variant="outline" className="h-12 px-6 border-blue-200">
                <Pause className="h-5 w-5 mr-2 text-blue-600" /> Pausar
              </Button>
            )}

            {running && (
              <div className="flex flex-col">
                <div className="flex items-center gap-2 text-sm font-medium animate-pulse text-blue-600">
                  <Bot className="h-4 w-4" /> {currentStatus}
                </div>
                {countdown > 0 && (
                  <div className="text-[10px] text-muted-foreground font-mono">
                    Próximo envio em {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, "0")}
                  </div>
                )}
              </div>
            )}

            {remoteRunning && !running && (
              <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-2 rounded-md border border-amber-200">
                <AlertTriangle className="h-4 w-4" /> Fila sendo executada em outra guia.
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={sincronizar} disabled={syncing || running}>
              {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Sincronizar Cobrança
            </Button>
            <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => setConfirmClear(true)} disabled={running}>
              <Trash2 className="h-4 w-4 mr-2" /> Limpar Fila
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nome ou número..." 
              className="h-9 w-64"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Pendentes/Fim</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
                <SelectItem value="finalizada">Enviados</SelectItem>
                <SelectItem value="falhou">Falhas</SelectItem>
                <SelectItem value="cancelada">Cancelados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="p-3 text-left font-medium">Contato</th>
                <th className="p-3 text-left font-medium">Origem</th>
                <th className="p-3 text-left font-medium">Status</th>
                <th className="p-3 text-left font-medium">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Carregando fila...</td></tr>
              ) : filteredItems.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Nenhum registro encontrado para hoje.</td></tr>
              ) : (
                filteredItems.map((it) => {
                  const conf = STATUS_LABEL[it.status] || STATUS_LABEL.pendente;
                  const Icon = conf.icon;
                  return (
                    <tr key={it.id} className="hover:bg-muted/30">
                      <td className="p-3">
                        <div className="flex flex-col">
                          <span className="font-medium">{it.clientes?.nome ?? it.nome_manual ?? "—"}</span>
                          <span className="text-xs text-muted-foreground">{it.clientes?.numero ?? it.numero_manual ?? "—"}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col">
                          <span className="text-xs font-medium">{it.sms_campanhas?.nome ?? (it.tipo_d ? `Cobrança ${it.tipo_d}` : "Manual")}</span>
                          {it.clientes?.produto && <span className="text-[10px] text-muted-foreground">Prod: {it.clientes.produto}</span>}
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge className={`${conf.cls} flex items-center gap-1 w-fit`}>
                          <Icon className="h-3 w-3" /> {conf.label}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="text-xs">
                          {it.status === "finalizada" && <span className="text-emerald-600 font-medium">Enviado</span>}
                          {it.status === "falhou" && <span className="text-destructive font-medium" title={it.erro}>Falhou: {it.erro?.slice(0, 20)}...</span>}
                          {it.status === "pendente" && <span className="text-muted-foreground">Aguardando...</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <AlertDialog open={confirmStart} onOpenChange={setConfirmStart}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deseja iniciar o envio automático?</AlertDialogTitle>
            <AlertDialogDescription>
              O sistema enviará SMS para todos os <strong>{pendentes.length}</strong> contatos pendentes
              respeitando o delay configurado. Mantenha esta aba aberta durante o processo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Agora não</AlertDialogCancel>
            <AlertDialogAction onClick={startFila} className="bg-blue-600 hover:bg-blue-700">Sim, iniciar envios</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar fila de cobrança?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso cancelará todos os SMS pendentes de hoje que NÃO fazem parte de campanhas manuais.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={limparFila} className="bg-destructive hover:bg-destructive/90">Sim, limpar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
