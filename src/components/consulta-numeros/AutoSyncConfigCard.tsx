import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Clock, CheckCircle, AlertCircle, Play } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AutoSyncConfig {
  id: string;
  is_active: boolean;
  interval_minutes: number;
  last_auto_sync_at: string | null;
  next_scheduled_at: string | null;
  created_at: string;
  updated_at: string;
}

const intervalOptions = [
  { value: '1', label: '1 minuto' },
  { value: '5', label: '5 minutos' },
  { value: '10', label: '10 minutos' },
  { value: '15', label: '15 minutos' },
  { value: '30', label: '30 minutos' },
  { value: '60', label: '1 hora' },
  { value: '120', label: '2 horas' },
  { value: '180', label: '3 horas' },
  { value: '360', label: '6 horas' },
  { value: '600', label: '10 horas' },
  { value: '720', label: '12 horas' },
  { value: '1440', label: '24 horas' },
];

export function AutoSyncConfigCard() {
  const queryClient = useQueryClient();
  const [isTestingSyncNow, setIsTestingSyncNow] = useState(false);

  // Fetch auto-sync config
  const { data: config, isLoading, error } = useQuery({
    queryKey: ['auto-sync-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consulta_numeros_auto_sync_config')
        .select('*')
        .single();

      if (error) {
        // If no row exists, create one
        if (error.code === 'PGRST116') {
          const { data: newData, error: insertError } = await supabase
            .from('consulta_numeros_auto_sync_config')
            .insert({ is_active: false, interval_minutes: 60 })
            .select()
            .single();

          if (insertError) throw insertError;
          return newData as AutoSyncConfig;
        }
        throw error;
      }

      return data as AutoSyncConfig;
    },
  });

  // Update config mutation
  const updateConfigMutation = useMutation({
    mutationFn: async (updates: Partial<AutoSyncConfig>) => {
      if (!config?.id) throw new Error('No config found');

      const { error } = await supabase
        .from('consulta_numeros_auto_sync_config')
        .update(updates)
        .eq('id', config.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-sync-config'] });
      toast.success('Configuração salva!');
    },
    onError: (error: any) => {
      toast.error('Erro ao salvar: ' + error.message);
    },
  });

  // Test sync now
  const handleTestSync = async () => {
    setIsTestingSyncNow(true);
    try {
      const { data, error } = await supabase.functions.invoke('auto-sync-consulta-numeros');
      
      if (error) throw error;

      if (data?.skipped) {
        toast.info(data.message || 'Sincronização pulada');
      } else if (data?.success) {
        toast.success(`Sincronização concluída! ${data.rows_synced || 0} números sincronizados`);
        queryClient.invalidateQueries({ queryKey: ['auto-sync-config'] });
        queryClient.invalidateQueries({ queryKey: ['consulta-numeros'] });
        queryClient.invalidateQueries({ queryKey: ['consulta-numeros-sync-status'] });
      }
    } catch (error: any) {
      toast.error('Erro na sincronização: ' + error.message);
    } finally {
      setIsTestingSyncNow(false);
    }
  };

  const handleToggleActive = (checked: boolean) => {
    updateConfigMutation.mutate({ is_active: checked });
  };

  const handleIntervalChange = (value: string) => {
    updateConfigMutation.mutate({ interval_minutes: parseInt(value, 10) });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>Erro ao carregar configuração</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Sincronização Automática
            </CardTitle>
            <CardDescription>
              Configure a sincronização automática com o Baserow
            </CardDescription>
          </div>
          <Badge variant={config?.is_active ? 'default' : 'secondary'}>
            {config?.is_active ? 'Ativo' : 'Inativo'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Toggle ativo */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="auto-sync-active">Sincronização automática</Label>
            <p className="text-sm text-muted-foreground">
              Sincroniza automaticamente com o Baserow no intervalo configurado
            </p>
          </div>
          <Switch
            id="auto-sync-active"
            checked={config?.is_active || false}
            onCheckedChange={handleToggleActive}
            disabled={updateConfigMutation.isPending}
          />
        </div>

        {/* Intervalo */}
        <div className="space-y-2">
          <Label htmlFor="sync-interval">Intervalo de sincronização</Label>
          <Select
            value={String(config?.interval_minutes || 60)}
            onValueChange={handleIntervalChange}
            disabled={updateConfigMutation.isPending}
          >
            <SelectTrigger id="sync-interval" className="w-full">
              <SelectValue placeholder="Selecione o intervalo" />
            </SelectTrigger>
            <SelectContent>
              {intervalOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status */}
        <div className="rounded-lg bg-muted/50 p-4 space-y-3">
          <h4 className="font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Status da Sincronização
          </h4>

          <div className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Última sincronização automática:</span>
              <span className="font-medium">
                {config?.last_auto_sync_at ? (
                  <span className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    {format(new Date(config.last_auto_sync_at), "dd/MM/yyyy, HH:mm:ss", { locale: ptBR })}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Nunca executada</span>
                )}
              </span>
            </div>

            {config?.is_active && config?.next_scheduled_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Próxima sincronização:</span>
                <span className="font-medium">
                  {format(new Date(config.next_scheduled_at), "dd/MM/yyyy, HH:mm:ss", { locale: ptBR })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Testar agora */}
        <Button
          onClick={handleTestSync}
          disabled={isTestingSyncNow}
          variant="outline"
          className="w-full"
        >
          {isTestingSyncNow ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Sincronizando...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Testar sincronização agora
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          O botão acima executa a sincronização imediatamente para testar se está funcionando.
          A sincronização automática roda em segundo plano no intervalo configurado.
        </p>
      </CardContent>
    </Card>
  );
}
