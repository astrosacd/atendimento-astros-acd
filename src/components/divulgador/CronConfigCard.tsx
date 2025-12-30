import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Clock, Save, Loader2, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function CronConfigCard() {
  const { t } = useTranslation();
  const [cronEnabled, setCronEnabled] = useState(false);
  const [cronInterval, setCronInterval] = useState(5);
  const [isLoading, setIsLoading] = useState(false);
  const [cronStatus, setCronStatus] = useState<string | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      const { data } = await (supabase as any)
        .from('divulgador_config')
        .select('*')
        .in('config_key', ['cron_enabled', 'cron_interval_minutes']);
      
      if (data) {
        const enabledConfig = data.find((d: any) => d.config_key === 'cron_enabled');
        const intervalConfig = data.find((d: any) => d.config_key === 'cron_interval_minutes');
        if (enabledConfig) setCronEnabled(enabledConfig.config_value === 'true');
        if (intervalConfig) setCronInterval(parseInt(intervalConfig.config_value) || 5);
      }

      const { data: cronData } = await (supabase as any).rpc('get_divulgador_cron_schedule');
      if (cronData && cronData.length > 0) {
        setCronStatus(cronData[0].schedule);
      }
    };
    fetchConfig();
  }, []);

  const saveConfig = async () => {
    setIsLoading(true);
    try {
      await (supabase as any).from('divulgador_config').upsert([
        { config_key: 'cron_enabled', config_value: String(cronEnabled) },
        { config_key: 'cron_interval_minutes', config_value: String(cronInterval) },
      ], { onConflict: 'config_key' });

      if (cronEnabled) {
        const { error } = await (supabase as any).rpc('update_divulgador_cron_schedule', { 
          p_interval_minutes: cronInterval 
        });
        if (error) throw error;
        toast.success(`${t('broadcaster.cronActivated')} ${cronInterval} ${t('broadcaster.minutes')}`);
      } else {
        await (supabase as any).rpc('disable_divulgador_cron');
        toast.success(t('broadcaster.cronDeactivated'));
      }

      const { data: cronData } = await (supabase as any).rpc('get_divulgador_cron_schedule');
      setCronStatus(cronData?.[0]?.schedule || null);
    } catch (error: any) {
      toast.error(t('common.error') + ': ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getIntervalLabel = (value: number) => {
    if (value === 1) return t('broadcaster.everyMinute');
    if (value === 60) return t('broadcaster.everyHour');
    return t('broadcaster.everyMinutes', { count: value });
  };

  return (
    <Card className="border-border/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-blue-500" />{t('broadcaster.cronConfig')}</CardTitle>
        <CardDescription>{t('broadcaster.cronConfigDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
          <div className="flex items-center gap-3">
            <Switch checked={cronEnabled} onCheckedChange={setCronEnabled} />
            <div>
              <p className="font-medium">{t('broadcaster.enableAutoSend')}</p>
              <p className="text-sm text-muted-foreground">{t('broadcaster.processesAutomatically')}</p>
            </div>
          </div>
          {cronStatus && (
            <Badge variant="outline" className="gap-1.5">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              {t('broadcaster.active')}: {cronStatus}
            </Badge>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t('broadcaster.intervalMinutes')}</Label>
            <Select value={String(cronInterval)} onValueChange={(v) => setCronInterval(parseInt(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">{getIntervalLabel(1)}</SelectItem>
                <SelectItem value="2">{getIntervalLabel(2)}</SelectItem>
                <SelectItem value="5">{getIntervalLabel(5)}</SelectItem>
                <SelectItem value="10">{getIntervalLabel(10)}</SelectItem>
                <SelectItem value="15">{getIntervalLabel(15)}</SelectItem>
                <SelectItem value="30">{getIntervalLabel(30)}</SelectItem>
                <SelectItem value="60">{getIntervalLabel(60)}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={saveConfig} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          {t('broadcaster.saveConfig')}
        </Button>
      </CardContent>
    </Card>
  );
}