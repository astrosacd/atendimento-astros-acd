import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, Save, Loader2, AlertTriangle } from 'lucide-react';
import { useNumerosAlertConfig, useUpdateNumerosAlertConfig } from '@/hooks/useNumerosAquecimentoAlerts';
import { useNumerosStatus } from '@/hooks/useNumerosAquecimento';
import { Checkbox } from '@/components/ui/checkbox';

const statusColorMap: Record<string, string> = {
  green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-700/30 dark:text-slate-400',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  gray: 'bg-gray-100 text-gray-700 dark:bg-gray-700/30 dark:text-gray-400',
};

export function AlertConfigCard() {
  const { data: config, isLoading: isLoadingConfig } = useNumerosAlertConfig();
  const { data: statusList = [] } = useNumerosStatus();
  const updateConfig = useUpdateNumerosAlertConfig();

  const [isActive, setIsActive] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [intervalHours, setIntervalHours] = useState(2);
  const [intervalMinutes, setIntervalMinutes] = useState(0);

  // Load config values
  useEffect(() => {
    if (config) {
      setIsActive(config.is_active);
      setSelectedStatuses(config.status_to_monitor || []);
      setIntervalHours(config.alert_interval_hours || 2);
      setIntervalMinutes(config.alert_interval_minutes || 0);
    }
  }, [config]);

  const handleSave = () => {
    updateConfig.mutate({
      is_active: isActive,
      status_to_monitor: selectedStatuses,
      alert_interval_hours: intervalHours,
      alert_interval_minutes: intervalMinutes,
    });
  };

  const toggleStatus = (statusId: string) => {
    setSelectedStatuses(prev => 
      prev.includes(statusId)
        ? prev.filter(id => id !== statusId)
        : [...prev, statusId]
    );
  };

  const hasChanges = config && (
    config.is_active !== isActive ||
    JSON.stringify(config.status_to_monitor || []) !== JSON.stringify(selectedStatuses) ||
    config.alert_interval_hours !== intervalHours ||
    config.alert_interval_minutes !== intervalMinutes
  );

  if (isLoadingConfig) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-amber-500" />
          Configuração de Alertas
        </CardTitle>
        <CardDescription>
          Configure alertas para números com status específicos que requerem atenção
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Active Toggle */}
        <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
          <div className="space-y-0.5">
            <Label className="text-base font-medium">Alertas Ativos</Label>
            <p className="text-sm text-muted-foreground">
              Exibir alertas no dashboard para números que precisam de ação
            </p>
          </div>
          <Switch
            checked={isActive}
            onCheckedChange={setIsActive}
          />
        </div>

        {/* Status Selection */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Status a Monitorar</Label>
          <p className="text-sm text-muted-foreground">
            Selecione os status que devem gerar alertas
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {statusList.map((status) => (
              <div
                key={status.id}
                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedStatuses.includes(status.id)
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-muted/50'
                }`}
                onClick={() => toggleStatus(status.id)}
              >
                <Checkbox
                  checked={selectedStatuses.includes(status.id)}
                  onCheckedChange={() => toggleStatus(status.id)}
                />
                <Badge className={statusColorMap[status.cor] || statusColorMap.gray}>
                  {status.nome}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Interval Configuration */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Intervalo entre Alertas</Label>
          <p className="text-sm text-muted-foreground">
            Define o tempo mínimo entre a exibição de alertas
          </p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Select
                value={intervalHours.toString()}
                onValueChange={(v) => setIntervalHours(parseInt(v))}
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 3, 4, 6, 8, 12, 24].map((h) => (
                    <SelectItem key={h} value={h.toString()}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">hora(s)</span>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={intervalMinutes.toString()}
                onValueChange={(v) => setIntervalMinutes(parseInt(v))}
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, 15, 30, 45].map((m) => (
                    <SelectItem key={m} value={m.toString()}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">minuto(s)</span>
            </div>
          </div>
        </div>

        {/* Last Alert Info */}
        {config?.last_alert_at && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 bg-muted/30 rounded-lg">
            <AlertTriangle className="h-4 w-4" />
            Último alerta exibido: {new Date(config.last_alert_at).toLocaleString('pt-BR')}
          </div>
        )}

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={updateConfig.isPending || !hasChanges}
          className="w-full"
        >
          {updateConfig.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Salvar Configuração
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
