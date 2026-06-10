import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Save, RefreshCw, History, CheckCircle2, XCircle, Clock, Hand, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const D_OPCOES = [
  { value: -3, label: "D-3" },
  { value: 0, label: "D+0" },
  { value: 1, label: "D+1" },
  { value: 2, label: "D+2" },
  { value: 5, label: "D+5" },
  { value: 7, label: "D+7" },
  { value: 10, label: "D+10" },
  { value: 15, label: "D+15" },
  { value: 30, label: "D+30" },
];

export function CobrancaConfigTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [cfg, setCfg] = useState<any>(null);
  const [roteiros, setRoteiros] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [logsOpen, setLogsOpen] = useState(false);

  const loadLogs = async () => {
    const { data } = await supabase
      .from("cobranca_ligacao_logs")
      .select("*")
      .order("executed_at", { ascending: false })
      .limit(30);
    setLogs(data ?? []);
  };

  const load = async () => {
    setLoading(true);
    const [c, r] = await Promise.all([
      supabase.from("cobranca_ligacao_config").select("*").limit(1).maybeSingle(),
      supabase.from("ligacoes_ia_roteiros").select("id, nome, categoria").eq("ativo", true).order("nome"),
    ]);
    setCfg(c.data ?? { enabled: false, delay_minutes: 5, dias_disparo: [5], horario_inicio: "09:00", horario_fim: "18:00", apenas_cobranca_ativa: false });
    setRoteiros(r.data ?? []);
    await loadLogs();
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleDia = (d: number) => {
    const set = new Set<number>(cfg.dias_disparo ?? []);
    if (set.has(d)) set.delete(d); else set.add(d);
    setCfg({ ...cfg, dias_disparo: Array.from(set).sort((a, b) => a - b) });
  };

  const save = async () => {
    setSaving(true);
    const payload = {
      enabled: cfg.enabled,
      roteiro_id: cfg.roteiro_id || null,
      delay_minutes: cfg.delay_minutes,
      dias_disparo: cfg.dias_disparo ?? [],
      horario_inicio: cfg.horario_inicio,
      horario_fim: cfg.horario_fim,
      apenas_cobranca_ativa: cfg.apenas_cobranca_ativa,
    };
    const q = cfg.id
      ? await supabase.from("cobranca_ligacao_config").update(payload).eq("id", cfg.id)
      : await supabase.from("cobranca_ligacao_config").insert(payload);
    setSaving(false);
    if (q.error) return toast({ title: "Erro ao salvar", description: q.error.message, variant: "destructive" });
    toast({ title: "Configuração salva" });
    load();
  };

  const sincronizarAgora = async () => {
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke("cobranca-ligacoes-enqueue", { body: { force: true } });
    setSyncing(false);
    await loadLogs();
    if (error) return toast({ title: "Erro ao sincronizar", description: error.message, variant: "destructive" });
    const d = data as any;
    toast({ title: "Fila sincronizada", description: `${d?.enqueued ?? 0} ligações enfileiradas hoje (${d?.scanned ?? 0} clientes encontrados).` });
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <Card className="p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Cobrança automática por ligação</h3>
        <p className="text-sm text-muted-foreground">A IA liga para os clientes em dias específicos do ciclo de cobrança. O operador precisa abrir a Fila do dia e iniciar.</p>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <Label className="text-base">Ativado</Label>
          <p className="text-xs text-muted-foreground">Quando ligado, o sistema cria a fila diariamente às 07:00.</p>
        </div>
        <Switch checked={!!cfg.enabled} onCheckedChange={(v) => setCfg({ ...cfg, enabled: v })} />
      </div>

      <div>
        <Label>Roteiro</Label>
        <Select value={cfg.roteiro_id ?? ""} onValueChange={(v) => setCfg({ ...cfg, roteiro_id: v })}>
          <SelectTrigger><SelectValue placeholder="Selecione um roteiro ativo" /></SelectTrigger>
          <SelectContent>
            {roteiros.map((r) => <SelectItem key={r.id} value={r.id}>{r.nome} ({r.categoria})</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Dias do ciclo que disparam ligação</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {D_OPCOES.map((d) => {
            const active = (cfg.dias_disparo ?? []).includes(d.value);
            return (
              <Badge
                key={d.value}
                variant={active ? "default" : "outline"}
                className="cursor-pointer select-none"
                onClick={() => toggleDia(d.value)}
              >
                {d.label}
              </Badge>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-1">Ex.: D-3 = 3 dias antes do vencimento. D+5 = exatamente 5 dias de atraso. A ligação só dispara nos dias marcados.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Delay entre ligações (min)</Label>
          <Input type="number" min={0} max={120} value={cfg.delay_minutes}
            onChange={(e) => setCfg({ ...cfg, delay_minutes: Number(e.target.value) })} />
        </div>
        <div>
          <Label>Horário início</Label>
          <Input type="time" value={cfg.horario_inicio?.slice(0, 5) ?? ""} onChange={(e) => setCfg({ ...cfg, horario_inicio: e.target.value })} />
        </div>
        <div>
          <Label>Horário fim</Label>
          <Input type="time" value={cfg.horario_fim?.slice(0, 5) ?? ""} onChange={(e) => setCfg({ ...cfg, horario_fim: e.target.value })} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch checked={!!cfg.apenas_cobranca_ativa} onCheckedChange={(v) => setCfg({ ...cfg, apenas_cobranca_ativa: v })} />
        <Label>Somente clientes mensais (com cobrança ativa)</Label>
      </div>

      <div className="flex gap-2">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar
        </Button>
        <Button variant="outline" onClick={sincronizarAgora} disabled={syncing}>
          {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Sincronizar fila de hoje
        </Button>
      </div>

      <Collapsible open={logsOpen} onOpenChange={setLogsOpen}>
        <div className="flex items-center justify-between border-t pt-4">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <History className="h-4 w-4 mr-2" />
              {logsOpen ? "Ocultar histórico" : "Ver histórico de execuções"}
              {logs.length > 0 && <Badge variant="outline" className="ml-2">{logs.length}</Badge>}
            </Button>
          </CollapsibleTrigger>
          <Button variant="ghost" size="sm" onClick={loadLogs} className="text-muted-foreground">
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
        <CollapsibleContent className="mt-3">
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma execução registrada ainda.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logs.map((log) => {
                const Icon = log.status === "success" ? CheckCircle2 : log.status === "error" ? XCircle : Clock;
                const iconColor = log.status === "success" ? "text-primary" : log.status === "error" ? "text-destructive" : "text-muted-foreground";
                return (
                  <div key={log.id} className="flex items-start justify-between gap-3 p-3 rounded-lg bg-muted/40 text-sm">
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${iconColor}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">
                            {format(new Date(log.executed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
                          {log.triggered_by === "manual" && (
                            <Badge variant="outline" className="text-xs h-5"><Hand className="h-3 w-3 mr-1" />Manual</Badge>
                          )}
                          {(log.dias_processados ?? []).length > 0 && (
                            <span className="text-xs text-muted-foreground">
                              Dias: {(log.dias_processados as number[]).map((d) => d === 0 ? "D+0" : d > 0 ? `D+${d}` : `D-${Math.abs(d)}`).join(", ")}
                            </span>
                          )}
                        </div>
                        {log.message && <p className="text-xs text-muted-foreground mt-1">{log.message}</p>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {log.enqueued > 0 && <Badge variant="outline" className="text-primary border-primary/30 text-xs">+{log.enqueued} enfileiradas</Badge>}
                      {log.scanned > 0 && <Badge variant="outline" className="text-muted-foreground text-xs">{log.scanned} encontrados</Badge>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
