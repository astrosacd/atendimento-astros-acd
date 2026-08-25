import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, ChevronRight, Loader2 } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { useConsultaNumerosCacheRows } from '@/hooks/useConsultaNumerosCacheRows';

export function MonitoredNumbersCard() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  
  // Check permission first
  const canView = hasPermission('view_consulta_numeros');

  // Fetch reminder config to get monitored statuses
  const { data: reminderConfig, isLoading: configLoading } = useQuery({
    queryKey: ['reminder-config-dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consulta_numeros_reminder_config')
        .select('status_to_monitor, is_active')
        .single();
      if (error) throw error;
      return data;
    },
    staleTime: 60 * 1000,
  });

  const monitoredStatuses = reminderConfig?.status_to_monitor || [];
  const isReminderActive = reminderConfig?.is_active || false;

  // Fetch count of numbers with monitored statuses from local cache (shared query)
  const { data: cacheData = [], isLoading: countLoading } = useConsultaNumerosCacheRows(
    monitoredStatuses.length > 0
  );

  const totalCount = useMemo(() => {
    if (!monitoredStatuses.length) return 0;
    return (cacheData || []).filter((row: any) => {
      const statusVal =
        row.row_data?.['excluido_da_base']?.value ||
        row.row_data?.['excluido_da_base'] ||
        row.row_data?.['status']?.value ||
        row.row_data?.['status'] ||
        '';
      const normalizedStatus = typeof statusVal === 'string' ? statusVal.trim() : '';
      return monitoredStatuses.some((s: string) => s.toLowerCase() === normalizedStatus.toLowerCase());
    }).length;
  }, [cacheData, monitoredStatuses]);


  const isLoading = configLoading || countLoading;

  // Don't show if no permission or no statuses configured
  if (!canView || (!configLoading && monitoredStatuses.length === 0)) {
    return null;
  }

  return (
    <Card 
      className="bg-gradient-to-br from-indigo-500/10 to-indigo-500/5 border-indigo-500/20 hover:border-indigo-500/40 transition-colors cursor-pointer group"
      onClick={() => navigate('/admin/consulta-numeros')}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-indigo-500/20 flex items-center justify-center">
              {isLoading ? (
                <Loader2 className="h-6 w-6 text-indigo-500 animate-spin" />
              ) : (
                <Bell className="h-6 w-6 text-indigo-500" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-3xl font-bold text-foreground font-display">
                  {isLoading ? '...' : totalCount}
                </p>
                {isReminderActive && (
                  <Badge variant="outline" className="text-xs bg-green-500/10 text-green-500 border-green-500/30">
                    Ativo
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Status Monitorados</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex flex-wrap gap-1 max-w-[150px]">
              {monitoredStatuses.slice(0, 2).map((status: string) => (
                <Badge key={status} variant="secondary" className="text-xs truncate max-w-[70px]">
                  {status}
                </Badge>
              ))}
              {monitoredStatuses.length > 2 && (
                <Badge variant="secondary" className="text-xs">
                  +{monitoredStatuses.length - 2}
                </Badge>
              )}
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-indigo-500 transition-colors" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
