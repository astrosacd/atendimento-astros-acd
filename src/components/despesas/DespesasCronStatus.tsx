import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  RefreshCw, CheckCircle2, XCircle, Clock, Loader2, 
  Calendar, Play, History
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface CronConfig {
  id: string;
  is_active: boolean;
  day_of_month: number;
  last_run_at: string | null;
  last_run_status: string | null;
  last_run_message: string | null;
  next_run_at: string | null;
}

interface CronLog {
  id: string;
  executed_at: string;
  status: string;
  message: string | null;
  despesas_created: number;
  despesas_skipped: number;
  target_month: string | null;
}

export function DespesasCronStatus() {
  const { toast } = useToast();
  const [config, setConfig] = useState<CronConfig | null>(null);
  const [logs, setLogs] = useState<CronLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    
    const [configResult, logsResult] = await Promise.all([
      supabase
        .from('despesas_cron_config')
        .select('*')
        .limit(1)
        .single(),
      supabase
        .from('despesas_cron_logs')
        .select('*')
        .order('executed_at', { ascending: false })
        .limit(10),
    ]);

    if (configResult.data) {
      setConfig(configResult.data as CronConfig);
    }
    
    if (logsResult.data) {
      setLogs(logsResult.data as CronLog[]);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleCron = async () => {
    if (!config) return;

    const { error } = await supabase
      .from('despesas_cron_config')
      .update({ is_active: !config.is_active })
      .eq('id', config.id);

    if (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar a configuração.',
        variant: 'destructive',
      });
      return;
    }

    setConfig({ ...config, is_active: !config.is_active });
    toast({
      title: 'Sucesso',
      description: `Cron ${!config.is_active ? 'ativado' : 'desativado'} com sucesso.`,
    });
  };

  const runManually = async () => {
    setIsRunning(true);

    try {
      const { data, error } = await supabase.functions.invoke('despesas-cron');

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: data?.message || 'Cron executado com sucesso!',
      });

      // Refresh data
      await fetchData();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível executar o cron.',
        variant: 'destructive',
      });
    } finally {
      setIsRunning(false);
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const formatMonth = (month: string | null) => {
    if (!month) return '-';
    const [year, m] = month.split('-');
    const date = new Date(parseInt(year), parseInt(m) - 1, 1);
    return format(date, 'MMMM/yyyy', { locale: ptBR });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Geração Automática de Despesas
          </CardTitle>
          <div className="flex items-center gap-2">
            <Label htmlFor="cron-active" className="text-sm text-muted-foreground">
              {config?.is_active ? 'Ativo' : 'Inativo'}
            </Label>
            <Switch
              id="cron-active"
              checked={config?.is_active || false}
              onCheckedChange={toggleCron}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          {/* Last run */}
          <div className="flex items-start gap-3">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
              config?.last_run_status === 'success' 
                ? 'bg-primary/20' 
                : config?.last_run_status === 'error'
                ? 'bg-destructive/20'
                : 'bg-muted'
            }`}>
              {config?.last_run_status === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-primary" />
              ) : config?.last_run_status === 'error' ? (
                <XCircle className="h-4 w-4 text-destructive" />
              ) : (
                <Clock className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Última Execução</p>
              <p className="text-sm font-medium">
                {config?.last_run_at ? formatDate(config.last_run_at) : 'Nunca executado'}
              </p>
              {config?.last_run_message && (
                <p className="text-xs text-muted-foreground">{config.last_run_message}</p>
              )}
            </div>
          </div>

          {/* Next run */}
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-info/20 flex items-center justify-center">
              <Calendar className="h-4 w-4 text-info" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Próxima Execução</p>
              <p className="text-sm font-medium">
                {config?.is_active 
                  ? config?.next_run_at 
                    ? formatDate(config.next_run_at)
                    : 'Dia 1 do próximo mês'
                  : 'Desativado'}
              </p>
            </div>
          </div>

          {/* Manual run */}
          <div className="flex items-center justify-end">
            <Button 
              size="sm" 
              onClick={runManually} 
              disabled={isRunning}
              variant="outline"
            >
              {isRunning ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Executar Agora
            </Button>
          </div>
        </div>

        {/* Logs collapsible */}
        <Collapsible open={isLogsOpen} onOpenChange={setIsLogsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground">
              <History className="h-4 w-4 mr-2" />
              {isLogsOpen ? 'Ocultar histórico' : 'Ver histórico de execuções'}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma execução registrada ainda.
              </p>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => (
                  <div 
                    key={log.id} 
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      {log.status === 'success' ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                      <span className="text-muted-foreground">
                        {formatDate(log.executed_at)}
                      </span>
                      <span>•</span>
                      <span>{formatMonth(log.target_month)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {log.despesas_created > 0 && (
                        <Badge variant="outline" className="text-primary border-primary/30">
                          +{log.despesas_created} criadas
                        </Badge>
                      )}
                      {log.despesas_skipped > 0 && (
                        <Badge variant="outline" className="text-muted-foreground">
                          {log.despesas_skipped} existentes
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
