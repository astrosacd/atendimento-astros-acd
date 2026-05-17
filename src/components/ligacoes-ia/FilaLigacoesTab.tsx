import { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Play, Pause, RefreshCw, Loader2, PhoneCall, CheckCircle2, XCircle, Clock, PhoneOff } from "lucide-react";
import { placeCallWithTTS, type ActiveCallHandle } from "@/lib/wavoipCall";

type Agendada = {
  id: string;
  cliente_id: string;
  roteiro_id: string | null;
  tipo_d: string;
  status: "pendente" | "em_andamento" | "finalizada" | "falhou" | "cancelada";
  tentativas: number;
  processada_em: string | null;
  erro: string | null;
  historico_id: string | null;
  campanha_id: string | null;
  clientes?: { nome: string; numero: string } | null;
  ligacoes_campanhas?: { nome: string; delay_minutes_override: number | null } | null;
};

const STATUS_LABEL: Record<Agendada["status"], { label: string; cls: string; icon: any }> = {
  pendente: { label: "Pendente", cls: "bg-slate-500", icon: Clock },
  em_andamento: { label: "Em andamento", cls: "bg-blue-500", icon: PhoneCall },
  finalizada: { label: "Finalizada", cls: "bg-emerald-600", icon: CheckCircle2 },
  falhou: { label: "Falhou", cls: "bg-destructive", icon: XCircle },
  cancelada: { label: "Cancelada", cls: "bg-amber-500", icon: XCircle },
};

export function FilaLigacoesTab() {
  const [items, setItems] = useState<Agendada[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [currentStatus, setCurrentStatus] = useState<string>("");
  const [countdown, setCountdown] = useState<number>(0);
  const [delayMinutes, setDelayMinutes] = useState<number>(5);
  const [syncing, setSyncing] = useState(false);

  const runningRef = useRef(false);
  const pauseRef = useRef(false);
  const callRef = useRef<ActiveCallHandle | null>(null);
  const cdTimerRef = useRef<any>(null);

  const hoje = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: cfg }, { data }] = await Promise.all([
      supabase.from("cobranca_ligacao_config").select("delay_minutes").limit(1).maybeSingle(),
      supabase
        .from("ligacoes_agendadas")
        .select("*, clientes(nome, numero)")
        .eq("dia_alvo", hoje)
        .order("created_at"),
    ]);
    setDelayMinutes(cfg?.delay_minutes ?? 5);
    setItems((data ?? []) as any);
    setLoading(false);
  }, [hoje]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel("ligacoes_agendadas_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "ligacoes_agendadas" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const pendentes = items.filter((i) => i.status === "pendente");
  const finalizadas = items.filter((i) => i.status === "finalizada").length;
  const falhadas = items.filter((i) => i.status === "falhou").length;

  const sincronizar = async () => {
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke("cobranca-ligacoes-enqueue", { body: {} });
    setSyncing(false);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: "Sincronizado", description: `${(data as any)?.enqueued ?? 0} novas ligações na fila.` });
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
    setCurrentStatus(`Iniciando ligação para ${item.clientes?.nome ?? item.cliente_id}...`);
    await supabase.from("ligacoes_agendadas").update({ status: "em_andamento", tentativas: item.tentativas + 1 }).eq("id", item.id);

    try {
      const { data, error } = await supabase.functions.invoke("ligacoes-ia-call", {
        body: { cliente_id: item.cliente_id, roteiro_id: item.roteiro_id, source: "fila_cobranca" },
      });
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
          onStatus: (s) => setCurrentStatus(`${item.clientes?.nome ?? ""}: ${s}`),
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

    // refresh from DB to grab latest pendentes
    const { data: fresh } = await supabase
      .from("ligacoes_agendadas")
      .select("*, clientes(nome, numero)")
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
        setCurrentStatus(`Aguardando ${delayMinutes} min antes da próxima...`);
        await sleepWithCountdown(delayMinutes * 60 * 1000);
        // honor pause during delay
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
          <div className="flex gap-4 text-sm">
            <div><span className="text-2xl font-bold">{pendentes.length}</span> <span className="text-muted-foreground">pendentes</span></div>
            <div><span className="text-2xl font-bold text-emerald-600">{finalizadas}</span> <span className="text-muted-foreground">feitas</span></div>
            <div><span className="text-2xl font-bold text-destructive">{falhadas}</span> <span className="text-muted-foreground">falharam</span></div>
            <div className="text-muted-foreground self-center text-xs">Delay: <span className="font-medium text-foreground">{delayMinutes}min</span></div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={sincronizar} disabled={syncing || running}>
              {syncing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Sincronizar
            </Button>
            {!running ? (
              <Button onClick={startQueue} disabled={pendentes.length === 0}>
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

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left p-3">Cliente</th>
              <th className="text-left p-3">Número</th>
              <th className="text-left p-3">D</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Processada</th>
              <th className="text-left p-3">Erro</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhuma ligação na fila para hoje. Clique em <strong>Sincronizar</strong>.</td></tr>
            )}
            {items.map((it) => {
              const s = STATUS_LABEL[it.status];
              const Icon = s.icon;
              return (
                <tr key={it.id} className="border-t">
                  <td className="p-3">{it.clientes?.nome ?? "—"}</td>
                  <td className="p-3 font-mono text-xs">{it.clientes?.numero ?? "—"}</td>
                  <td className="p-3"><Badge variant="outline">{it.tipo_d}</Badge></td>
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1 text-white text-xs px-2 py-0.5 rounded ${s.cls}`}>
                      <Icon className="h-3 w-3" /> {s.label}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{it.processada_em ? new Date(it.processada_em).toLocaleTimeString("pt-BR") : "—"}</td>
                  <td className="p-3 text-xs text-destructive max-w-xs truncate" title={it.erro ?? ""}>{it.erro ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
