import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Zap, Clock, Play, History, AlertTriangle, Copy, Settings, Power, PowerOff, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

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

const PRIORITY_LABELS: Record<string, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  urgente: 'Urgente',
};

export function AutomationRulesPanel() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  // Edit/Duplicate dialog state
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [isEditMode, setIsEditMode] = useState(false); // true = edit, false = duplicate
  const [formName, setFormName] = useState('');
  const [formDays, setFormDays] = useState('30');
  const [formDedupDays, setFormDedupDays] = useState('7');
  const [formPriority, setFormPriority] = useState('urgente');
  const [formDueDateDays, setFormDueDateDays] = useState('5');
  const [formSaving, setFormSaving] = useState(false);

  // Cron config state
  const [cronHour, setCronHour] = useState('9');
  const [cronMinute, setCronMinute] = useState('0');
  const [cronActive, setCronActive] = useState(false);
  const [cronLoading, setCronLoading] = useState(true);
  const [cronSaving, setCronSaving] = useState(false);

  useEffect(() => { loadData(); loadCronSchedule(); }, []);

  const loadCronSchedule = async () => {
    setCronLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_automations_cron_schedule');
      if (!error && data && data.length > 0) {
        setCronActive(true);
        const parts = data[0].schedule.split(' ');
        const utcMinute = parseInt(parts[0]);
        let utcHour = parseInt(parts[1]);
        let brtHour = utcHour - 3;
        if (brtHour < 0) brtHour += 24;
        setCronHour(String(brtHour));
        setCronMinute(String(utcMinute));
      } else {
        setCronActive(false);
      }
    } catch {
      setCronActive(false);
    }
    setCronLoading(false);
  };

  const saveCronSchedule = async () => {
    setCronSaving(true);
    try {
      const { error } = await supabase.rpc('update_automations_cron_schedule', {
        p_hour: parseInt(cronHour),
        p_minute: parseInt(cronMinute),
      });
      if (error) throw error;
      toast.success(`Cron configurado para ${cronHour.padStart(2, '0')}:${cronMinute.padStart(2, '0')} (Brasília)`);
      setCronActive(true);
    } catch (err: any) {
      toast.error('Erro ao salvar horário: ' + (err.message || 'Erro desconhecido'));
    }
    setCronSaving(false);
  };

  const disableCron = async () => {
    setCronSaving(true);
    try {
      const { error } = await supabase.rpc('disable_automations_cron');
      if (error) throw error;
      toast.success('Cron de automações desativado');
      setCronActive(false);
    } catch {
      toast.error('Erro ao desativar cron');
    }
    setCronSaving(false);
  };

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

  const openDialog = (rule: AutomationRule, edit: boolean) => {
    setEditingRule(rule);
    setIsEditMode(edit);
    setFormName(edit ? rule.name : rule.name + ' (cópia)');
    setFormDays(String(rule.trigger_config?.days || 30));
    setFormDedupDays(String(rule.trigger_config?.dedup_days ?? 7));
    setFormPriority(rule.action_config?.priority || 'urgente');
    setFormDueDateDays(String(rule.action_config?.due_date_days ?? 5));
  };

  const handleSave = async () => {
    if (!editingRule) return;
    setFormSaving(true);

    const triggerConfig = {
      ...editingRule.trigger_config,
      days: parseInt(formDays) || 30,
      dedup_days: parseInt(formDedupDays) || 7,
    };
    const actionConfig = {
      ...editingRule.action_config,
      priority: formPriority,
      due_date_days: parseInt(formDueDateDays) || 5,
    };

    if (isEditMode) {
      const { error } = await supabase
        .from('automation_rules')
        .update({
          name: formName,
          trigger_config: triggerConfig,
          action_config: actionConfig,
        })
        .eq('id', editingRule.id);

      setFormSaving(false);
      if (error) { toast.error('Erro ao salvar regra'); return; }
      toast.success('Regra atualizada com sucesso');
    } else {
      const { error } = await supabase.from('automation_rules').insert({
        name: formName,
        description: editingRule.description,
        trigger_type: editingRule.trigger_type,
        trigger_config: triggerConfig,
        action_type: editingRule.action_type,
        action_config: actionConfig,
        is_active: false,
      });

      setFormSaving(false);
      if (error) { toast.error('Erro ao duplicar regra'); return; }
      toast.success('Regra duplicada com sucesso');
    }

    setEditingRule(null);
    await loadData();
  };

  if (loading) {
    return <div className="text-muted-foreground text-center py-8">Carregando automações...</div>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Cron Config */}
      <Card className="p-4 bg-card border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm text-foreground">Execução Automática (Cron)</h3>
          </div>
          <Badge variant={cronActive ? 'default' : 'secondary'} className="text-[10px]">
            {cronLoading ? 'Carregando...' : cronActive ? 'Ativo' : 'Inativo'}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Configure o horário diário para executar automaticamente as regras de automação.
        </p>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="space-y-1.5">
            <Label className="text-xs">Hora (Brasília)</Label>
            <Select value={cronHour} onValueChange={setCronHour}>
              <SelectTrigger className="w-[80px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, i) => (
                  <SelectItem key={i} value={String(i)}>{String(i).padStart(2, '0')}h</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Minuto</Label>
            <Select value={cronMinute} onValueChange={setCronMinute}>
              <SelectTrigger className="w-[80px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m => (
                  <SelectItem key={m} value={String(m)}>{String(m).padStart(2, '0')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={saveCronSchedule} disabled={cronSaving} className="gap-1.5 h-8">
            <Power className="h-3.5 w-3.5" />
            {cronSaving ? 'Salvando...' : 'Salvar Horário'}
          </Button>
          {cronActive && (
            <Button size="sm" variant="outline" onClick={disableCron} disabled={cronSaving} className="gap-1.5 h-8 text-destructive hover:text-destructive">
              <PowerOff className="h-3.5 w-3.5" />
              Desativar
            </Button>
          )}
        </div>
        {cronActive && (
          <p className="text-[10px] text-muted-foreground mt-2">
            Próxima execução: todos os dias às {cronHour.padStart(2, '0')}:{cronMinute.padStart(2, '0')} (horário de Brasília)
          </p>
        )}
      </Card>

      <Separator />

      {/* Rules */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Regras de Automação</h3>
        <Button onClick={runNow} disabled={running} size="sm" className="gap-1.5">
          <Play className="h-3.5 w-3.5" />
          {running ? 'Executando...' : 'Executar Agora'}
        </Button>
      </div>

      {rules.map(rule => {
        const dedupDays = rule.trigger_config?.dedup_days ?? 7;
        const dueDateDays = rule.action_config?.due_date_days ?? 5;
        const priority = rule.action_config?.priority || 'urgente';

        return (
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
                  {rule.action_type === 'create_task' && (
                    <>
                      <Badge variant="outline" className="text-[10px]">
                        Prioridade: {PRIORITY_LABELS[priority] || priority}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        Prazo: +{dueDateDays} dias
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        Repetição: a cada {dedupDays} dias
                      </Badge>
                    </>
                  )}
                  {rule.last_run_at && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      Última execução: {format(new Date(rule.last_run_at), 'dd/MM/yy HH:mm')}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar regra" onClick={() => openDialog(rule, true)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" title="Duplicar regra" onClick={() => openDialog(rule, false)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Switch checked={rule.is_active} onCheckedChange={v => toggleRule(rule.id, v)} />
              </div>
            </div>
          </Card>
        );
      })}

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

      {/* Edit/Duplicate Dialog */}
      <Dialog open={!!editingRule} onOpenChange={open => !open && setEditingRule(null)}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditMode ? 'Editar Regra' : 'Duplicar Regra'}</DialogTitle>
            <DialogDescription>
              {isEditMode ? 'Altere as configurações da regra.' : 'Altere o nome e configurações para a nova regra.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome da regra</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} />
            </div>
            {editingRule?.trigger_type === 'renewal_delay' && (
              <>
                <div className="space-y-2">
                  <Label>Dias de atraso (gatilho)</Label>
                  <Input type="number" min={1} value={formDays} onChange={e => setFormDays(e.target.value)} />
                  <p className="text-[10px] text-muted-foreground">Clientes com renovação atrasada há X dias serão selecionados.</p>
                </div>
                <div className="space-y-2">
                  <Label>Intervalo de repetição (dias)</Label>
                  <Input type="number" min={1} value={formDedupDays} onChange={e => setFormDedupDays(e.target.value)} />
                  <p className="text-[10px] text-muted-foreground">
                    Após criar tarefa para um cliente, só criará novamente após esse período. Ex: 7 = a cada 7 dias.
                  </p>
                </div>
              </>
            )}
            {editingRule?.action_type === 'create_task' && (
              <>
                <div className="space-y-2">
                  <Label>Prioridade da tarefa</Label>
                  <Select value={formPriority} onValueChange={setFormPriority}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="urgente">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Prazo da tarefa (dias à frente)</Label>
                  <Input type="number" min={1} value={formDueDateDays} onChange={e => setFormDueDateDays(e.target.value)} />
                  <p className="text-[10px] text-muted-foreground">
                    A tarefa será criada com data de vencimento X dias à frente. Ex: 5 = prazo de 5 dias.
                  </p>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRule(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={formSaving || !formName.trim()}>
              {formSaving ? 'Salvando...' : isEditMode ? 'Salvar' : 'Duplicar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
