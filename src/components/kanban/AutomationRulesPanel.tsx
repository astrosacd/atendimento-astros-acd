import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Zap, Clock, Play, History, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

interface AutomationRule {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger_config: any;
  action_type: string;
  action_config: any;
  is_active: boolean;
  last_run_at: string | null;
  created_at: string;
}

interface AutomationLog {
  id: string;
  rule_id: string;
  cliente_id: string | null;
  action_taken: string;
  result: string | null;
  created_at: string;
}

const TRIGGER_LABELS: Record<string, string> = {
  renewal_delay: 'Atraso na renovação',
  proposal_accepted: 'Proposta aceita',
  payment_confirmed: 'Pagamento confirmado',
  client_created: 'Cliente cadastrado',
};

const ACTION_LABELS: Record<string, string> = {
  create_task: 'Criar tarefa',
  move_pipeline: 'Mover no pipeline',
  send_notification: 'Enviar notificação',
};

export function AutomationRulesPanel() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [rulesRes, logsRes] = await Promise.all([
      supabase.from('automation_rules').select('*').order('created_at'),
      supabase.from('automation_logs').select('*').order('created_at', { ascending: false }).limit(50),
    ]);
    if (rulesRes.data) setRules(rulesRes.data as AutomationRule[]);
    if (logsRes.data) setLogs(logsRes.data as AutomationLog[]);
    setLoading(false);
  };

  const toggleRule = async (id: string, active: boolean) => {
    const { error } = await supabase.from('automation_rules').update({ is_active: active }).eq('id', id);
    if (error) { toast.error('Erro ao atualizar regra'); return; }
    setRules(prev => prev.map(r => r.id === id ? { ...r, is_active: active } : r));
    toast.success(active ? 'Automação ativada' : 'Automação desativada');
  };

  const runNow = async () => {
    setRunning(true);
    try {
      const { error } = await supabase.functions.invoke('process-automations');
      if (error) throw error;
      toast.success('Automações executadas com sucesso');
      await loadData();
    } catch (err: any) {
      toast.error('Erro ao executar automações: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return <div className="text-muted-foreground text-center py-8">Carregando automações...</div>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Rules */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Regras de Automação</h3>
        <Button onClick={runNow} disabled={running} size="sm" className="gap-1.5">
          <Play className="h-3.5 w-3.5" />
          {running ? 'Executando...' : 'Executar Agora'}
        </Button>
      </div>

      {rules.map(rule => (
        <Card key={rule.id} className="p-4 bg-card border-border">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="h-4 w-4 text-amber-500 shrink-0" />
                <span className="font-medium text-sm text-foreground">{rule.name}</span>
              </div>
              {rule.description && (
                <p className="text-xs text-muted-foreground mb-2 ml-6">{rule.description}</p>
              )}
              <div className="flex items-center gap-2 ml-6 flex-wrap">
                <Badge variant="outline" className="text-[10px]">
                  Gatilho: {TRIGGER_LABELS[rule.trigger_type] || rule.trigger_type}
                  {rule.trigger_config?.days && ` (${rule.trigger_config.days} dias)`}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  Ação: {ACTION_LABELS[rule.action_type] || rule.action_type}
                </Badge>
                {rule.last_run_at && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    Última execução: {format(new Date(rule.last_run_at), 'dd/MM/yy HH:mm')}
                  </span>
                )}
              </div>
            </div>
            <Switch checked={rule.is_active} onCheckedChange={v => toggleRule(rule.id, v)} />
          </div>
        </Card>
      ))}

      {rules.length === 0 && (
        <Card className="p-8 bg-card border-border text-center text-muted-foreground">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhuma regra de automação configurada</p>
        </Card>
      )}

      {/* Logs */}
      {logs.length > 0 && (
        <div>
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <History className="h-4 w-4" /> Histórico de Execuções
          </h3>
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-1.5">
              {logs.map(log => (
                <div key={log.id} className="flex items-center gap-3 text-xs py-1.5 px-3 rounded bg-secondary/30">
                  <span className="text-muted-foreground shrink-0">
                    {format(new Date(log.created_at), 'dd/MM HH:mm')}
                  </span>
                  <span className="text-foreground truncate flex-1">{log.action_taken}</span>
                  {log.result && <Badge variant="secondary" className="text-[10px]">{log.result}</Badge>}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
